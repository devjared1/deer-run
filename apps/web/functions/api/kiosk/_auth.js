import { json, makeSupabase } from '../admin/_auth.js'
import { toUtcIso } from '../../../src/lib/timeclock.js'

// Time clock kiosks (an iPad at /timeclock). The device sends the token it got when an admin set it up
// (POST /api/admin/kiosks) in the X-Kiosk-Token header; only the token's SHA-256 hash is stored (ClockKiosk).
// Deleting the ClockKiosk row signs the device out (401 KIOSK_NOT_SET_UP: the page shows the set-up screen).

export const KIOSK_HEADER = 'X-Kiosk-Token'
const SEEN_EVERY_MS = 5 * 60_000

/** A new random device token: "dk_" + 32 random bytes, base64url. */
export function newKioskToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `dk_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

/** SHA-256 of the token, hex. */
export async function hashKioskToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Returns { supabase, kiosk } for a valid kiosk token, or a 401 Response. Records when the device was last seen. */
export async function requireKiosk(request, env) {
  const token = request.headers.get(KIOSK_HEADER)
  const notSetUp = json({ error: 'This device isn\'t set up as a time clock', code: 'KIOSK_NOT_SET_UP' }, 401)
  if (!token || !token.startsWith('dk_')) return notSetUp

  const supabase = makeSupabase(env)
  const { data: kiosk, error } = await supabase
    .from('ClockKiosk')
    .select('id, name, lastSeenAt')
    .eq('tokenHash', await hashKioskToken(token))
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!kiosk) return notSetUp

  const seen = kiosk.lastSeenAt ? Date.parse(toUtcIso(kiosk.lastSeenAt)) : 0
  if (Date.now() - seen > SEEN_EVERY_MS) {
    await supabase.from('ClockKiosk').update({ lastSeenAt: new Date().toISOString() }).eq('id', kiosk.id)
  }
  return { supabase, kiosk: { id: kiosk.id, name: kiosk.name } }
}
