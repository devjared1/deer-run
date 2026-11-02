import { requireAdmin, json } from '../_auth.js'
import { fetchAll } from '../_db.js'
import { resolveScheduleRange, parseShift, fetchShifts, fetchTimeOff, SHIFT_COLUMNS } from './_validate.js'
import { holdsSpot, HOLD_COLUMNS } from '../../../../src/lib/teesheet.js'

// hourlyRateCents: the schedule's planned labor cost per day (admin only; the staff schedule API doesn't send it)
const EMPLOYEE_FIELDS = 'id, firstName, lastName, position, active, hourlyRateCents'

// GET /api/admin/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD  or  ?view=week|biweek|month&date=YYYY-MM-DD
// Shifts in the range, every active employee plus inactive ones who have shifts in it,
// and approved/pending time off that overlaps it. Also `booked: { [date]: { players, groups } }`, the tee times booked
// each day (what holds a spot), so the schedule can be staffed to how busy the day is.
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const range = await resolveScheduleRange(new URL(request.url).searchParams, supabase)
  if (range.error) return json({ error: range.error }, 400)

  try {
    const [shifts, timeOff, employeesRes, bookings] = await Promise.all([
      fetchShifts(supabase, range.from, range.to),
      fetchTimeOff(supabase, range.from, range.to),
      supabase
        .from('Employee')
        .select(EMPLOYEE_FIELDS)
        .order('lastName', { ascending: true })
        .order('firstName', { ascending: true }),
      fetchAll(() => supabase.from('Booking')
        .select(`id, ${HOLD_COLUMNS}, slot:TeeTimeSlot!inner(date)`)
        .gte('slot.date', range.from).lte('slot.date', range.to)
        .in('status', ['PENDING', 'CONFIRMED'])
        .order('id')),
    ])
    if (employeesRes.error) throw new Error(employeesRes.error.message)

    const scheduled = new Set(shifts.map(s => s.employeeId))
    const employees = (employeesRes.data || []).filter(e => e.active || scheduled.has(e.id))

    const now = new Date()
    const booked = {}
    for (const b of bookings) {
      if (!holdsSpot(b, now)) continue
      const day = String(b.slot.date).slice(0, 10)
      booked[day] ??= { players: 0, groups: 0 }
      booked[day].players += b.players
      booked[day].groups += 1
    }

    return json({ ...range, shifts, employees, timeOff, booked })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/admin/shifts — { employeeId, date, startTime, endTime, position?, notes? }
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: fields, error: validationError } = parseShift(body)
  if (validationError) return json({ error: validationError }, 400)

  const { data: employee } = await supabase.from('Employee').select('id').eq('id', fields.employeeId).maybeSingle()
  if (!employee) return json({ error: 'Employee not found' }, 404)

  const { data, error } = await supabase
    .from('Shift')
    .insert({ id: crypto.randomUUID(), ...fields })
    .select(SHIFT_COLUMNS)
    .single()
  if (error) return json({ error: error.message }, 500)

  return json(data, 201)
}
