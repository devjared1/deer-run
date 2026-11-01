import { formatLocalDate } from '@/lib/timeclock'
import { statusInfo } from '@/components/ui/statusChips.js'

// Labels and colors come from the one status map (statusChips.js → 'timeOff'), so they match <StatusChip kind="timeOff">.
// Prefer <StatusChip kind="timeOff" :status="…" /> in new code; these stay for pages that still render their own pill.
const STATUSES = ['PENDING', 'APPROVED', 'DENIED', 'CANCELLED']

// Same tone → class map as StatusChip (literal strings for Tailwind)
const TONE_CLASSES = {
  neutral: 'bg-surface-container-highest text-on-surface-variant',
  primary: 'bg-primary-container text-on-primary-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error:   'bg-error-container text-on-error-container',
  info:    'bg-secondary-container text-on-secondary-container',
}

export const STATUS_LABELS = Object.fromEntries(STATUSES.map(s => [s, statusInfo('timeOff', s).label]))

export const STATUS_CLASSES = Object.fromEntries(
  STATUSES.map(s => [s, TONE_CLASSES[statusInfo('timeOff', s).tone] ?? TONE_CLASSES.neutral]),
)

/** "Mon, Nov 2" or "Mon, Nov 2 – Fri, Nov 6, 2026". */
export function formatRange(r) {
  const opts = { weekday: 'short', month: 'short', day: 'numeric' }
  if (r.startDate === r.endDate) return formatLocalDate(r.startDate, { ...opts, year: 'numeric' })
  return `${formatLocalDate(r.startDate, opts)} – ${formatLocalDate(r.endDate, { ...opts, year: 'numeric' })}`
}
