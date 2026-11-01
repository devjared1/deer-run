import { json } from '../admin/_auth.js'
import { requireKiosk } from './_auth.js'
import { pinLockedUntil } from '../staff/_pin.js'

// GET /api/kiosk/employees (X-Kiosk-Token) — the list employees pick their name from on the time clock kiosk.
// → { kiosk: { id, name }, serverTime, employees: [{ id, firstName, lastName, position, status: 'off' | 'on' | 'break',
//     hasPin, pinLocked }] } (active employees, by first name). No pay rates, emails or hashes.
export async function onRequestGet({ request, env }) {
  const result = await requireKiosk(request, env)
  if (result instanceof Response) return result
  const { supabase, kiosk } = result

  const [{ data: employees, error }, { data: open, error: openError }] = await Promise.all([
    supabase
      .from('Employee')
      .select('id, firstName, lastName, position, clockPinHash, clockPinLockedUntil')
      .eq('active', true)
      .order('firstName')
      .order('lastName'),
    supabase
      .from('TimeEntry')
      .select('employeeId, breaks:TimeBreak(endedAt)')
      .is('clockOut', null),
  ])
  if (error || openError) return json({ error: (error || openError).message }, 500)

  const statusOf = new Map((open || []).map(e => [e.employeeId, e.breaks.some(b => !b.endedAt) ? 'break' : 'on']))
  return json({
    kiosk,
    serverTime: new Date().toISOString(),
    employees: (employees || []).map(e => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      position: e.position,
      status: statusOf.get(e.id) ?? 'off',
      hasPin: !!e.clockPinHash,
      pinLocked: !!pinLockedUntil(e, 'clock'),
    })),
  })
}
