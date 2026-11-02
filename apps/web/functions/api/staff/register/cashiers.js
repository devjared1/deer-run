import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { pinLockedUntil } from '../_pin.js'
import { CASHIER_COLUMNS, registerPositions } from './_cashiers.js'

// GET /api/staff/register/cashiers — the register's lock screen: who can take over this register.
// → { currentEmployeeId, employees: [{ id, firstName, lastName, position, status: 'off' | 'on' | 'break', hasPin,
//     pinLocked, needsPassword }] } (register positions with a sign-in, by first name; admins need their password)
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, employee: current } = result

  let positions
  try {
    positions = await registerPositions(supabase)
  } catch (e) {
    return json({ error: e.message }, 500)
  }

  const [{ data: employees, error }, { data: open, error: openError }] = await Promise.all([
    supabase.from('Employee').select(CASHIER_COLUMNS)
      .eq('active', true).not('userId', 'is', null)
      .order('firstName').order('lastName'),
    supabase.from('TimeEntry').select('employeeId, breaks:TimeBreak(endedAt)').is('clockOut', null),
  ])
  if (error || openError) return json({ error: (error || openError).message }, 500)

  const statusOf = new Map((open || []).map(e => [e.employeeId, e.breaks.some(b => !b.endedAt) ? 'break' : 'on']))
  const list = (employees || [])
    .filter(e => e.user?.email && (positions.includes(e.position) || e.user.role === 'ADMIN' || e.id === current.id))
    .map(e => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      position: e.position,
      status: statusOf.get(e.id) ?? 'off',
      hasPin: !!e.clockPinHash,
      pinLocked: !!pinLockedUntil(e, 'clock'),
      needsPassword: e.user.role === 'ADMIN',
    }))
  return json({ currentEmployeeId: current.id, employees: list })
}
