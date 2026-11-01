import { requireAdmin, json } from '../_auth.js'
import {
  parseEmployee, findUserIdByEmail, constraintMessage, serializeEmployee, EMPLOYEE_COLUMNS, RESET_MANAGER_PIN,
} from './_validate.js'
import { PIN_PATTERN, newPinFields, resetPinFields } from '../../staff/_pin.js'

// PUT /api/admin/employees/:id — update fields (including active = false to deactivate).
// { resetManagerPin: true } clears the employee's register manager PIN and any lockout.
// { clockPin: '1234' } sets their time clock (kiosk) PIN, 4–6 digits; { clockPin: null } clears it. Either clears a lockout.
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: update, error: validationError } = parseEmployee(body, { partial: true })
  if (validationError) return json({ error: validationError }, 400)
  if (body.resetManagerPin) Object.assign(update, RESET_MANAGER_PIN)
  if (body.clockPin !== undefined) {
    if (body.clockPin === null) Object.assign(update, resetPinFields('clock'))
    else if (!PIN_PATTERN.test(String(body.clockPin))) return json({ error: 'The time clock PIN must be 4 to 6 digits' }, 400)
    else Object.assign(update, await newPinFields('clock', String(body.clockPin)))
  }
  if (!Object.keys(update).length) return json({ error: 'No fields to update' }, 400)

  // Re-link the login account when the email changes
  if (update.email !== undefined) update.userId = await findUserIdByEmail(supabase, update.email)

  const { data, error } = await supabase
    .from('Employee')
    .update(update)
    .eq('id', params.id)
    .select(EMPLOYEE_COLUMNS)
    .maybeSingle()

  if (error) {
    const message = constraintMessage(error)
    return message ? json({ error: message }, 409) : json({ error: error.message }, 500)
  }
  if (!data) return json({ error: 'Employee not found' }, 404)

  return json(serializeEmployee(data))
}

// DELETE /api/admin/employees/:id — only allowed when the employee has no time clock history
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase.from('Employee').delete().eq('id', params.id).select('id')
  if (error) {
    const message = constraintMessage(error)
    return message ? json({ error: message }, 409) : json({ error: error.message }, 500)
  }
  if (!data?.length) return json({ error: 'Employee not found' }, 404)

  return json({ success: true })
}
