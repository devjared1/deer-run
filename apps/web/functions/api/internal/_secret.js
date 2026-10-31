import { json } from '../admin/_auth.js'

/** Constant-time comparison so the secret can't be guessed one character at a time */
function safeEqual(a, b) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

/** Checks Authorization: Bearer <CRON_SECRET>. Returns a 401/503 Response, or null when it matches. */
export function requireCronSecret(request, env) {
  if (!env.CRON_SECRET) return json({ error: 'CRON_SECRET is not set' }, 503)
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ') || !safeEqual(auth.slice(7), env.CRON_SECRET)) return json({ error: 'Unauthorized' }, 401)
  return null
}
