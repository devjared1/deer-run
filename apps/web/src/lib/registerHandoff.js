// Hands a tee time from the Tee Sheet page to the register (same browser tab), so the register opens
// with the booking line (and customer) already on the sale.
//   { kind: 'booking', bookingId, label, balanceCents?, customer? }   checked-in booking: paid, or a pay-at-course
//                                                                    balance (balanceCents) to collect
//   { kind: 'newBooking', newBooking: { teeTimeSlotId, players, name, source }, label, customer? }

const KEY = 'deerrun.registerHandoff'

export function setRegisterHandoff(value) {
  sessionStorage.setItem(KEY, JSON.stringify(value))
}

/** Returns the pending handoff and clears it, or null. */
export function takeRegisterHandoff() {
  const raw = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
