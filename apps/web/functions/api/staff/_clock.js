import { ENTRY_SELECT, serializeEntry } from './_timesheet.js'
import { localDate, startOfLocalDay } from '../../../src/lib/timeclock.js'

// Clock punches, shared by the staff portal (POST /api/staff/clock, the signed-in employee) and the time clock
// kiosk (POST /api/kiosk/clock, an employee who picked their name and typed their PIN). Always server time.

export const CLOCK_ACTIONS = ['clock_in', 'clock_out', 'break_start', 'break_end']

async function getOpenEntry(supabase, employeeId) {
  const { data, error } = await supabase
    .from('TimeEntry')
    .select(ENTRY_SELECT)
    .eq('employeeId', employeeId)
    .is('clockOut', null)
    .order('clockIn', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Current clock state plus today's entries (course-local day):
 * { status: 'off' | 'on' | 'break', openEntry, today: { date, entries, workedMinutes }, serverTime, employee }
 */
export async function clockStatus(supabase, employee) {
  const now = new Date()
  const today = localDate(now)

  const [openEntry, { data: todays, error }] = await Promise.all([
    getOpenEntry(supabase, employee.id),
    supabase
      .from('TimeEntry')
      .select(ENTRY_SELECT)
      .eq('employeeId', employee.id)
      .gte('clockIn', startOfLocalDay(today).toISOString())
      .order('clockIn', { ascending: true }),
  ])
  if (error) throw new Error(error.message)

  const open = openEntry ? serializeEntry(openEntry, now) : null
  const onBreak = !!open?.breaks.some(b => !b.endedAt)
  const entries = (todays || []).map(e => serializeEntry(e, now))

  return {
    status: !open ? 'off' : onBreak ? 'break' : 'on',
    openEntry: open,
    today: {
      date: today,
      entries,
      workedMinutes: entries.reduce((sum, e) => sum + e.workedMinutes, 0),
    },
    serverTime: now.toISOString(),
    employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, position: employee.position },
  }
}

/**
 * Records a punch for the employee: clock_in | clock_out | break_start | break_end. Clocking out ends a break in
 * progress. Returns null when done, or { error, status } (409 when the punch doesn't fit the current state).
 * Throws on database errors reading the current state.
 */
export async function recordPunch(supabase, employee, action) {
  if (!CLOCK_ACTIONS.includes(action)) return { error: `action must be one of: ${CLOCK_ACTIONS.join(', ')}`, status: 400 }
  const open = await getOpenEntry(supabase, employee.id)
  const openBreak = open?.breaks?.find(b => !b.endedAt)
  const now = new Date().toISOString()
  const writes = []

  if (action === 'clock_in') {
    if (open) return { error: 'You are already clocked in', status: 409 }
    writes.push(() => supabase
      .from('TimeEntry')
      .insert({ id: crypto.randomUUID(), employeeId: employee.id, clockIn: now }))
  }

  if (action === 'break_start') {
    if (!open) return { error: 'Clock in before starting a break', status: 409 }
    if (openBreak) return { error: 'You are already on a break', status: 409 }
    writes.push(() => supabase
      .from('TimeBreak')
      .insert({ id: crypto.randomUUID(), timeEntryId: open.id, startedAt: now }))
  }

  if (action === 'break_end') {
    if (!openBreak) return { error: 'You are not on a break', status: 409 }
    writes.push(() => supabase.from('TimeBreak').update({ endedAt: now }).eq('id', openBreak.id))
  }

  if (action === 'clock_out') {
    if (!open) return { error: 'You are not clocked in', status: 409 }
    if (openBreak) writes.push(() => supabase.from('TimeBreak').update({ endedAt: now }).eq('id', openBreak.id))
    writes.push(() => supabase.from('TimeEntry').update({ clockOut: now }).eq('id', open.id))
  }

  for (const write of writes) {
    const { error } = await write()
    // 23505: the one-open-entry index caught a second clock-in sent at the same instant
    if (error?.code === '23505') return { error: 'You are already clocked in', status: 409 }
    if (error) return { error: error.message, status: 500 }
  }
  return null
}
