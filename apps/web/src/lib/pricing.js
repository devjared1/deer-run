// Register pricing. Shared by the register page (live totals) and POST /api/staff/sales (the
// authoritative calculation), so this file must not use '@/' imports or browser-only APIs.
// All amounts are integer cents.

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

/**
 * Prices one cart line. Tax is calculated per line on the discounted amount and stored with the
 * line, so a receipt never changes if the rate changes later.
 */
export function priceLine({ unitPriceCents: unit, quantity, discountCents = 0, taxRateBps }) {
  const subtotalCents = unit * quantity - discountCents
  const tax = taxCents(subtotalCents, taxRateBps)
  return { subtotalCents, taxCents: tax, totalCents: subtotalCents + tax }
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
