// How long an approval stays usable. NO_SALE and CHANGE_REGISTER happen immediately, so those
// approvals are recorded as used when they're given. Drawer movements (paid in/out, safe drop) are used
// by POST /api/staff/register/drawer right after the approval.
const TTL_MINUTES = { DISCOUNT: 30, VOID: 10, REFUND: 10, NO_SALE: 0, CHANGE_REGISTER: 0, PAID_IN: 10, PAID_OUT: 10, SAFE_DROP: 10 }

export const APPROVAL_ACTIONS = Object.keys(TTL_MINUTES)

export function approvalTimes(action, now = new Date()) {
  const immediate = TTL_MINUTES[action] === 0
  return {
    expiresAt: new Date(now.getTime() + TTL_MINUTES[action] * 60000).toISOString(),
    usedAt: immediate ? now.toISOString() : null,
  }
}

/**
 * Marks an approval as used, in one conditional update so it can only be used once. It must be
 * for this action and cashier, unused and unexpired. Returns the approval or null.
 */
export async function consumeApproval(supabase, approvalId, { action, cashierId, saleId = null }) {
  if (!approvalId) return null
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('ManagerApproval')
    .update({ usedAt: now, ...(saleId ? { saleId } : {}) })
    .eq('id', approvalId)
    .eq('action', action)
    .eq('cashierId', cashierId)
    .is('usedAt', null)
    .gt('expiresAt', now)
    .select('id, approverId')
    .maybeSingle()
  return data
}
