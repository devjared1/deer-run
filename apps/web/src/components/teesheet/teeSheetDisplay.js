// Display rules for the staff Tee Sheet (TeeSheetView + the components in this folder). No icon imports here: the
// card maps the `icon` keys below to components.
import { bookingStatus, statusInfo } from '@/components/ui/statusChips'
import { formatClockTime } from '@/lib/timeclock'
import { formatCents } from '@/lib/money'

/** The one status chip on a booking card: { label, tone, icon } (icon: a key of STATUS_ICONS in BookingCard.vue). */
export function bookingChip(b) {
  const status = bookingStatus(b)
  if (status === 'CHECKED_IN') {
    return { label: `Checked in ${formatClockTime(b.checkedInAt)}`, tone: 'primary', icon: 'checkedIn' }
  }
  if (status === 'CONFIRMED') {
    if (b.source === 'ONLINE') return { label: 'Paid online', tone: 'success', icon: 'paidOnline' }
    return { label: b.source === 'PHONE' ? 'Phone · paid at register' : 'Walk-in · paid at register', tone: 'success', icon: 'paidRegister' }
  }
  if (status === 'PENDING') return { label: 'Payment pending', tone: 'warning', icon: 'pending' }
  if (status === 'HOLD_EXPIRED') return { label: 'Hold expired · released', tone: 'neutral', icon: 'expired' }
  return { ...statusInfo('booking', status), icon: 'cancelled' }
}

/** Cancelled or refunded: shown muted, no actions. */
export function isInactive(b) {
  return b.status === 'CANCELLED' || b.status === 'REFUNDED'
}

// Cancel / move: not once the group is checked in (undo first). Unpaid online bookings can be cancelled
// (releasing their spots); register bookings are only PENDING while their card is on the reader.
export function canChange(b) {
  if (b.checkedInAt) return false
  return b.status === 'CONFIRMED' || (b.status === 'PENDING' && b.source === 'ONLINE')
}

/** "18 holes from 10", "9 holes" … for the card's round line (null when there's nothing worth saying). */
export function roundText(b) {
  if (b.status !== 'CONFIRMED') return null
  if (b.checkedInAt) return `${b.roundHoles} holes${b.startHole === 10 ? ' from 10' : ''}`
  if (b.source === 'ONLINE') return `Paid for ${b.roundHoles} holes, ${b.cartIncluded ? 'cart paid' : 'walking'}`
  return null
}

// Cancelling never refunds: say where the money is and how to refund it
export function moneyNote(b) {
  if (b.status === 'PENDING') {
    return "No money was taken. The unfinished online payment is cancelled too, so it can't go through later."
  }
  const receipts = (b.receipts || []).map(r => `#${r.number}`).join(', ')
  if (b.source === 'ONLINE' && b.totalCents > 0) {
    return `Cancelling doesn't refund anything. The golfer paid ${formatCents(b.totalCents)} online; if it should be ` +
      'refunded, ask an admin to refund the payment in the Stripe dashboard (and mark the booking Refunded in Admin → Bookings).' +
      (receipts ? ` Add-ons are on receipt ${receipts} (refund those from Recent sales at the register).` : '')
  }
  if (receipts) {
    return `Cancelling doesn't refund anything. The greens fees are on receipt ${receipts}; to refund them, open the receipt ` +
      'in Recent sales at the register and refund those lines (manager approval).'
  }
  return 'No money is attached to this booking.'
}

export function playersText(n) {
  return `${n} player${n === 1 ? '' : 's'}`
}
