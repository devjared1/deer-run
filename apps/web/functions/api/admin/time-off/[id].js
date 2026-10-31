import { requireAdmin, json } from '../_auth.js'
import { TIME_OFF_SELECT, REVOKED_PREFIX, serializeTimeOff, emailDecision } from '../../staff/_timeoff.js'
import { localDate } from '../../../../src/lib/timeclock.js'

const DECISIONS = { approve: 'APPROVED', deny: 'DENIED' }

// PUT /api/admin/time-off/:id — { action: 'approve' | 'deny' | 'revoke', note? }
// approve / deny: pending requests only. revoke: an approved request whose endDate is today or later
// (course-local); the note is required, and the request becomes DENIED with "Approval revoked: <note>".
// Records the reviewer and time, then emails the employee.
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

  const revoking = body?.action === 'revoke'
  const status = revoking ? 'DENIED' : DECISIONS[body?.action]
  if (!status) return json({ error: "action must be 'approve', 'deny' or 'revoke'" }, 400)
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    return json({ error: 'note must be text' }, 400)
  }
  const note = body.note?.trim() || null
  if (note && note.length > 500) return json({ error: 'The note can be at most 500 characters' }, 400)
  if (revoking && !note) return json({ error: 'Add a note telling the employee why the approval is revoked' }, 400)

  // Revoking: only approved requests that haven't fully ended (course-local). The prefix keeps the note readable
  // on both portals, since the request ends up DENIED like any other refusal.
  const today = localDate()
  const update = {
    status,
    reviewedById: dbUser.id,
    reviewedAt: new Date().toISOString(),
    reviewNote: revoking ? `${REVOKED_PREFIX}${note}` : note,
  }

  // Conditional on the current status so a request the employee just cancelled (or another manager decided)
  // isn't overwritten
  let query = supabase
    .from('TimeOffRequest')
    .update(update)
    .eq('id', params.id)
    .eq('status', revoking ? 'APPROVED' : 'PENDING')
  if (revoking) query = query.gte('endDate', today)
  const { data, error } = await query
    .select(`${TIME_OFF_SELECT}, employee:Employee(id, firstName, lastName, email)`)
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)

  if (!data) {
    const { data: existing } = await supabase
      .from('TimeOffRequest')
      .select('status, endDate')
      .eq('id', params.id)
      .maybeSingle()
    if (!existing) return json({ error: 'Request not found' }, 404)
    if (revoking && existing.status === 'APPROVED') {
      return json({ error: "This time off has already ended, so it can't be revoked" }, 409)
    }
    if (revoking) return json({ error: `Only approved requests can be revoked (this one is ${existing.status.toLowerCase()})` }, 409)
    return json({ error: `This request is already ${existing.status.toLowerCase()}` }, 409)
  }

  const emailError = await emailDecision(env, data, data.employee, { revoked: revoking })
  return json({ ...serializeTimeOff(data), emailError })
}
