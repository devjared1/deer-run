import { json } from '../../admin/_auth.js'
import { requireStaff } from '../_auth.js'
import { TIME_OFF_SELECT, serializeTimeOff, parseTimeOffRequest, shiftsDuring } from '../_timeoff.js'

// GET /api/staff/time-off — the signed-in employee's requests, newest first
export async function onRequestGet({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  const { data, error } = await supabase
    .from('TimeOffRequest')
    .select(TIME_OFF_SELECT)
    .eq('employeeId', employee.id)
    .order('startDate', { ascending: false })
    .limit(200)
  if (error) return json({ error: error.message }, 500)

  return json((data || []).map(serializeTimeOff))
}

// POST /api/staff/time-off — { startDate, endDate, type, reason? }
// Refused if it overlaps one of the employee's pending or approved requests. The response lists
// any shifts the employee is already scheduled for during the request, so the page can mention them.
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

  const { data: fields, error: validationError } = parseTimeOffRequest(body)
  if (validationError) return json({ error: validationError }, 400)

  const { data: overlapping, error: overlapError } = await supabase
    .from('TimeOffRequest')
    .select('id, status')
    .eq('employeeId', employee.id)
    .in('status', ['PENDING', 'APPROVED'])
    .lte('startDate', fields.endDate)
    .gte('endDate', fields.startDate)
    .limit(1)
  if (overlapError) return json({ error: overlapError.message }, 500)
  if (overlapping?.length) {
    return json({
      error: `This overlaps a request that's already ${overlapping[0].status === 'APPROVED' ? 'approved' : 'pending'}. Cancel that one first if you need to change it`,
    }, 409)
  }

  const { data, error } = await supabase
    .from('TimeOffRequest')
    .insert({ id: crypto.randomUUID(), employeeId: employee.id, ...fields, status: 'PENDING' })
    .select(TIME_OFF_SELECT)
    .single()
  if (error) return json({ error: error.message }, 500)

  try {
    const scheduled = await shiftsDuring(supabase, employee.id, fields.startDate, fields.endDate)
    return json({ ...serializeTimeOff(data), scheduledShifts: scheduled }, 201)
  } catch {
    return json({ ...serializeTimeOff(data), scheduledShifts: [] }, 201)
  }
}
