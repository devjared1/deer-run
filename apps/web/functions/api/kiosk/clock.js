import { json } from '../admin/_auth.js'
import { requireKiosk } from './_auth.js'
import { CLOCK_PIN_COLUMNS, checkEmployeePin } from '../staff/_pin.js'
import { clockStatus, recordPunch } from '../staff/_clock.js'

// POST /api/kiosk/clock (X-Kiosk-Token) { employeeId, pin, action? }
// The employee picked their name and typed their time clock PIN. Every request checks the PIN again (wrong tries
// count toward the 15-minute lockout), so the kiosk keeps nothing but the PIN it's holding for the open screen.
//   no action → their clock state (the "signed in" screen); action clock_in | clock_out | break_start | break_end →
//   records it (server time) and returns the new state with `done: action`.
// → clockStatus (staff/_clock.js): { status, openEntry, today, serverTime, employee }
// Errors: 400/403/423 with code PIN_NOT_SET / PIN_WRONG / PIN_LOCKED; 409 when the punch doesn't fit the state.
export async function onRequestPost({ request, env }) {
  const result = await requireKiosk(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: employee, error } = await supabase
    .from('Employee')
    .select(CLOCK_PIN_COLUMNS)
    .eq('id', String(body?.employeeId ?? ''))
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!employee?.active) return json({ error: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' }, 404)

  const pin = await checkEmployeePin(supabase, employee, body.pin, 'clock')
  if (!pin.ok) return json({ error: pin.error, code: pin.code }, pin.status)

  try {
    if (body.action) {
      const failed = await recordPunch(supabase, employee, body.action)
      if (failed) return json({ error: failed.error, ...(await clockStatus(supabase, employee)) }, failed.status)
    }
    return json({ ...(await clockStatus(supabase, employee)), ...(body.action ? { done: body.action } : {}) })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
