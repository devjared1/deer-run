// Tee sheet labels, shared by the Vue app and the Pages Functions (no '@/' imports).

import { formatLocalDate, toUtcIso } from './timeclock.js'

// An online booking whose payment wasn't finished holds its players' spots for this long after it was made.
// After that it no longer counts toward the slot (everywhere capacity is worked out) and is released:
// its PaymentIntent is cancelled and the booking marked CANCELLED (functions/api/bookings/_holds.js).
export const UNPAID_HOLD_MINUTES = 30

/**
 * True for a PENDING online booking (has a PaymentIntent) older than UNPAID_HOLD_MINUTES. Register bookings
 * (source POS / PHONE) are held PENDING while a card is on the reader and never expire here; they have no
 * stripePaymentId. Needs `status`, `stripePaymentId` and `createdAt` (and `source` when selected); without
 * `createdAt` the booking keeps holding its spot.
 */
export function isExpiredHold(b, now = new Date()) {
  if (b?.status !== 'PENDING' || !b.stripePaymentId || !b.createdAt) return false
  if (b.source && b.source !== 'ONLINE') return false
  return new Date(toUtcIso(b.createdAt)).getTime() < now.getTime() - UNPAID_HOLD_MINUTES * 60_000
}

/** Whether a booking takes up spots in its tee time: paid ones, and unpaid ones still inside their hold. */
export function holdsSpot(b, now = new Date()) {
  if (b?.status === 'CONFIRMED') return true
  return b?.status === 'PENDING' && !isExpiredHold(b, now)
}

/** Players booked in a slot (bookings that hold spots). */
export function bookedPlayers(bookings, now = new Date()) {
  return (bookings || []).filter(b => holdsSpot(b, now)).reduce((sum, b) => sum + b.players, 0)
}

/** The columns holdsSpot() needs, for Booking selects that work out capacity. */
export const HOLD_COLUMNS = 'players, status, stripePaymentId, createdAt'

/** "07:30" → "7:30 AM" */
export function teeTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "2026-10-31", "07:30" → "Sat 10/31 7:30 AM" (used in receipt lines, so it stays short) */
export function teeTimeLabel(date, startTime) {
  return `${formatLocalDate(date, { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '')} ${teeTime(startTime)}`
}

/** Pay at course: what's still owed at the register (0 once paid, or for bookings paid in full). */
export function balanceDue(b) {
  return b?.status === 'CONFIRMED' && b.balanceDueCents > 0 ? b.balanceDueCents : 0
}

/**
 * The register line for an existing booking (checked in from the tee sheet): the prepaid greens fee at $0, or the
 * pay-at-course balance. The register shows it and the server writes it on the receipt, so both use this.
 *   booking: { source, players, balanceDueCents?, status }, slot: { date, startTime }
 */
export function bookingLineDescription(booking, slot) {
  const players = `${booking.players} player${booking.players === 1 ? '' : 's'}`
  const when = teeTimeLabel(slot.date, slot.startTime)
  if (balanceDue(booking)) return `Tee time balance (hold fee paid online) — ${when}, ${players}`
  return `Greens fee ${booking.source === 'ONLINE' ? 'paid online' : 'paid'} — ${when}, ${players}`
}
