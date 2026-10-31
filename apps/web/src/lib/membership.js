// Membership status, shared by the Vue app and the Pages Functions (imported there by relative path),
// so this file must not use '@/' imports or browser-only APIs.

import { addDays } from './timeclock.js'

/**
 * True when a user gets member pricing and member tee times: role MEMBER and, if memberUntil is set,
 * not past it (memberUntil is the last day of membership, a course-local "YYYY-MM-DD").
 * Members with no memberUntil were added by hand and don't expire.
 */
export function isActiveMember(user, today) {
  if (!user || user.role !== 'MEMBER') return false
  return !user.memberUntil || user.memberUntil >= today
}

/** True when a MEMBER's membership has run out and they should drop to GUEST. */
export function isLapsedMember(user, today) {
  return user?.role === 'MEMBER' && !!user.memberUntil && user.memberUntil < today
}

function addMonths(ymd, months) {
  const [y, m, d] = ymd.split('-').map(Number)
  // Clamp to the last day of the target month (Jan 31 + 1 month → Feb 28/29)
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10)
}

/**
 * The new last day of membership after buying `months` more on `today`. Renewing early extends from the
 * current end date; a lapsed (or brand-new) membership starts today. A month bought on Mar 15 runs
 * through Apr 14; one bought on Jan 31 runs through the end of February.
 */
export function extendMembership(memberUntil, months, today) {
  const start = memberUntil && memberUntil >= today ? addDays(memberUntil, 1) : today
  const end = addMonths(start, months)
  // When the start day doesn't exist in the end month (Jan 31 → Feb), the month runs to its last day
  return end.slice(8) < start.slice(8) ? end : addDays(end, -1)
}
