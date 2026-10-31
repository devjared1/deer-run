import { json } from '../admin/_auth.js'
import { requireRegister, isManagerPosition } from './_auth.js'
import { checkManagerPin, MANAGER_PIN_COLUMNS } from './_pin.js'
import { APPROVAL_ACTIONS, approvalTimes } from './_approvals.js'

// POST /api/staff/approvals — { action, registerId?, managerId?, pin?, reason? }
// action: DISCOUNT | NO_SALE | VOID | REFUND | CHANGE_REGISTER | PAID_IN | PAID_OUT | SAFE_DROP
// A manager signs off on a register action. If the signed-in cashier is a manager and no PIN is
// given, they approve it themselves; otherwise the chosen manager's PIN is checked.
// Returns { approvalId, approverName, expiresAt }; the action endpoint then uses approvalId.
export async function onRequestPost({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, employee, isRegisterManager } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { action, managerId, pin } = body
  if (!APPROVAL_ACTIONS.includes(action)) return json({ error: 'Unknown action' }, 400)
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 200) : null

  let approver
  if (!pin) {
    if (!isRegisterManager) return json({ error: 'A manager needs to approve this' }, 403)
    approver = employee
  } else {
    const { data: manager } = await supabase.from('Employee').select(MANAGER_PIN_COLUMNS).eq('id', managerId ?? '').maybeSingle()
    if (!manager?.active || !(await isManagerPosition(supabase, manager.position))) {
      return json({ error: 'Choose a manager' }, 400)
    }
    const check = await checkManagerPin(supabase, manager, pin)
    if (!check.ok) return json({ error: check.error }, check.status)
    approver = manager
  }

  let registerId = null
  if (body.registerId) {
    const { data: register } = await supabase.from('Register').select('id').eq('id', body.registerId).maybeSingle()
    registerId = register?.id ?? null
  }

  const id = crypto.randomUUID()
  const times = approvalTimes(action)
  const { error } = await supabase.from('ManagerApproval').insert({
    id,
    action,
    approverId: approver.id,
    cashierId: employee.id,
    registerId,
    reason,
    ...times,
  })
  if (error) return json({ error: error.message }, 500)

  return json({ approvalId: id, approverName: `${approver.firstName} ${approver.lastName}`, expiresAt: times.expiresAt }, 201)
}
