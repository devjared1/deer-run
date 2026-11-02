// Who can take over a locked register (GET /api/staff/register/cashiers, POST /api/staff/register/switch): active
// employees whose position can use the register (CourseSettings.registerPositions or managerPositions) with a linked
// login. Admin logins can't be unlocked with a PIN (a short PIN shouldn't open the admin panel): they sign in with
// their password, so they're listed with needsPassword.

export const CASHIER_COLUMNS =
  'id, firstName, lastName, position, active, userId, clockPinHash, clockPinFailedAttempts, clockPinLockedUntil, ' +
  'user:User(id, email, role)'

/** Positions that can use the register. */
export async function registerPositions(supabase) {
  const { data, error } = await supabase.from('CourseSettings').select('registerPositions, managerPositions')
    .eq('id', 'singleton').maybeSingle()
  if (error) throw new Error(error.message)
  return [...new Set([...(data?.registerPositions ?? []), ...(data?.managerPositions ?? [])])]
}

/** The employee can take over the register by PIN (else the reason). */
export function pinSwitchBlocker(employee, positions) {
  if (!employee?.active) return 'That employee isn\'t active.'
  if (!employee.user?.email) return `${employee.firstName} has no sign-in yet. An admin links one in Admin → Employees.`
  if (employee.user.role === 'ADMIN') return `${employee.firstName} signs in with a password (admin account).`
  if (!positions.includes(employee.position)) return `${employee.firstName}'s position doesn't use the register.`
  return null
}
