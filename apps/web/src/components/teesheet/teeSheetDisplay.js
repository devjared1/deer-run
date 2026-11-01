// Display rules for the staff Tee Sheet (TeeSheetView + the components in this folder). No icon imports here: the
// card maps the `icon` keys below to components.
import { bookingStatus, statusInfo } from '@/components/ui/statusChips'
import { formatClockTime } from '@/lib/timeclock'
import { formatCents } from '@/lib/money'
import { balanceDue } from '@/lib/teesheet'

/** The one status chip on a booking card: { label, tone, icon } (icon: a key of STATUS_ICONS in BookingCard.vue). */
export function bookingChip(b) {
  const status = bookingStatus(b)
  if (status === 'CHECKED_IN') {
    return { label: `Checked in ${formatClockTime(b.checkedInAt)}`, tone: 'primary', icon: 'checkedIn' }
  }
  // Pay at course: the hold fee was paid online and the balance is still owed (also once checked in, until it's rung up)
  if ((status === 'CONFIRMED' || status === 'CHECKED_IN') && balanceDue(b)) {
    const label = `${formatCents(balanceDue(b))} due at register`
    return { label: status === 'CHECKED_IN' ? `Checked in · ${label}` : label, tone: 'warning', icon: 'balanceDue' }
  }
  if (status === 'CONFIRMED') {
    if (b.source === 'ONLINE') {
      if (b.holdFeeCents != null) return { label: 'Paid · hold fee online, rest at register', tone: 'success', icon: 'paidRegister' }
      return { label: 'Paid online', tone: 'success', icon: 'paidOnline' }
    }
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
  if (b.source === 'ONLINE') {
    return `${balanceDue(b) ? 'Booked' : 'Paid'} for ${b.roundHoles} holes, ${b.cartIncluded ? `cart ${balanceDue(b) ? 'included' : 'paid'}` : 'walking'}`
  }
  return null
}

// Cancelling never refunds: say where the money is and how to refund it
export function moneyNote(b) {
  if (b.status === 'PENDING') {
    return "No money was taken. The unfinished online payment is cancelled too, so it can't go through later."
  }
  const receipts = (b.receipts || []).map(r => `#${r.number}`).join(', ')
  // Pay at course: the hold fee is kept when a booking is cancelled or missed
  if (b.holdFeeCents != null && balanceDue(b)) {
    return `The ${formatCents(b.holdFeeCents)} hold fee paid online is non-refundable and is kept; the ` +
      `${formatCents(balanceDue(b))} balance was never charged.`
  }
  if (b.source === 'ONLINE' && b.totalCents > 0) {
    if (b.holdFeeCents != null) {
      return `Cancelling doesn't refund anything. The ${formatCents(b.holdFeeCents)} hold fee paid online is non-refundable; ` +
        `the balance is on receipt ${receipts || '(none found)'} (refund those lines from Recent sales at the register, manager approval).`
    }
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
