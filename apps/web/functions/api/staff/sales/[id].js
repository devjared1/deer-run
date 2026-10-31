import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { loadSale, emailReceipt } from './_sale.js'
import { consumeApproval } from '../_approvals.js'
import { localDate } from '../../../../src/lib/timeclock.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/staff/sales/:id — a sale with items, payments and refunds (for receipts and refunds)
export async function onRequestGet({ request, env, params }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result

  try {
    const sale = await loadSale(result.supabase, params.id)
    return sale ? json(sale) : json({ error: 'Sale not found' }, 404)
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/staff/sales/:id
//   { action: 'email', email }
//   { action: 'void', approvalId, reason, registerId }                       whole sale, same day only
//   { action: 'refund', approvalId, reason, registerId, items: [{ saleItemId, quantity }], restock }
// Voids and refunds need a manager approval (POST /api/staff/approvals) for that action.
export async function onRequestPost({ request, env, params }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (body.action === 'email') return sendReceipt(result, env, params.id, body)
  if (body.action === 'void' || body.action === 'refund') return refund(result, params.id, body)
  return json({ error: 'Unknown action' }, 400)
}

async function sendReceipt({ supabase }, env, saleId, body) {
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) return json({ error: 'Email is not valid' }, 400)

  const sale = await loadSale(supabase, saleId)
  if (!sale) return json({ error: 'Sale not found' }, 404)

  const error = await emailReceipt(env, sale, email)
  return error ? json({ error }, 502) : json({ success: true })
}

async function refund({ supabase, dbUser, employee }, saleId, body) {
  const isVoid = body.action === 'void'
  const sale = await loadSale(supabase, saleId)
  if (!sale) return json({ error: 'Sale not found' }, 404)

  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''
  if (!reason) return json({ error: 'Enter a reason' }, 400)

  const { data: register } = await supabase.from('Register').select('id, active').eq('id', body.registerId ?? '').maybeSingle()
  if (!register?.active) return json({ error: 'Choose a register' }, 400)

  // Money goes back the way it came. Only cash exists today; card refunds arrive with Stripe Terminal.
  if (sale.payments.some(p => p.method !== 'CASH')) {
    return json({ error: 'This sale wasn\'t paid in cash. Card and account refunds aren\'t available yet.' }, 409)
  }

  let items
  if (isVoid) {
    if (sale.status !== 'COMPLETED' || sale.refunds.length) {
      return json({ error: 'Only a sale with no refunds can be voided. Use Refund instead.' }, 409)
    }
    if (localDate(sale.createdAt) !== localDate()) {
      return json({ error: 'Sales can only be voided on the day they were rung up. Use Refund instead.' }, 409)
    }
    items = sale.items.map(i => ({ saleItemId: i.id, quantity: i.quantity }))
  } else {
    if (!Array.isArray(body.items) || !body.items.length) return json({ error: 'Choose at least one item to refund' }, 400)
    items = body.items.map(i => ({ saleItemId: String(i.saleItemId ?? ''), quantity: Number(i.quantity) }))
    if (items.some(i => !Number.isInteger(i.quantity) || i.quantity < 1)) return json({ error: 'Quantities must be whole numbers' }, 400)
  }

  // Check before using up the approval (refund_sale re-checks under a lock)
  if (sale.status === 'VOIDED' || sale.status === 'REFUNDED') return json({ error: 'This sale has already been fully refunded' }, 409)
  const lines = Object.fromEntries(sale.items.map(i => [i.id, i]))
  for (const i of items) {
    const line = lines[i.saleItemId]
    if (!line) return json({ error: 'That item is not part of this sale' }, 400)
    if (i.quantity > line.quantity - line.refundedQuantity) {
      return json({ error: `${line.description}: only ${line.quantity - line.refundedQuantity} can still be refunded` }, 409)
    }
  }

  const approval = await consumeApproval(supabase, body.approvalId, {
    action: isVoid ? 'VOID' : 'REFUND',
    cashierId: employee.id,
    saleId: sale.id,
  })
  if (!approval) {
    return json({ error: `A manager needs to approve this ${isVoid ? 'void' : 'refund'}, and the approval may have expired. Approve it again.`, code: 'APPROVAL_REQUIRED' }, 403)
  }

  const { data: refunded, error } = await supabase.rpc('refund_sale', {
    p_refund: {
      saleId: sale.id,
      kind: isVoid ? 'VOID' : 'REFUND',
      method: 'CASH',
      reason,
      restock: isVoid ? true : Boolean(body.restock),
      approvalId: approval.id,
      cashierId: employee.id,
      registerId: register.id,
      userId: dbUser.id,
    },
    p_items: items,
  })
  // P0001 = RAISE EXCEPTION in refund_sale (already refunded, quantity too high, …)
  if (error) return json({ error: error.message }, error.code === 'P0001' ? 409 : 500)

  return json({ refund: refunded, sale: await loadSale(supabase, sale.id) })
}
