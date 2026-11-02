import { Resend } from 'resend'
import { addDays, formatLocalDate, localDateTimeToUtc, toUtcIso } from '../../../src/lib/timeclock.js'
import { longTime, shiftsOverlap, timeOffCovers } from '../../../src/lib/schedule.js'

// Shift swaps and open shifts (ShiftOffer). An employee offers their shift (My Schedule) or a manager posts one as an
// open shift (Admin → Schedule) → OPEN; a coworker picks it up → CLAIMED; a manager approves → the shift moves to them
// (APPROVED), or denies → it stays (DENIED). The offerer can withdraw (CANCELLED) and the claimer can let it go again
// (back to OPEN) until a manager decides. Offers for shifts that have started are left out (nothing to swap).

export const OFFER_SELECT = '*, shift:Shift(id, employeeId, date, startTime, endTime, position, notes)'
export const ACTIVE = ['OPEN', 'CLAIMED']

/** True once the shift has started (course time). */
export function shiftStarted(shift, now = new Date()) {
  return localDateTimeToUtc(String(shift.date).slice(0, 10), shift.startTime) <= now
}

/** "Sat, Nov 7, 7:00 AM – 3:00 PM" */
export function shiftLabel(shift) {
  return `${formatLocalDate(String(shift.date).slice(0, 10))}, ${longTime(shift.startTime)} – ${longTime(shift.endTime)}`
}

/** Offers with the people's names and the shift, for the pages. */
export async function serializeOffers(supabase, offers) {
  const ids = [...new Set(offers.flatMap(o => [o.offeredById, o.claimedById, o.shift?.employeeId]).filter(Boolean))]
  const { data: people } = ids.length
    ? await supabase.from('Employee').select('id, firstName, lastName, position').in('id', ids)
    : { data: [] }
  const byId = Object.fromEntries((people || []).map(p => [p.id, p]))
  return offers.map(o => ({
    id: o.id,
    status: o.status,
    note: o.note,
    posted: !!o.postedById,
    createdAt: toUtcIso(o.createdAt),
    claimedAt: toUtcIso(o.claimedAt),
    reviewedAt: toUtcIso(o.reviewedAt),
    reviewNote: o.reviewNote,
    shift: o.shift ? { ...o.shift, date: String(o.shift.date).slice(0, 10) } : null,
    offeredBy: byId[o.offeredById] ?? null,
    claimedBy: o.claimedById ? byId[o.claimedById] ?? null : null,
  }))
}

/**
 * Why `employee` can't take `shift`, or null: it's their own, it has started, they already work then, or they're on
 * approved time off that day.
 */
export async function claimBlocker(supabase, shift, employee) {
  if (!employee?.active) return 'Only active employees can pick up shifts.'
  if (shift.employeeId === employee.id) return 'This is already your shift.'
  if (shiftStarted(shift)) return 'This shift has already started.'
  const date = String(shift.date).slice(0, 10)
  const [{ data: theirs, error }, { data: timeOff, error: timeOffError }] = await Promise.all([
    supabase.from('Shift').select('id, date, startTime, endTime').eq('employeeId', employee.id)
      .gte('date', addDays(date, -1)).lte('date', addDays(date, 1)),
    supabase.from('TimeOffRequest').select('startDate, endDate').eq('employeeId', employee.id).eq('status', 'APPROVED')
      .lte('startDate', date).gte('endDate', date),
  ])
  if (error || timeOffError) throw new Error((error || timeOffError).message)
  const s = { ...shift, date }
  const clash = (theirs || []).map(x => ({ ...x, date: String(x.date).slice(0, 10) })).find(x => shiftsOverlap(s, x))
  if (clash) return `You already work ${longTime(clash.startTime)} – ${longTime(clash.endTime)} then.`
  if ((timeOff || []).some(r => timeOffCovers({ startDate: String(r.startDate).slice(0, 10), endDate: String(r.endDate).slice(0, 10) }, date))) {
    return 'You have approved time off that day.'
  }
  return null
}

/** A short email to an employee about a swap. Returns an error message or null (skipped without email set up). */
export async function emailEmployee(env, employee, subject, lines) {
  if (!env.RESEND_API_KEY || !employee?.email) return null
  try {
    const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
      from: 'noreply@deerrun.golf',
      to: employee.email,
      subject,
      text: [`Hi ${employee.firstName},`, '', ...lines, '', 'Your schedule: https://deerrun.golf/staff/schedule', '', 'Deer Run Golf Course'].join('\n'),
    })
    return error ? error.message : null
  } catch (e) {
    return e.message
  }
}
