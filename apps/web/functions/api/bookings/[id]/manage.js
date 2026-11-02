import { json } from '../../admin/_auth.js'
import { golferBooking, linkTokenFrom } from '../_golfer.js'
import { changeBlocker, CHANGE_CUTOFF_HOURS } from '../_change.js'
import { isExpiredHold } from '../../../../src/lib/teesheet.js'
import { localDateTimeToUtc } from '../../../../src/lib/timeclock.js'

// GET /api/bookings/:id/manage?t=<link token> — the "Manage your booking" page from the booking emails (guests too;
// the signed-in owner can use it without a token).
// → { booking: { …Booking, teeTimeSlot: { id, date, startTime }, holdExpired }, guest: { name, email },
//     canChange, changeBlocker, canCancel, cancelBlocker }
// 403 BAD_LINK for a link that wasn't made for this booking.
export async function onRequestGet({ request, env, params }) {
  const access = await golferBooking(request, env, params.id,
    '*, teeTimeSlot:TeeTimeSlot(id, date, startTime), user:User(name, email)', linkTokenFrom(request))
  if (access instanceof Response) return access
  const { booking } = access

  const now = new Date()
  const slot = { ...booking.teeTimeSlot, date: String(booking.teeTimeSlot.date).slice(0, 10) }
  const changeReason = changeBlocker({ ...booking, slot }, now)
  const hoursUntil = (localDateTimeToUtc(slot.date, slot.startTime).getTime() - now.getTime()) / 3600_000
  let cancelReason = null
  if (!['PENDING', 'CONFIRMED'].includes(booking.status) || isExpiredHold(booking, now)) cancelReason = 'This booking isn\'t active.'
  else if (booking.checkedInAt) cancelReason = 'This group has already checked in.'
  else if (hoursUntil <= CHANGE_CUTOFF_HOURS) cancelReason = `Bookings can be cancelled up to ${CHANGE_CUTOFF_HOURS} hours before the tee time.`

  const { user, ...rest } = booking
  return json({
    booking: { ...rest, teeTimeSlot: slot, holdExpired: isExpiredHold(booking, now) },
    guest: { name: user?.name || booking.guestName || null, email: user?.email || booking.guestEmail || null },
    canChange: !changeReason,
    changeBlocker: changeReason,
    canCancel: !cancelReason,
    cancelBlocker: cancelReason,
  })
}
