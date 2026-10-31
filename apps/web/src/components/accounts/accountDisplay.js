export const STATUS_LABELS = { ACTIVE: 'Active', SUSPENDED: 'Suspended', CLOSED: 'Closed' }

export const STATUS_CLASSES = {
  ACTIVE: 'bg-pine/15 text-pine',
  SUSPENDED: 'bg-amber/20 text-amber-dark',
  CLOSED: 'bg-gray-100 text-gray-500',
}

export const STATEMENT_STATUS_LABELS = { OPEN: 'Due', PAID: 'Paid', AUTOPAY_FAILED: 'Autopay failed' }

export const STATEMENT_STATUS_CLASSES = {
  OPEN: 'bg-amber/20 text-amber-dark',
  PAID: 'bg-pine/15 text-pine',
  AUTOPAY_FAILED: 'bg-red-100 text-red-600',
}

export const ENTRY_TYPE_LABELS = { CHARGE: 'Charge', REFUND: 'Refund', PAYMENT: 'Payment', ADJUSTMENT: 'Adjustment' }

/** "Visa •••• 4242" */
export function cardLabel(account) {
  if (!account?.cardLast4) return 'Saved card'
  const brand = account.cardBrand ? account.cardBrand.charAt(0).toUpperCase() + account.cardBrand.slice(1) : 'Card'
  return `${brand} •••• ${account.cardLast4}`
}
