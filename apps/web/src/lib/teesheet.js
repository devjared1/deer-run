// Tee sheet labels, shared by the Vue app and the Pages Functions (no '@/' imports).

import { formatLocalDate } from './timeclock.js'

/** "07:30" → "7:30 AM" */
export function teeTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "2026-10-31", "07:30" → "Sat 10/31 7:30 AM" (used in receipt lines, so it stays short) */
export function teeTimeLabel(date, startTime) {
  return `${formatLocalDate(date, { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '')} ${teeTime(startTime)}`
}
