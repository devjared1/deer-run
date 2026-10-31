import { json } from '../../admin/_auth.js'
import { requireStaff } from '../_auth.js'
import { TIME_OFF_SELECT, serializeTimeOff } from '../_timeoff.js'

// PUT /api/staff/time-off/:id — { action: 'cancel' }
// Employees can cancel their own requests while they're still pending.
export async function onRequestPut({ request, env, params }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (body?.action !== 'cancel') return json({ error: "action must be 'cancel'" }, 400)

  // Conditional update so a request approved a moment ago can't be cancelled here
  const { data, error } = await supabase
    .from('TimeOffRequest')
    .update({ status: 'CANCELLED' })
    .eq('id', params.id)
    .eq('employeeId', employee.id)
    .eq('status', 'PENDING')
    .select(TIME_OFF_SELECT)
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)

  if (!data) {
    const { data: existing } = await supabase
      .from('TimeOffRequest')
      .select('status')
      .eq('id', params.id)
      .eq('employeeId', employee.id)
      .maybeSingle()
    if (!existing) return json({ error: 'Request not found' }, 404)
    return json({ error: `This request was already ${existing.status.toLowerCase()}. Ask a manager if it needs to change` }, 409)
  }

  return json(serializeTimeOff(data))
}
