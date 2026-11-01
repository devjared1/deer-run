import { requireAdmin, json } from '../_auth.js'
import { hashKioskToken, newKioskToken } from '../../kiosk/_auth.js'
import { toUtcIso } from '../../../../src/lib/timeclock.js'

const MAX_NAME = 60

export function serializeKiosk(k) {
  return { id: k.id, name: k.name, createdAt: toUtcIso(k.createdAt), lastSeenAt: toUtcIso(k.lastSeenAt) }
}

// GET /api/admin/kiosks → [{ id, name, createdAt, lastSeenAt }] time clock devices (Admin → Settings → Payroll)
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { data, error } = await result.supabase.from('ClockKiosk').select('id, name, createdAt, lastSeenAt').order('createdAt')
  if (error) return json({ error: error.message }, 500)
  return json(data.map(serializeKiosk))
}

// POST /api/admin/kiosks { name } — set up the device the admin is on as a time clock (from /timeclock).
// → 201 { kiosk, token }: the device keeps the token (localStorage); it isn't stored or shown again.
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const name = String(body?.name ?? '').trim().slice(0, MAX_NAME)
  if (!name) return json({ error: 'Give the time clock a name, like "Pro shop iPad"' }, 400)

  const token = newKioskToken()
  const { data, error } = await supabase
    .from('ClockKiosk')
    .insert({ id: crypto.randomUUID(), name, tokenHash: await hashKioskToken(token), createdById: dbUser.id })
    .select('id, name, createdAt, lastSeenAt')
    .single()
  if (error) return json({ error: error.message }, 500)
  return json({ kiosk: serializeKiosk(data), token }, 201)
}
