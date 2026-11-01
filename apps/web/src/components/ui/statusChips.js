// One status → { label, tone, icon } map for every status chip in the app (StatusChip.vue reads it).
// Plain JS with no imports, so anything can use it (pages, CSV exports, Functions).
//
//   statusInfo('booking', 'CONFIRMED')  → { label: 'Confirmed', tone: 'success', icon: 'check' }
//   statusInfo('sale', 'SOMETHING_NEW') → { label: 'Something new', tone: 'neutral', icon: null }
//
// tone: neutral | primary | success | warning | error | info (secondary container).
// icon: a name from STATUS_ICONS in StatusChip.vue (null = none), so this file needs no icon imports.
// Derived states (not database enum values): booking CHECKED_IN / HOLD_EXPIRED (bookingStatus()), statement
// OVERDUE (accountDisplay.js → statementStatus()), round WAITING/ON_COURSE/DONE/FINISHED and pace (src/lib/pace.js).

const s = (label, tone, icon = null) => ({ label, tone, icon })

export const STATUS_MAP = {
  // Booking.status (BookingStatus) + derived
  booking: {
    PENDING:      s('Payment not finished', 'warning', 'pending'),
    CONFIRMED:    s('Confirmed', 'success', 'check'),
    CANCELLED:    s('Cancelled', 'neutral', 'cancel'),
    REFUNDED:     s('Refunded', 'neutral', 'undo'),
    CHECKED_IN:   s('Checked in', 'primary', 'checkIn'),
    HOLD_EXPIRED: s('Unpaid · released', 'neutral', 'timerOff'),
  },
  // Sale.status (SaleStatus)
  sale: {
    COMPLETED:          s('Completed', 'success', 'check'),
    PARTIALLY_REFUNDED: s('Partly refunded', 'warning', 'undo'),
    REFUNDED:           s('Refunded', 'neutral', 'undo'),
    VOIDED:             s('Voided', 'error', 'block'),
  },
  // TimeOffRequest.status (TimeOffStatus)
  timeOff: {
    PENDING:   s('Pending', 'warning', 'pending'),
    APPROVED:  s('Approved', 'success', 'check'),
    DENIED:    s('Denied', 'error', 'cancel'),
    CANCELLED: s('Cancelled', 'neutral', 'block'),
  },
  // Statement.status (StatementStatus) + derived OVERDUE
  statement: {
    OPEN:           s('Due', 'warning', 'pending'),
    PAID:           s('Paid', 'success', 'check'),
    AUTOPAY_FAILED: s('Autopay failed', 'error', 'error'),
    OVERDUE:        s('Overdue', 'error', 'warning'),
  },
  // User.role (Role)
  role: {
    GUEST:  s('Guest', 'neutral', 'person'),
    MEMBER: s('Member', 'primary', 'member'),
    ADMIN:  s('Admin', 'info', 'admin'),
  },
  // HouseAccount.status (HouseAccountStatus)
  houseAccount: {
    ACTIVE:    s('Active', 'success', 'check'),
    SUSPENDED: s('Suspended', 'warning', 'pause'),
    CLOSED:    s('Closed', 'neutral', 'lock'),
  },
  // trackGroup().pace (src/lib/pace.js)
  pace: {
    AHEAD:   s('Ahead', 'info', 'ahead'),
    ON_PACE: s('On pace', 'success', 'check'),
    BEHIND:  s('Behind', 'warning', 'behind'),
  },
  // trackGroup().state (src/lib/pace.js)
  round: {
    WAITING:   s('Waiting to start', 'neutral', 'pending'),
    ON_COURSE: s('On course', 'primary', 'golf'),
    DONE:      s('Probably done', 'info', 'flag'),
    FINISHED:  s('Finished', 'success', 'flag'),
  },
  // CardCheckout.status (CardCheckoutStatus)
  cardCheckout: {
    PENDING:    s('Waiting for card', 'warning', 'card'),
    SUCCEEDED:  s('Approved, not saved', 'info', 'sync'),
    COMPLETING: s('Saving sale', 'info', 'sync'),
    COMPLETED:  s('Paid', 'success', 'check'),
    CANCELED:   s('Cancelled', 'neutral', 'cancel'),
  },
}

/** "PARTIALLY_REFUNDED" → "Partially refunded" */
function titleCase(status) {
  const text = String(status ?? '').replace(/_/g, ' ').trim().toLowerCase()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown'
}

/** { label, tone, icon } for a status; unknown kinds/statuses get the title-cased status in a neutral tone. */
export function statusInfo(kind, status) {
  return STATUS_MAP[kind]?.[status] ?? s(titleCase(status), 'neutral')
}

/** Display status of a booking: CHECKED_IN once checked in, HOLD_EXPIRED for an unpaid online booking past its hold. */
export function bookingStatus(booking) {
  if (booking.status === 'CONFIRMED' && booking.checkedInAt) return 'CHECKED_IN'
  if (booking.status === 'PENDING' && booking.holdExpired) return 'HOLD_EXPIRED'
  return booking.status
}
