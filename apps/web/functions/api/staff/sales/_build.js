import { unitPriceCents, priceLine, saleTotals, variantDescription } from '../../../../src/lib/pricing.js'

// Tenders the register accepts today. CARD_TERMINAL arrives with Stripe Terminal (POS Phase 3),
// HOUSE_ACCOUNT with house accounts (Phase 4).
export const ACCEPTED_METHODS = ['CASH']

const MAX_LINES = 100
const MAX_QUANTITY = 999
const MAX_CUSTOM_CENTS = 1_000_000 // $10,000

const isWholeNumber = (n, min, max) => Number.isInteger(n) && n >= min && n <= max

/**
 * Prices a sale on the server from the request and the current catalog. Pure: no database access.
 *   items:          [{ variantId, quantity, discountCents } | { custom: { description, priceCents }, quantity, discountCents }]
 *   variantsById:   variant rows with product and category embedded
 *   isMember:       member pricing applies
 *   taxBps:         course sales tax rate
 *   payments:       [{ method, tenderedCents }]
 *   expectedTotalCents: the total the register showed; must match so the customer pays what they saw
 * Returns { lines, totals, payments, changeCents } or { error, status }.
 */
export function buildSale({ items, variantsById, isMember, taxBps, payments, expectedTotalCents }) {
  if (!Array.isArray(items) || !items.length) return { error: 'The cart is empty', status: 400 }
  if (items.length > MAX_LINES) return { error: `A sale can have at most ${MAX_LINES} lines`, status: 400 }

  const lines = []
  for (const [i, item] of items.entries()) {
    const label = `Line ${i + 1}`
    const quantity = Number(item.quantity)
    if (!isWholeNumber(quantity, 1, MAX_QUANTITY)) return { error: `${label}: quantity must be 1–${MAX_QUANTITY}`, status: 400 }

    let line
    if (item.custom) {
      const description = String(item.custom.description ?? '').trim().slice(0, 100)
      const price = Number(item.custom.priceCents)
      if (!description) return { error: `${label}: a custom item needs a description`, status: 400 }
      if (!isWholeNumber(price, 1, MAX_CUSTOM_CENTS)) return { error: `${label}: custom price must be $0.01–$10,000`, status: 400 }
      line = { variantId: null, trackInventory: false, description, categoryName: null, unitPriceCents: price, taxRateBps: taxBps }
    } else {
      const variant = variantsById[item.variantId]
      if (!variant || !variant.active || !variant.product?.active || !variant.product.category?.active) {
        return { error: `${label}: this item is no longer for sale. Remove it and try again.`, status: 409 }
      }
      const { product } = variant
      line = {
        variantId: variant.id,
        trackInventory: product.trackInventory,
        description: variantDescription(product.name, variant),
        categoryName: product.category.name,
        unitPriceCents: unitPriceCents(product, variant, isMember),
        taxRateBps: product.category.taxExempt ? 0 : taxBps,
      }
    }

    const discountCents = Number(item.discountCents ?? 0)
    if (!isWholeNumber(discountCents, 0, line.unitPriceCents * quantity)) {
      return { error: `${label}: discount can't be more than the line amount`, status: 400 }
    }

    lines.push({ ...line, quantity, discountCents, ...priceLine({ ...line, quantity, discountCents }) })
  }

  const totals = saleTotals(lines)
  if (expectedTotalCents !== undefined && Number(expectedTotalCents) !== totals.totalCents) {
    return { error: 'Prices changed since this cart was started. Review the total and try again.', status: 409, totals }
  }

  // Apply tenders in order; only cash can be over-tendered (the difference is change)
  if (totals.totalCents === 0) return { lines, totals, payments: [], changeCents: 0 }
  if (!Array.isArray(payments) || !payments.length) return { error: 'Add a payment', status: 400 }

  let remaining = totals.totalCents
  let tenderedTotal = 0
  const applied = []
  for (const p of payments) {
    if (!ACCEPTED_METHODS.includes(p.method)) return { error: `${p.method} payments aren't available yet`, status: 400 }
    const tendered = Number(p.tenderedCents)
    if (!isWholeNumber(tendered, 1, 10_000_000)) return { error: 'Payment amount is not valid', status: 400 }
    if (remaining === 0) return { error: 'More payments than needed', status: 400 }
    const amount = Math.min(remaining, tendered)
    applied.push({ method: p.method, amountCents: amount, tenderedCents: p.method === 'CASH' ? tendered : null })
    remaining -= amount
    tenderedTotal += tendered
  }
  if (remaining > 0) return { error: 'The payment is less than the total', status: 400 }

  return { lines, totals, payments: applied, changeCents: tenderedTotal - totals.totalCents }
}
