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
export const CLOCK_PIN_COLUMNS = 'id, firstName, lastName, position, active, clockPinHash, clockPinFailedAttempts, clockPinLockedUntil'

// The two kinds of employee PIN: the register manager PIN (approvals) and the time clock PIN (the kiosk). Each has
// its own hash and lockout columns.
const PIN_KINDS = {
  manager: {
    hash: 'managerPinHash', attempts: 'managerPinFailedAttempts', lockedUntil: 'managerPinLockedUntil',
    missing: e => `${e.firstName} hasn't set a manager PIN yet (Staff → Manager PIN)`,
  },
  clock: {
    hash: 'clockPinHash', attempts: 'clockPinFailedAttempts', lockedUntil: 'clockPinLockedUntil',
    missing: e => `${e.firstName} doesn't have a time clock PIN yet. Set one in the staff portal (Time Clock), or ask a manager.`,
  },
}

/** Clears a PIN and its lockout: { managerPinHash: null, … } for kind 'manager' or 'clock'. */
export function resetPinFields(kind) {
  const k = PIN_KINDS[kind]
  return { [k.hash]: null, [k.attempts]: 0, [k.lockedUntil]: null }
}

/** Sets a new PIN (and clears any lockout). */
export async function newPinFields(kind, pin) {
  return { ...resetPinFields(kind), [PIN_KINDS[kind].hash]: await hashPin(pin) }
}

/** The lockout end (ISO) if the PIN is locked right now, else null. */
export function pinLockedUntil(employee, kind) {
  const raw = employee[PIN_KINDS[kind].lockedUntil]
  const until = raw ? toUtcIso(raw) : null
  return until && new Date(until) > new Date() ? until : null
}

/**
 * Checks an employee's PIN, counting wrong tries and locking the PIN for 15 minutes after 5.
 * `employee` must include MANAGER_PIN_COLUMNS / CLOCK_PIN_COLUMNS for the kind. Returns { ok: true } or
 * { error, status, code } (code: PIN_NOT_SET, PIN_LOCKED or PIN_WRONG).
 */
export async function checkEmployeePin(supabase, employee, pin, kind) {
  const k = PIN_KINDS[kind]
  const now = new Date()
  const lockedUntil = employee[k.lockedUntil] ? new Date(toUtcIso(employee[k.lockedUntil])) : null
  if (lockedUntil && lockedUntil > now) {
    const until = lockedUntil.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
    return { error: `${employee.firstName}'s PIN is locked after too many wrong tries. Try again after ${until}.`, status: 423, code: 'PIN_LOCKED' }
  }
  if (!employee[k.hash]) return { error: k.missing(employee), status: 400, code: 'PIN_NOT_SET' }

  const ok = PIN_PATTERN.test(String(pin ?? '')) && await verifyPinHash(String(pin), employee[k.hash])
  if (ok) {
    if (employee[k.attempts] || employee[k.lockedUntil]) {
      await supabase.from('Employee').update({ [k.attempts]: 0, [k.lockedUntil]: null }).eq('id', employee.id)
    }
    return { ok: true }
  }

  const attempts = (employee[k.attempts] ?? 0) + 1
  if (attempts >= MAX_ATTEMPTS) {
    await supabase
      .from('Employee')
      .update({ [k.attempts]: 0, [k.lockedUntil]: new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString() })
      .eq('id', employee.id)
    return { error: `Wrong PIN. ${employee.firstName}'s PIN is now locked for ${LOCK_MINUTES} minutes.`, status: 403, code: 'PIN_LOCKED' }
  }
  await supabase.from('Employee').update({ [k.attempts]: attempts }).eq('id', employee.id)
  const left = MAX_ATTEMPTS - attempts
  return { error: `Wrong PIN (${left} ${left === 1 ? 'try' : 'tries'} left)`, status: 403, code: 'PIN_WRONG' }
}

/** checkEmployeePin for the register manager PIN. `manager` must include MANAGER_PIN_COLUMNS. */
export function checkManagerPin(supabase, manager, pin) {
  return checkEmployeePin(supabase, manager, pin, 'manager')
}
