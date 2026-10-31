import { authenticate, json } from '../admin/_auth.js'

/**
 * Returns { supabase, dbUser, employee } if the caller's login is linked to an active
 * Employee record, or a 401/403 Response if not. Admins without an employee record
 * are refused too: the time clock and schedule are per employee.
 */
export async function requireStaff(request, env) {
  const result = await authenticate(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  const { data: employee } = await supabase
    .from('Employee')
    .select('*')
    .eq('userId', dbUser.id)
    .maybeSingle()

  if (!employee || !employee.active) return json({ error: 'Staff access required' }, 403)

  return { supabase, dbUser, employee }
}

/**
 * What an employee may do at the register, from the position lists in CourseSettings.
 * Admins can always use the register (if they have an employee record).
 */
export async function registerAccess(supabase, dbUser, employee) {
  if (!employee?.active) return { canUseRegister: false, isRegisterManager: false }
  const { data: settings } = await supabase
    .from('CourseSettings')
    .select('registerPositions, managerPositions')
    .eq('id', 'singleton')
    .maybeSingle()
  const isRegisterManager = (settings?.managerPositions ?? []).includes(employee.position)
  return {
    canUseRegister: dbUser.role === 'ADMIN' || isRegisterManager || (settings?.registerPositions ?? []).includes(employee.position),
    isRegisterManager,
  }
}

/** True if the position is one of CourseSettings.managerPositions. */
export async function isManagerPosition(supabase, position) {
  const { data } = await supabase.from('CourseSettings').select('managerPositions').eq('id', 'singleton').maybeSingle()
  return (data?.managerPositions ?? []).includes(position)
}

/** requireStaff + the employee's position must be allowed to use the register. */
export async function requireRegister(request, env) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const access = await registerAccess(result.supabase, result.dbUser, result.employee)
  if (!access.canUseRegister) return json({ error: 'Your position is not set up to use the register' }, 403)
  return { ...result, ...access }
}
