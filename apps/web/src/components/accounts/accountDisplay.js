import { localDate } from '@/lib/timeclock'

// Account and statement status labels and colors live in the one status map (components/ui/statusChips.js →
// 'houseAccount' / 'statement'); render them with <StatusChip>.

/** Display status of a saved statement: an unpaid one past its due date shows as OVERDUE. */
export function statementStatus(s) {
  return s.status !== 'PAID' && s.dueDate && s.dueDate < localDate() ? 'OVERDUE' : s.status
}

export const ENTRY_TYPE_LABELS = { CHARGE: 'Charge', REFUND: 'Refund', PAYMENT: 'Payment', ADJUSTMENT: 'Adjustment' }

/** "Visa •••• 4242" */
export function cardLabel(account) {
  if (!account?.cardLast4) return 'Saved card'
  const brand = account.cardBrand ? account.cardBrand.charAt(0).toUpperCase() + account.cardBrand.slice(1) : 'Card'
  return `${brand} •••• ${account.cardLast4}`
}
