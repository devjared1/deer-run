import { requireAdmin, json } from '../_auth.js'
import { resolveScheduleRange, parseShift, fetchShifts, fetchTimeOff, SHIFT_COLUMNS } from './_validate.js'

const EMPLOYEE_FIELDS = 'id, firstName, lastName, position, active'

// GET /api/admin/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD  or  ?view=week|biweek|month&date=YYYY-MM-DD
// Shifts in the range, every active employee plus inactive ones who have shifts in it,
// and approved/pending time off that overlaps it.
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const range = await resolveScheduleRange(new URL(request.url).searchParams, supabase)
  if (range.error) return json({ error: range.error }, 400)

  try {
    const [shifts, timeOff, employeesRes] = await Promise.all([
      fetchShifts(supabase, range.from, range.to),
      fetchTimeOff(supabase, range.from, range.to),
      supabase
        .from('Employee')
        .select(EMPLOYEE_FIELDS)
        .order('lastName', { ascending: true })
        .order('firstName', { ascending: true }),
    ])
    if (employeesRes.error) throw new Error(employeesRes.error.message)

    const scheduled = new Set(shifts.map(s => s.employeeId))
    const employees = (employeesRes.data || []).filter(e => e.active || scheduled.has(e.id))

    return json({ ...range, shifts, employees, timeOff })
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
