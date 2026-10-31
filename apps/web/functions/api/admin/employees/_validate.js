import { toUtcIso } from '../../../../src/lib/timeclock.js'

// Must match the EmployeePosition enum in apps/api/prisma/schema.prisma
export const POSITIONS = [
  'GENERAL_MANAGER',
  'HEAD_GOLF_PROFESSIONAL',
  'ASSISTANT_GOLF_PROFESSIONAL',
  'PRO_SHOP_ATTENDANT',
  'STARTER',
  'PLAYER_ASSISTANT',
  'OUTSIDE_SERVICES',
  'SUPERINTENDENT',
  'ASSISTANT_SUPERINTENDENT',
  'GROUNDS_CREW',
  'EQUIPMENT_TECHNICIAN',
  'FOOD_BEVERAGE_MANAGER',
  'COOK',
  'SERVER',
  'BEVERAGE_CART_ATTENDANT',
]

export const EMPLOYEE_COLUMNS =
  'id, userId, firstName, lastName, email, phone, position, hourlyRateCents, hireDate, active, createdAt, managerPinHash, managerPinLockedUntil'

/** Employee for API responses: the PIN hash is replaced by whether one is set. */
export function serializeEmployee({ managerPinHash, managerPinLockedUntil, ...employee }) {
  const lockedUntil = managerPinLockedUntil ? new Date(toUtcIso(managerPinLockedUntil)) : null
  return { ...employee, hasManagerPin: !!managerPinHash, managerPinLocked: !!lockedUntil && lockedUntil > new Date() }
}

// Clears a manager's PIN so they can set a new one (forgotten PIN or lockout)
export const RESET_MANAGER_PIN = { managerPinHash: null, managerPinFailedAttempts: 0, managerPinLockedUntil: null }

/**
 * Validates and normalizes an employee payload.
 * With partial = true (updates), only the fields present in body are validated and returned.
 * Returns { data } on success or { error } with a message.
 */
export function parseEmployee(body, { partial = false } = {}) {
  const data = {}
  const has = (f) => body[f] !== undefined

  for (const f of ['firstName', 'lastName', 'email']) {
    if (!has(f)) {
      if (!partial) return { error: 'firstName, lastName, email and position are required' }
      continue
    }
    const value = String(body[f] ?? '').trim()
    if (!value) return { error: `${f} cannot be empty` }
    data[f] = value
  }
  if (data.email !== undefined) {
    data.email = data.email.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: 'email is not valid' }
  }

  if (has('position')) {
    if (!POSITIONS.includes(body.position)) return { error: 'position is not valid' }
    data.position = body.position
  } else if (!partial) {
    return { error: 'firstName, lastName, email and position are required' }
  }

  if (has('phone')) data.phone = body.phone ? String(body.phone).trim() : null

  if (has('hourlyRateCents')) {
    if (body.hourlyRateCents === null || body.hourlyRateCents === '') {
      data.hourlyRateCents = null
    } else {
      const cents = Number(body.hourlyRateCents)
      if (!Number.isInteger(cents) || cents < 0) return { error: 'hourlyRateCents must be a whole number of cents' }
      data.hourlyRateCents = cents
    }
  }

  if (has('hireDate')) {
    if (!body.hireDate) {
      data.hireDate = null
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body.hireDate)) {
      return { error: 'hireDate must be YYYY-MM-DD' }
    } else {
      data.hireDate = body.hireDate
    }
  }

  if (has('active')) data.active = Boolean(body.active)

  return { data }
}

/**
 * Finds the login (User) with this email so the employee can sign in to the staff portal.
 * Exact match: Supabase Auth stores emails lowercased, and parseEmployee lowercases too.
 */
export async function findUserIdByEmail(supabase, email) {
  const { data } = await supabase.from('User').select('id').eq('email', email).maybeSingle()
  return data?.id ?? null
}

/** Maps Postgres constraint errors to friendly 409 messages. */
export function constraintMessage(error) {
  if (error?.code === '23505') {
    if (error.message.includes('userId')) return 'That login account is already linked to another employee'
    return 'An employee with that email already exists'
  }
  if (error?.code === '23503') {
    return 'This employee has time clock or sales history and cannot be deleted. Deactivate them instead.'
  }
  return null
}
