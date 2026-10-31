import { toUtcIso, COURSE_TZ } from '../../../src/lib/timeclock.js'

export const PIN_PATTERN = /^\d{4,6}$/
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

// A 4–6 digit PIN has little entropy, so the protection is the lockout (5 tries per 15 minutes)
// and the hashes never leaving the server; the iteration count is kept modest to stay well
// inside the Workers CPU budget.
const ITERATIONS = 10000

const encoder = new TextEncoder()
const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(bits)
}

/** "pbkdf2$<iterations>$<salt>$<hash>" */
export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(await derive(pin, salt, ITERATIONS))}`
}

export async function verifyPinHash(pin, stored) {
  const [scheme, iterations, salt, hash] = String(stored).split('$')
  if (scheme !== 'pbkdf2' || !salt || !hash) return false
  const actual = await derive(pin, fromBase64(salt), Number(iterations))
  const expected = fromBase64(hash)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

export const MANAGER_PIN_COLUMNS = 'id, firstName, lastName, position, active, managerPinHash, managerPinFailedAttempts, managerPinLockedUntil'

/**
 * Checks a manager's PIN, counting wrong tries and locking the PIN for 15 minutes after 5.
 * `manager` must include MANAGER_PIN_COLUMNS. Returns { ok: true } or { error, status }.
 */
export async function checkManagerPin(supabase, manager, pin) {
  const now = new Date()
  const lockedUntil = manager.managerPinLockedUntil ? new Date(toUtcIso(manager.managerPinLockedUntil)) : null
  if (lockedUntil && lockedUntil > now) {
    const until = lockedUntil.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
    return { error: `${manager.firstName}'s PIN is locked after too many wrong tries. Try again after ${until}.`, status: 423 }
  }
  if (!manager.managerPinHash) {
    return { error: `${manager.firstName} hasn't set a manager PIN yet (Staff → Manager PIN)`, status: 400 }
  }

  const ok = PIN_PATTERN.test(String(pin ?? '')) && await verifyPinHash(String(pin), manager.managerPinHash)
  if (ok) {
    if (manager.managerPinFailedAttempts || manager.managerPinLockedUntil) {
      await supabase.from('Employee').update({ managerPinFailedAttempts: 0, managerPinLockedUntil: null }).eq('id', manager.id)
    }
    return { ok: true }
  }

  const attempts = manager.managerPinFailedAttempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    await supabase
      .from('Employee')
      .update({ managerPinFailedAttempts: 0, managerPinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString() })
      .eq('id', manager.id)
    return { error: `Wrong PIN. ${manager.firstName}'s PIN is now locked for ${LOCK_MINUTES} minutes.`, status: 403 }
  }
  await supabase.from('Employee').update({ managerPinFailedAttempts: attempts }).eq('id', manager.id)
  const left = MAX_ATTEMPTS - attempts
  return { error: `Wrong PIN (${left} ${left === 1 ? 'try' : 'tries'} left)`, status: 403 }
}
