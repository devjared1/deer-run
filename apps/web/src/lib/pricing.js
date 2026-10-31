// Register pricing. Shared by the register page (live totals) and POST /api/staff/sales (the
// authoritative calculation), so this file must not use '@/' imports or browser-only APIs.
// All amounts are integer cents.

import { membershipTiers } from '../data/membershipTiers.js'

// Categories with the member Pro Shop discount when ProductCategory.memberDiscount isn't there yet (before the
// migration that adds it); afterwards the admin's per-category setting decides
const DEFAULT_MEMBER_DISCOUNT_CATEGORIES = ['Apparel', 'Golf Equipment & Balls']

/** True when members get their Pro Shop discount in this category. */
export function isMemberDiscountCategory(category) {
  if (!category) return false
  return category.memberDiscount ?? DEFAULT_MEMBER_DISCOUNT_CATEGORIES.includes(category.name)
}

/** A tier's Pro Shop discount in basis points (membershipTiers.js). Members with no tier on file get the lowest. */
export function memberDiscountRateBps(tier) {
  const match = membershipTiers.find(t => t.name.toLowerCase() === String(tier ?? '').toLowerCase())
  return match ? match.proShopDiscountBps : Math.min(...membershipTiers.map(t => t.proShopDiscountBps))
}

/**
 * The member Pro Shop discount on a product line, in basis points: active members only, in member-discount
 * categories. Products with a member price give members that price instead, not both.
 */
export function memberDiscountBps({ product, variant, category, isMember, tier }) {
  if (!isMember || !isMemberDiscountCategory(category)) return 0
  if ((variant.memberPriceCents ?? product.memberPriceCents) != null) return 0
  return memberDiscountRateBps(tier)
}

/**
 * Unit price for a variant. Variant prices override the product's. Members pay the member
 * price when one is set (variant first, then product), otherwise the regular price.
 */
export function unitPriceCents(product, variant, isMember) {
  const regular = variant.priceCents ?? product.priceCents
  if (!isMember) return regular
  return variant.memberPriceCents ?? product.memberPriceCents ?? regular
}

/** Tax on an amount at a rate in basis points (900 = 9%), rounded to the nearest cent. */
export function taxCents(amountCents, rateBps) {
  return Math.round((amountCents * rateBps) / 10000)
}

/** The member discount on a line (memberDiscountBps of quantity × unit price), rounded to the nearest cent. */
export function memberDiscountCents(unit, quantity, bps) {
  return Math.round((unit * quantity * bps) / 10000)
}

/**
 * Prices one cart line. Two discounts can apply: the member discount (memberDiscountBps, automatic) and a
 * manager's discount (discountCents, needs approval; at most what's left after the member discount).
 * The result's discountCents is both together (what SaleItem.discountCents stores), with the parts in
 * memberDiscountCents and managerDiscountCents. Tax is calculated per line on the discounted amount and
 * stored with the line, so a receipt never changes if the rate changes later.
 */
export function priceLine({ unitPriceCents: unit, quantity, discountCents = 0, memberDiscountBps: bps = 0, taxRateBps }) {
  const member = memberDiscountCents(unit, quantity, bps)
  const subtotalCents = unit * quantity - member - discountCents
  const tax = taxCents(subtotalCents, taxRateBps)
  return {
    discountCents: member + discountCents,
    memberDiscountCents: member,
    managerDiscountCents: discountCents,
    subtotalCents,
    taxCents: tax,
    totalCents: subtotalCents + tax,
  }
}

/** Sale totals from priced lines (each with discountCents, subtotalCents, taxCents, totalCents). */
export function saleTotals(lines) {
  const sum = (field) => lines.reduce((total, l) => total + (l[field] || 0), 0)
  return {
    discountCents: sum('discountCents'),
    subtotalCents: sum('subtotalCents'),
    taxCents: sum('taxCents'),
    totalCents: sum('totalCents'),
  }
}

/**
 * Refund for `quantity` units of a sale line, worked out the same way as the refund_sale()
 * Postgres function: the last remaining units return exactly what's left of the line, otherwise
 * the amount is prorated and rounded. For previews; the database result is what's paid out.
 */
export function refundForLine(line, quantity) {
  if (quantity === line.quantity - line.refundedQuantity) {
    return { amountCents: line.totalCents - line.refundedCents, taxCents: line.taxCents - line.refundedTaxCents }
  }
  return {
    amountCents: Math.round((line.totalCents * quantity) / line.quantity),
    taxCents: Math.round((line.taxCents * quantity) / line.quantity),
  }
}

/** "Polo — L / Navy" style description for a variant. */
export function variantDescription(productName, variant) {
  const options = [variant.size, variant.color].filter(Boolean).join(' / ')
  return options ? `${productName} — ${options}` : productName
}
