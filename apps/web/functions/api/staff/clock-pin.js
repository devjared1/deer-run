import { json } from '../admin/_auth.js'
import { requireStaff } from './_auth.js'
import { PIN_PATTERN, CLOCK_PIN_COLUMNS, checkEmployeePin, newPinFields, pinLockedUntil } from './_pin.js'

// The signed-in employee's own time clock PIN, for the kiosk (/timeclock). Admins can also set or clear it
// (PUT /api/admin/employees/:id { clockPin }), e.g. for staff without a login.

// GET /api/staff/clock-pin → { hasPin, lockedUntil }
export async function onRequestGet({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { employee } = result
  if (!('clockPinHash' in employee)) return json({ error: 'The time clock PIN needs a database update (migration 13)' }, 503)
  return json({ hasPin: !!employee.clockPinHash, lockedUntil: pinLockedUntil(employee, 'clock') })
}

// PUT /api/staff/clock-pin { currentPin?, newPin } — set or change it. Changing one requires the current PIN; a
// forgotten PIN is set again by an admin (Admin → Employees).
export async function onRequestPut({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result
  if (!('clockPinHash' in employee)) return json({ error: 'The time clock PIN needs a database update (migration 13)' }, 503)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const newPin = String(body.newPin ?? '')
  if (!PIN_PATTERN.test(newPin)) return json({ error: 'PIN must be 4 to 6 digits' }, 400)

  if (employee.clockPinHash) {
    const { data: current } = await supabase.from('Employee').select(CLOCK_PIN_COLUMNS).eq('id', employee.id).single()
    const check = await checkEmployeePin(supabase, current, body.currentPin, 'clock')
    if (!check.ok) return json({ error: check.error.replace('Wrong PIN', 'Current PIN is wrong'), code: check.code }, check.status)
  }

  const { error } = await supabase.from('Employee').update(await newPinFields('clock', newPin)).eq('id', employee.id)
  if (error) return json({ error: error.message }, 500)
  return json({ hasPin: true, lockedUntil: null })
}
