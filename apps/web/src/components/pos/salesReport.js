/** "Sat, Oct 31, 2026" for one day, or "Oct 1 – Oct 31, 2026" for a range. */
export function reportDateLabel(report, formatLocalDate) {
  if (report.from === report.to) return formatLocalDate(report.from, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  return `${formatLocalDate(report.from, { month: 'short', day: 'numeric', year: 'numeric' })} – ${
    formatLocalDate(report.to, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export const SALE_STATUS_LABELS = {
  COMPLETED: 'Completed',
  PARTIALLY_REFUNDED: 'Partly refunded',
  REFUNDED: 'Refunded',
  VOIDED: 'Voided',
}

export const SALE_STATUS_CLASSES = {
  COMPLETED: 'bg-pine/15 text-pine',
  PARTIALLY_REFUNDED: 'bg-gold/20 text-gold-dark',
  REFUNDED: 'bg-gray-100 text-gray-600',
  VOIDED: 'bg-red-100 text-red-600',
}

// Cash drawer movements (paid in / paid out / safe drop): label and which way the cash went
export const MOVEMENT_LABELS = { PAID_IN: 'Paid in', PAID_OUT: 'Paid out', SAFE_DROP: 'Safe drop' }
export const MOVEMENT_SIGN = { PAID_IN: '+', PAID_OUT: '−', SAFE_DROP: '−' }
