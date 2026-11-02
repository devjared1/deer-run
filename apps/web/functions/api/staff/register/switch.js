import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { checkEmployeePin } from '../_pin.js'
import { CASHIER_COLUMNS, pinSwitchBlocker, registerPositions } from './_cashiers.js'

// POST /api/staff/register/switch — { employeeId, pin } from the register's lock screen (time clock PIN; same lockout:
// 5 tries per 15 minutes). The caller must be signed in at a register.
//   → { same: true } when it's the cashier already signed in (just unlock), or
//   → { tokenHash, email } for someone else: a one-time sign-in token the register PC redeems with
//     supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }), which signs that cashier in on this PC.
// Codes: PIN_WRONG / PIN_LOCKED / PIN_NOT_SET (from checkEmployeePin), NEEDS_PASSWORD (admin logins, no sign-in yet,
// or a position that doesn't use the register).
export async function onRequestPost({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, employee: current, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { employeeId, pin } = body ?? {}
  if (typeof employeeId !== 'string' || !employeeId) return json({ error: 'employeeId is required' }, 400)

  const { data: employee, error } = await supabase.from('Employee').select(CASHIER_COLUMNS).eq('id', employeeId).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!employee) return json({ error: 'Employee not found' }, 404)

  // Unlocking for yourself: your PIN is enough, whatever your role
  const same = employee.id === current.id
  if (!same) {
    let positions
    try {
      positions = await registerPositions(supabase)
    } catch (e) {
      return json({ error: e.message }, 500)
    }
    const blocked = pinSwitchBlocker(employee, positions)
    if (blocked) return json({ error: blocked, code: 'NEEDS_PASSWORD' }, 409)
  }

  const check = await checkEmployeePin(supabase, employee, pin, 'clock')
  if (!check.ok) return json({ error: check.error, code: check.code }, check.status)
  if (same) return json({ same: true })

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink', email: employee.user.email,
  })
  if (linkError || !link?.properties?.hashed_token) {
    return json({ error: `Couldn't switch cashiers: ${linkError?.message ?? 'no sign-in token'}. Sign in with a password instead.` }, 502)
  }
  console.log('Register cashier switch:', dbUser.email, '→', employee.user.email)
  return json({ tokenHash: link.properties.hashed_token, email: employee.user.email })
}
