import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { loadSale, emailReceipt } from './_sale.js'
import { refundMembership } from './_save.js'
import { consumeApproval } from '../_approvals.js'
import { localDate } from '../../../../src/lib/timeclock.js'
import { openSession } from '../_drawer.js'
import { makeStripe, stripeMessage } from '../_stripe.js'
import { refundForLine } from '../../../../src/lib/pricing.js'

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
//   Both take method: 'CARD_TERMINAL' | 'HOUSE_ACCOUNT' | 'CASH' (default: the way the sale was paid).
//   Card refunds go back through Stripe, account refunds credit the account (refund_sale writes the entry), each up
//   to what was paid that way; cash needs the drawer open.
// Voids and refunds need a manager approval (POST /api/staff/approvals) for that action.
// Returns { refund, sale, warnings, memberUntil? }. Refunded membership lines take their months back off the
// customer (memberUntil: the new last day); if that fails the refund still stands and warnings says so.
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
  if (body.action === 'void' || body.action === 'refund') return refund(result, env, params.id, body)
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

const money = (cents) => `$${(cents / 100).toFixed(2)}`

/**
 * The sale's card payment and how much of it can still be refunded to the card. Only the sale's share
 * (amountCents): a tip added on the reader (tipCents) is never refunded here, even on a void; refund it in the
 * Stripe Dashboard if it really has to go back (the reports will still count it).
 */
export function cardRefundable(sale) {
  const payment = sale.payments.find(p => p.method === 'CARD_TERMINAL') ?? null
  const refunded = (sale.refunds || []).filter(r => r.method === 'CARD_TERMINAL').reduce((sum, r) => sum + r.amountCents, 0)
  return { payment, availableCents: payment ? Math.max(0, payment.amountCents - refunded) : 0 }
}

// Payment types the register can refund (each goes back the way it was paid)
const REFUND_METHODS = ['CASH', 'CARD_TERMINAL', 'HOUSE_ACCOUNT']

/** How much paid with `method` hasn't been refunded that way yet. */
export function methodRefundable(sale, method) {
  const paid = sale.payments.filter(p => p.method === method).reduce((sum, p) => sum + p.amountCents, 0)
  const refunded = (sale.refunds || []).filter(r => r.method === method).reduce((sum, r) => sum + r.amountCents, 0)
  return Math.max(0, paid - refunded)
}

/** How much of the sale's cash payment hasn't been refunded yet. */
export function cashRefundable(sale) {
  return methodRefundable(sale, 'CASH')
}

/** What refund_sale() will return for these lines (refundForLine mirrors its per-line formula). */
export function refundAmount(sale, items) {
  const lines = Object.fromEntries(sale.items.map(i => [i.id, i]))
  return items.reduce((sum, { saleItemId, quantity }) => sum + refundForLine(lines[saleItemId], quantity).amountCents, 0)
}

