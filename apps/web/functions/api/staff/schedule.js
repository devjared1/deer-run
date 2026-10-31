import { json } from '../admin/_auth.js'
import { requireStaff } from './_auth.js'
import { resolveScheduleRange, fetchShifts, fetchTimeOff } from '../admin/shifts/_validate.js'

// GET /api/staff/schedule?from=&to=  or  ?view=week|biweek|month&date=  [&team=1]
// The signed-in employee's shifts and approved time off in the range. With team=1, every
// employee's shifts (read-only, names and positions only) and the team's approved time off.
export async function onRequestGet({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  const { searchParams } = new URL(request.url)
  const range = await resolveScheduleRange(searchParams, supabase)
  if (range.error) return json({ error: range.error }, 400)
  const team = searchParams.get('team') === '1'
  const onlyMine = team ? null : employee.id

  try {
    const [shifts, timeOff] = await Promise.all([
      fetchShifts(supabase, range.from, range.to, onlyMine),
      // Coworkers see that someone is off, not why or whether a request is pending
      fetchTimeOff(supabase, range.from, range.to, { employeeId: onlyMine, statuses: ['APPROVED'] }),
    ])

    let employees = [{
      id: employee.id, firstName: employee.firstName, lastName: employee.lastName,
      position: employee.position, active: employee.active,
    }]
    if (team) {
      const { data, error } = await supabase
        .from('Employee')
        .select('id, firstName, lastName, position, active')
        .order('lastName', { ascending: true })
        .order('firstName', { ascending: true })
      if (error) throw new Error(error.message)
      const scheduled = new Set(shifts.map(s => s.employeeId))
      employees = (data || []).filter(e => e.active || scheduled.has(e.id))
    }

    return json({
      ...range,
      employeeId: employee.id,
      shifts,
      employees,
      timeOff: timeOff.map(({ type, ...r }) => (r.employeeId === employee.id ? { ...r, type } : r)),
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
