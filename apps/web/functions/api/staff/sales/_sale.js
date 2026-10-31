import { Resend } from 'resend'
import { toUtcIso, COURSE_TZ } from '../../../../src/lib/timeclock.js'

// Foreign keys are named explicitly: several tables link sales, employees and registers
export const SALE_SELECT =
  '*, items:SaleItem!SaleItem_saleId_fkey(*), payments:Payment(*), register:Register!Sale_registerId_fkey(name), ' +
  'cashier:Employee!Sale_cashierId_fkey(firstName, lastName), customer:User(name, email, role), ' +
  'refunds:SaleRefund!SaleRefund_saleId_fkey(*, items:SaleRefundItem(*), cashier:Employee!SaleRefund_cashierId_fkey(firstName, lastName), ' +
  'approval:ManagerApproval!SaleRefund_approvalId_fkey(approver:Employee!ManagerApproval_approverId_fkey(firstName, lastName)))'

export const PAYMENT_LABELS = {
  CASH: 'Cash',
  CARD_TERMINAL: 'Card',
  HOUSE_ACCOUNT: 'House account',
  PREPAID_ONLINE: 'Paid online',
  GIFT_CARD: 'Gift card',
}

/** A sale with items and payments, for receipts. Returns null if not found. */
export async function loadSale(supabase, id) {
  const { data, error } = await supabase.from('Sale').select(SALE_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    ...data,
    createdAt: toUtcIso(data.createdAt),
    items: [...data.items].sort((a, b) => a.sortOrder - b.sortOrder),
    payments: data.payments.map(p => ({ ...p, createdAt: toUtcIso(p.createdAt) })),
    refunds: (data.refunds || [])
      .map(r => ({ ...r, createdAt: toUtcIso(r.createdAt) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }
}

const money = (cents) => `$${(cents / 100).toFixed(2)}`

/** Tips added on the card reader (Payment.tipCents): charged on top of the sale total, not part of it. */
export function saleTipCents(sale) {
  return (sale.payments || []).reduce((sum, p) => sum + (p.tipCents ?? 0), 0)
}

/** Plain-text receipt for email. */
export function receiptText(sale) {
  const when = new Date(sale.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
  })
  const lines = [
    'Deer Run Golf Course',
    '1175 County Road 100, Moulton, AL 35650',
    '(256) 974-7384',
    '',
    `Receipt #${sale.number} · ${when}`,
    '',
  ]
  for (const item of sale.items) {
    lines.push(`${item.quantity} × ${item.description}  ${money(item.unitPriceCents * item.quantity)}`)
    // discountCents is the member and manager discounts together (memberDiscountCents: the member part)
    const member = item.memberDiscountCents ?? 0
    if (member) lines.push(`    Member discount  -${money(member)}`)
    if (item.discountCents - member) lines.push(`    Discount  -${money(item.discountCents - member)}`)
  }
  lines.push('', `Subtotal  ${money(sale.subtotalCents)}`, `Tax  ${money(sale.taxCents)}`, `Total  ${money(sale.totalCents)}`, '')
  for (const p of sale.payments) {
    lines.push(`${PAYMENT_LABELS[p.method] ?? p.method}  ${money(p.tenderedCents ?? p.amountCents)}`)
  }
  if (sale.changeCents) lines.push(`Change  ${money(sale.changeCents)}`)
  const tip = saleTipCents(sale)
  if (tip) lines.push(`Tip  ${money(tip)}`, `Total with tip  ${money(sale.totalCents + tip)}`)
  lines.push('', 'Thank you for visiting Deer Run!')
  return lines.join('\n')
}

/** Emails the receipt. Returns an error message, or null on success. */
export async function emailReceipt(env, sale, to) {
  if (!env.RESEND_API_KEY) return 'Email is not configured'
  try {
    const resend = new Resend(env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'noreply@deerrun.golf',
      to,
      subject: `Your Deer Run receipt #${sale.number}`,
      text: receiptText(sale),
    })
    return error ? error.message : null
  } catch (e) {
    return e.message
  }
}
