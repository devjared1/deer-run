import { json } from '../admin/_auth.js'
import { requireStaff, isManagerPosition } from './_auth.js'
import { PIN_PATTERN, hashPin, checkManagerPin, MANAGER_PIN_COLUMNS } from './_pin.js'
import { toUtcIso } from '../../../src/lib/timeclock.js'

async function requireManager(request, env) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  if (!(await isManagerPosition(result.supabase, result.employee.position))) {
    return json({ error: 'Only managers have a register PIN' }, 403)
  }
  return result
}

// GET /api/staff/pin — whether the signed-in manager has a PIN set
export async function onRequestGet({ request, env }) {
  const result = await requireManager(request, env)
  if (result instanceof Response) return result
  const { employee } = result

  const lockedUntil = employee.managerPinLockedUntil ? toUtcIso(employee.managerPinLockedUntil) : null
  return json({
    hasPin: !!employee.managerPinHash,
    lockedUntil: lockedUntil && new Date(lockedUntil) > new Date() ? lockedUntil : null,
  })
}

// PUT /api/staff/pin — { currentPin?, newPin } set or change the signed-in manager's PIN.
// Changing an existing PIN requires the current one; a forgotten PIN is reset by an admin.
export async function onRequestPut({ request, env }) {
  const result = await requireManager(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const newPin = String(body.newPin ?? '')
  if (!PIN_PATTERN.test(newPin)) return json({ error: 'PIN must be 4 to 6 digits' }, 400)

  if (employee.managerPinHash) {
    const { data: manager } = await supabase.from('Employee').select(MANAGER_PIN_COLUMNS).eq('id', employee.id).single()
    const check = await checkManagerPin(supabase, manager, body.currentPin)
    if (!check.ok) return json({ error: check.error.replace('Wrong PIN', 'Current PIN is wrong') }, check.status)
  }

  const { error } = await supabase
    .from('Employee')
    .update({ managerPinHash: await hashPin(newPin), managerPinFailedAttempts: 0, managerPinLockedUntil: null })
    .eq('id', employee.id)
  if (error) return json({ error: error.message }, 500)

  return json({ hasPin: true })
}
