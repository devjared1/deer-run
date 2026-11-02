import { bookedPlayers, HOLD_COLUMNS, teeTime } from '../../../src/lib/teesheet.js'
import { formatLocalDate, localDate, localDateTimeToUtc } from '../../../src/lib/timeclock.js'
import { sendBookingEmail } from './_email.js'
import { siteOrigin, waitlistLeaveUrl } from '../_links.js'

// The waitlist for full days ("Tell me if a time opens up" on the booking Time step). When spots free up on a day (a
// cancellation, a released unpaid hold, a moved or changed booking), the earliest entries whose group fits are emailed,
// once each, with the open times and a link to book. Members-only times aren't offered (the entry may be a guest).
// First come, first served: the email doesn't hold a spot. As many entries are told as the open spots could seat, so
// one cancellation doesn't email everyone on the list.

/**
 * Emails the waitlist for one course date about the times open now. → { notified, errors }. Never throws for a
 * single email; throws on database errors.
 */
export async function notifyWaitlist(supabase, env, date, origin = siteOrigin(env)) {
  const summary = { notified: 0, errors: [] }
  if (!date || date < localDate()) return summary

  const [{ data: entries, error: entryError }, { data: slots, error: slotError }] = await Promise.all([
    supabase.from('WaitlistEntry').select('*').eq('date', date).is('notifiedAt', null).is('cancelledAt', null)
      .order('createdAt', { ascending: true }),
    supabase.from('TeeTimeSlot').select(`id, startTime, maxPlayers, memberOnly, bookings:Booking(${HOLD_COLUMNS})`)
      .eq('date', date).eq('memberOnly', false).order('startTime'),
  ])
  // Before migration 15 there's no WaitlistEntry table: nothing to do
  if (entryError) return entryError.code === '42P01' ? summary : Promise.reject(new Error(entryError.message))
  if (slotError) throw new Error(slotError.message)
  if (!entries?.length) return summary

  const now = new Date()
  const open = (slots || [])
    .filter(s => localDateTimeToUtc(date, s.startTime) > now)
    .map(s => ({ startTime: s.startTime, available: Math.max(0, s.maxPlayers - bookedPlayers(s.bookings, now)) }))
    .filter(s => s.available > 0)
  let spots = open.reduce((sum, s) => sum + s.available, 0)
  if (!spots) return summary

  const day = formatLocalDate(date, { weekday: 'long', month: 'long', day: 'numeric' })
  for (const entry of entries) {
    if (spots <= 0) break
    const fits = open.filter(s => s.available >= entry.players)
    if (!fits.length) continue
    // Claim first, so two runs at once can't both email this entry
    const { data: claimed, error } = await supabase.from('WaitlistEntry').update({ notifiedAt: now.toISOString() })
      .eq('id', entry.id).is('notifiedAt', null).is('cancelledAt', null).select('id')
    if (error) throw new Error(error.message)
    if (!claimed?.length) continue
    spots -= entry.players

    const times = fits.slice(0, 6).map(s => `  ${teeTime(s.startTime)} (${s.available} spot${s.available === 1 ? '' : 's'})`)
    const bookUrl = `${origin}/book?date=${date}&players=${entry.players}`
    const emailError = await sendBookingEmail(env, entry.email, `A tee time opened up on ${day} — Deer Run Golf Course`, [
      `Hi ${entry.name || 'there'},`,
      '',
      `A tee time with room for ${entry.players} just opened up on ${day}:`,
      ...times,
      ...(fits.length > times.length ? [`  …and ${fits.length - times.length} more`] : []),
      '',
      `Book it here: ${bookUrl}`,
      '',
      'Times go to whoever books first, so don\'t wait too long. This is the only email you\'ll get about this day.',
      `Not interested any more? ${await waitlistLeaveUrl(env, origin, entry.id)}`,
    ])
    if (emailError) summary.errors.push(`${entry.id}: ${emailError}`)
    else summary.notified++
  }
  return summary
}

/**
 * notifyWaitlist for the course dates in `dates` after the response is sent (context.waitUntil), so cancelling
 * isn't slowed down by emails. Errors are logged.
 */
export function notifyWaitlistInBackground(context, supabase, dates, origin) {
  const unique = [...new Set((dates || []).filter(Boolean).map(d => String(d).slice(0, 10)))]
  if (!unique.length) return
  const work = Promise.all(unique.map(d => notifyWaitlist(supabase, context.env, d, origin)))
    .then(all => {
      const errors = all.flatMap(s => s.errors)
      if (errors.length) console.error('Waitlist emails:', errors.join('; '))
    })
    .catch(e => console.error('Waitlist:', e.message))
  if (typeof context.waitUntil === 'function') context.waitUntil(work)
}