async function refund({ supabase, dbUser, employee }, env, saleId, body) {
  const isVoid = body.action === 'void'
  const sale = await loadSale(supabase, saleId)
  if (!sale) return json({ error: 'Sale not found' }, 404)

  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''
  if (!reason) return json({ error: 'Enter a reason' }, 400)

  const { data: register } = await supabase.from('Register').select('id, active').eq('id', body.registerId ?? '').maybeSingle()
  if (!register?.active) return json({ error: 'Choose a register' }, 400)

  // Money goes back the way it came: to the card (through Stripe) or in cash (out of the drawer)
  if (sale.payments.some(p => !REFUND_METHODS.includes(p.method))) {
    return json({ error: 'This sale has a payment type the register can\'t refund yet. Refund it from the admin panel.' }, 409)
  }
  const card = cardRefundable(sale)
  const onAccount = methodRefundable(sale, 'HOUSE_ACCOUNT')
  const method = body.method ?? (card.availableCents > 0 ? 'CARD_TERMINAL' : onAccount > 0 ? 'HOUSE_ACCOUNT' : 'CASH')
  if (!REFUND_METHODS.includes(method)) return json({ error: 'Refund method must be cash, card or house account' }, 400)
  if (method === 'CARD_TERMINAL' && !card.payment) return json({ error: 'This sale wasn\'t paid by card' }, 400)
  if (method === 'CASH' && !(await openSession(supabase, register.id))) {
    return json({ error: 'Open the cash drawer first (count the starting cash), then give the refund.', code: 'DRAWER_CLOSED' }, 409)
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

  // Card refunds can't send back more than is left of the card payment (split sales: refund the rest in cash)
  const amountCents = refundAmount(sale, items)
  if (isVoid && method === 'CARD_TERMINAL' && amountCents > card.availableCents) {
    return json({ error: 'Part of this sale was paid in cash. Use Refund twice: some items to the card, the rest in cash.' }, 409)
  }
  if (method === 'CARD_TERMINAL' && amountCents > card.availableCents) {
    return json({
      error: card.availableCents
        ? `Only ${money(card.availableCents)} can go back to the card. Refund fewer items to the card and the rest in cash.`
        : 'The card payment has already been refunded in full. Refund in cash.',
    }, 409)
  }

  // Account sales go back to the account, as a credit, up to what was charged to it
  if (method === 'HOUSE_ACCOUNT' && amountCents > onAccount) {
    return json({
      error: onAccount
        ? `Only ${money(onAccount)} can go back to the house account. Refund fewer items to the account.`
        : 'This sale wasn\'t charged to a house account',
    }, 409)
  }

  // Likewise, cash refunds only give back what was paid in cash (a card sale goes back to the card)
  const cash = cashRefundable(sale)
  if (method === 'CASH' && amountCents > cash) {
    return json({
      error: cash
        ? `Only ${money(cash)} was paid in cash. Refund fewer items in cash and the rest to the card.`
        : 'This sale was paid by card. Refund it to the card.',
    }, 409)
  }

  const approval = await consumeApproval(supabase, body.approvalId, {
    action: isVoid ? 'VOID' : 'REFUND',
    cashierId: employee.id,
    saleId: sale.id,
  })
  if (!approval) {
    return json({ error: `A manager needs to approve this ${isVoid ? 'void' : 'refund'}, and the approval may have expired. Approve it again.`, code: 'APPROVAL_REQUIRED' }, 403)
  }

  // Card: return the money through Stripe first (idempotent per approval), then record it. If Stripe refuses,
  // the approval is released so the cashier can try again without asking the manager twice.
  let stripeRefundId = null
  if (method === 'CARD_TERMINAL') {
    const stripe = makeStripe(env)
    if (!stripe) return json({ error: 'Card refunds aren\'t set up (STRIPE_SECRET_KEY)' }, 503)
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: card.payment.stripePaymentIntentId, amount: amountCents, metadata: { saleId: sale.id, approvalId: approval.id } },
        { idempotencyKey: `sale-refund-${approval.id}` },
      )
      stripeRefundId = refund.id
    } catch (e) {
      await supabase.from('ManagerApproval').update({ usedAt: null }).eq('id', approval.id)
      return json({ error: `The card refund didn't go through: ${stripeMessage(e)}` }, 502)
    }
  }

  const { data: refunded, error } = await supabase.rpc('refund_sale', {
    p_refund: {
      saleId: sale.id,
      kind: isVoid ? 'VOID' : 'REFUND',
      method,
      stripeRefundId,
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
  if (error) {
    if (stripeRefundId) {
      return json({ error: `The card was refunded ${money(amountCents)} in Stripe (${stripeRefundId}), but the refund didn't save here: ${error.message}. Tell a manager.` }, 500)
    }
    return json({ error: error.message }, error.code === 'P0001' ? 409 : 500)
  }

  // Like the purchase, the membership change is a follow-up: the refund (and the money) is already done
  const warnings = []
  const membership = await refundMembership(supabase, sale, items, localDate())
  if (membership?.error) warnings.push(`The membership wasn't shortened: ${membership.error}. Update the customer in Admin → Users.`)

  return json({
    refund: refunded,
    sale: await loadSale(supabase, sale.id),
    warnings,
    ...(membership?.memberUntil ? { memberUntil: membership.memberUntil } : {}),
  })
}
