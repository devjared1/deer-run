// Signed links in golfer emails, so a guest (no account) can manage their own booking or leave the waitlist:
//   /booking/<id>?t=<token>   (manage: change or cancel)
//   /waitlist/<id>?t=<token>  (take me off the waitlist)
// The token is an HMAC of "<purpose>:<id>" with BOOKING_LINK_SECRET (falls back to the service role key, which is
// always set and never leaves the server), so links can't be made up for other bookings. They don't expire: the
// booking's own rules (24 hours before the tee time, not checked in…) decide what the link can still do.

const encoder = new TextEncoder()

async function hmac(env, message) {
  const secret = env.BOOKING_LINK_SECRET || env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No secret to sign links with')
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32)
}

/** The token for a link: purpose 'booking' or 'waitlist'. */
export function linkToken(env, purpose, id) {
  return hmac(env, `${purpose}:${id}`)
}

/** True when `token` is the right one for this purpose and id (compared in constant time). */
export async function verifyLinkToken(env, purpose, id, token) {
  if (typeof token !== 'string' || !token || !id) return false
  const expected = await hmac(env, `${purpose}:${id}`)
  if (expected.length !== token.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0
}

/** The site's origin for links in emails: SITE_URL if set, else the origin the request came in on. */
export function siteOrigin(env, request) {
  return (env.SITE_URL || (request ? new URL(request.url).origin : 'https://deerrun.golf')).replace(/\/$/, '')
}

/** "https://deerrun.golf/booking/<id>?t=<token>" */
export async function manageBookingUrl(env, origin, bookingId) {
  return `${origin}/booking/${bookingId}?t=${await linkToken(env, 'booking', bookingId)}`
}

/** "https://deerrun.golf/waitlist/<id>?t=<token>" (leave the waitlist) */
export async function waitlistLeaveUrl(env, origin, entryId) {
  return `${origin}/waitlist/${entryId}?t=${await linkToken(env, 'waitlist', entryId)}`
}
