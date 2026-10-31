// Prices are stored as integer cents; forms edit them as dollars.

/** 4500 → "$45.00"; null → "—" */
export function formatCents(cents) {
  if (cents === null || cents === undefined) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

/** 4500 → "45.00"; null → "" (for form inputs) */
export function centsToDollars(cents) {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2)
}

/** "45" / 45.5 → 4500 / 4550; "" or null → null. Invalid input → NaN (the API rejects it). */
export function dollarsToCents(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}
