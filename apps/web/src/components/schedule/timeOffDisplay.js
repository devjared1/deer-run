import { formatLocalDate } from '@/lib/timeclock'

export const STATUS_LABELS = { PENDING: 'Pending', APPROVED: 'Approved', DENIED: 'Denied', CANCELLED: 'Cancelled' }

export const STATUS_CLASSES = {
  PENDING:   'bg-gold/20 text-gold-dark',
  APPROVED:  'bg-pine/15 text-pine',
  DENIED:    'bg-red-100 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

/** "Mon, Nov 2" or "Mon, Nov 2 – Fri, Nov 6, 2026". */
export function formatRange(r) {
  const opts = { weekday: 'short', month: 'short', day: 'numeric' }
  if (r.startDate === r.endDate) return formatLocalDate(r.startDate, { ...opts, year: 'numeric' })
  return `${formatLocalDate(r.startDate, opts)} – ${formatLocalDate(r.endDate, { ...opts, year: 'numeric' })}`
}
