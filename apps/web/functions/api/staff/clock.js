import { json } from '../admin/_auth.js'
import { requireStaff } from './_auth.js'
import { clockStatus, recordPunch } from './_clock.js'

// GET /api/staff/clock — current state for the signed-in employee (see clockStatus in _clock.js), plus
// hasClockPin: whether they have a PIN for the time clock kiosk (/timeclock)
export async function onRequestGet({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  try {
    return json({ ...(await clockStatus(supabase, employee)), ...kioskPin(employee) })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/staff/clock { action: clock_in | clock_out | break_start | break_end }
// Always uses server time; the client never supplies timestamps.
export async function onRequestPost({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  try {
    const failed = await recordPunch(supabase, employee, body?.action)
    if (failed) return json({ error: failed.error }, failed.status)
    return json({ ...(await clockStatus(supabase, employee)), ...kioskPin(employee) })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// Before migration 13 there's no clockPinHash column: say nothing (the page then hides the PIN card)
function kioskPin(employee) {
  return 'clockPinHash' in employee ? { hasClockPin: !!employee.clockPinHash } : {}
}
