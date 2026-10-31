import { requireAdmin, json } from '../_auth.js'
import { TIME_OFF_SELECT, serializeTimeOff, emailDecision } from '../../staff/_timeoff.js'

const DECISIONS = { approve: 'APPROVED', deny: 'DENIED' }

// PUT /api/admin/time-off/:id — { action: 'approve' | 'deny', note? }
// Only pending requests can be decided. Records the reviewer and time, then emails the employee.
// The response includes emailError if the email couldn't be sent (the decision is saved either way).
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const status = DECISIONS[body?.action]
  if (!status) return json({ error: "action must be 'approve' or 'deny'" }, 400)
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    return json({ error: 'note must be text' }, 400)
  }
  const note = body.note?.trim() || null
  if (note && note.length > 500) return json({ error: 'The note can be at most 500 characters' }, 400)

  // Conditional on PENDING so a request the employee just cancelled (or another manager decided) isn't overwritten
  const { data, error } = await supabase
    .from('TimeOffRequest')
    .update({ status, reviewedById: dbUser.id, reviewedAt: new Date().toISOString(), reviewNote: note })
    .eq('id', params.id)
    .eq('status', 'PENDING')
    .select(`${TIME_OFF_SELECT}, employee:Employee(id, firstName, lastName, email)`)
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)

  if (!data) {
    const { data: existing } = await supabase.from('TimeOffRequest').select('status').eq('id', params.id).maybeSingle()
    if (!existing) return json({ error: 'Request not found' }, 404)
    return json({ error: `This request is already ${existing.status.toLowerCase()}` }, 409)
  }

  const emailError = await emailDecision(env, data, data.employee)
  return json({ ...serializeTimeOff(data), emailError })
}
