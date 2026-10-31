import { json } from '../admin/_auth.js'
import { requireStaff } from './_auth.js'
import { ENTRY_SELECT, serializeEntry } from './_timesheet.js'
import { localDate, startOfLocalDay } from '../../../src/lib/timeclock.js'

const ACTIONS = ['clock_in', 'clock_out', 'break_start', 'break_end']

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

/** Current clock state plus today's entries (course-local day). */
async function clockStatus(supabase, employee) {
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

// GET /api/staff/clock — current state for the signed-in employee
export async function onRequestGet({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  try {
    return json(await clockStatus(supabase, employee))
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/staff/clock { action: clock_in | clock_out | break_start | break_end }
// Always uses server time; the client never supplies timestamps.
export async function onRequestPost({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { action } = body
  if (!ACTIONS.includes(action)) {
    return json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, 400)
  }

  try {
    const open = await getOpenEntry(supabase, employee.id)
    const openBreak = open?.breaks?.find(b => !b.endedAt)
    const now = new Date().toISOString()
    const writes = []

    if (action === 'clock_in') {
      if (open) return json({ error: 'You are already clocked in' }, 409)
      writes.push(() => supabase
        .from('TimeEntry')
        .insert({ id: crypto.randomUUID(), employeeId: employee.id, clockIn: now }))
    }

    if (action === 'break_start') {
      if (!open) return json({ error: 'Clock in before starting a break' }, 409)
      if (openBreak) return json({ error: 'You are already on a break' }, 409)
      writes.push(() => supabase
        .from('TimeBreak')
        .insert({ id: crypto.randomUUID(), timeEntryId: open.id, startedAt: now }))
    }

    if (action === 'break_end') {
      if (!openBreak) return json({ error: 'You are not on a break' }, 409)
      writes.push(() => supabase.from('TimeBreak').update({ endedAt: now }).eq('id', openBreak.id))
    }

    if (action === 'clock_out') {
      if (!open) return json({ error: 'You are not clocked in' }, 409)
      // Clocking out ends any break in progress
      if (openBreak) writes.push(() => supabase.from('TimeBreak').update({ endedAt: now }).eq('id', openBreak.id))
      writes.push(() => supabase.from('TimeEntry').update({ clockOut: now }).eq('id', open.id))
    }

    for (const write of writes) {
      const { error } = await write()
      // 23505: the one-open-entry index caught a second clock-in sent at the same instant
      if (error?.code === '23505') return json({ error: 'You are already clocked in' }, 409)
      if (error) return json({ error: error.message }, 500)
    }

    return json(await clockStatus(supabase, employee))
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
