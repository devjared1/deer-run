import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { localDate, localDateTimeToUtc } from '../../../../src/lib/timeclock.js'
import { isActiveMember } from '../../../../src/lib/membership.js'
import { serializeBooking, TEESHEET_BOOKING_COLUMNS } from './index.js'
import { loadSlots } from '../sales/_save.js'
import { stopPendingPayment } from '../../bookings/_holds.js'
import { sendBookingEmail, slotWhen } from '../../bookings/_email.js'
import { CLEAR_TRACKING, dropStalePosition, parseRoundSetup } from '../_oncourse.js'

const BOOKING_SELECT = `${TEESHEET_BOOKING_COLUMNS}, ` +
  'slot:TeeTimeSlot(id, date, startTime), user:User(id, name, email, role, memberUntil, membershipTier), ' +
  'saleItems:SaleItem(sale:Sale!SaleItem_saleId_fkey(id, number))'

const ACTIONS = ['check_in', 'undo_check_in', 'cancel', 'move']

// POST /api/staff/teesheet/:bookingId — { action: 'check_in' | 'undo_check_in' | 'cancel' | 'move', teeTimeSlotId? }
// Check-in records the time the group arrived. Only paid (CONFIRMED) bookings can be checked in; the
// register then opens a sale with the prepaid greens fee at $0 so add-ons go on the same ticket, or, for a
// pay-at-course booking (hold fee paid online), with the balance due (Booking.balanceDueCents).
// check_in also takes the round setup: { cartNumbers?: string[], ownCart?, startHole?: 1 | 10, roundHoles?: 9 | 18 }.
// undo_check_in also clears the tee-off, position and finish, and deletes the position reports (the carts are kept).
// cancel: sets CANCELLED (frees the spots). Checked-in groups must be un-checked-in first. An unpaid online
//   booking has its PaymentIntent cancelled first (409 BOOKING_PAID if the payment just went through).
//   No money moves: a paid booking's online payment is refunded in Stripe by an admin, and greens fees paid at
//   the register are refunded on the sale (Recent sales → refund, manager approval). The page says which.
// move: { teeTimeSlotId } — a paid, not checked-in booking moves to another tee time (any day, not started yet),
//   re-checking space and members-only. The price doesn't depend on the time, so no money changes. Online
//   bookings get an email with the new time (`emailError` if it failed).
// Returns the booking (with `slot`).
export async function onRequestPost({ request, env, params }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!ACTIONS.includes(body?.action)) return json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, 400)

  const { data: booking, error } = await supabase.from('Booking').select(BOOKING_SELECT).eq('id', params.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!booking) return json({ error: 'Booking not found' }, 404)

  let extra = {}
  if (body.action === 'cancel' || body.action === 'move') {
    const done = body.action === 'cancel'
      ? await cancelBooking(supabase, env, booking)
      : await moveBooking(supabase, env, booking, body.teeTimeSlotId)
    if (done instanceof Response) return done
    extra = done
  } else if (body.action === 'check_in') {
    if (booking.status !== 'CONFIRMED') {
      return json({
        error: booking.status === 'PENDING'
          ? "This booking's online payment wasn't finished. Book the group as a walk-in instead."
          : `This booking is ${booking.status.toLowerCase()}`,
      }, 409)
    }
    const setup = parseRoundSetup(body)
    if (setup.error) return json({ error: setup.error }, 400)
    // Keep the first check-in time if the button is pressed twice
    const update = dropStalePosition(booking, { ...setup.fields, ...(booking.checkedInAt ? {} : { checkedInAt: new Date().toISOString() }) })
    if (Object.keys(update).length) {
      const { error: updateError } = await supabase.from('Booking').update(update).eq('id', booking.id)
      if (updateError) return json({ error: updateError.message }, 500)
    }
  } else {
    // Whatever was recorded on the course goes too; the carts stay for the next check-in
    const { error: updateError } = await supabase.from('Booking').update({ checkedInAt: null, ...CLEAR_TRACKING }).eq('id', booking.id)
    if (updateError) return json({ error: updateError.message }, 500)
    const { error: deleteError } = await supabase.from('PositionReport').delete().eq('bookingId', booking.id)
    if (deleteError) return json({ error: deleteError.message }, 500)
  }

  const { data: fresh } = await supabase.from('Booking').select(BOOKING_SELECT).eq('id', booking.id).single()
  return json({ ...serializeBooking(fresh, localDate()), slot: fresh.slot, ...extra })
}

function playersLabel(n) {
  return `${n} spot${n === 1 ? '' : 's'}`
}

// Returns {} or an error Response
async function cancelBooking(supabase, env, booking) {
  if (booking.checkedInAt) return json({ error: 'This group is checked in. Undo the check-in first.' }, 409)
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    return json({ error: `This booking is already ${booking.status.toLowerCase()}` }, 409)
  }
  if (booking.status === 'PENDING') {
    // Register bookings are PENDING only while their card payment is on the reader
    if (booking.source !== 'ONLINE' || !booking.stripePaymentId) {
      return json({ error: 'This booking is being paid for at the register right now. Cancel the card payment there instead.' }, 409)
    }
    const stopped = await stopPendingPayment(env, booking, supabase)
    if (stopped) return stopped
  }

  const { data: updated, error } = await supabase.from('Booking').update({ status: 'CANCELLED' })
    .eq('id', booking.id).eq('status', booking.status).is('checkedInAt', null)
    .select('id')
  if (error) return json({ error: error.message }, 500)
  if (!updated?.length) return json({ error: 'This booking just changed. Refresh the tee sheet and try again.' }, 409)
  return {}
}

// Returns { emailError? } or an error Response
async function moveBooking(supabase, env, booking, teeTimeSlotId) {
  if (typeof teeTimeSlotId !== 'string' || !teeTimeSlotId) return json({ error: 'teeTimeSlotId is required' }, 400)
  if (booking.status !== 'CONFIRMED') {
    return json({
      error: booking.status === 'PENDING'
        ? "This booking isn't paid yet, so it can't be moved. Cancel it, or book the group again at the new time."
        : `This booking is ${booking.status.toLowerCase()}`,
    }, 409)
  }
  if (booking.checkedInAt) return json({ error: 'This group is checked in. Undo the check-in first.' }, 409)
  if (teeTimeSlotId === booking.slot.id) return json({ error: 'The booking is already at that time' }, 400)

  const { data: [slot] = [], error } = await loadSlots(supabase, [teeTimeSlotId])
  if (error) return json({ error: error.message }, 500)
  if (!slot) return json({ error: "That tee time doesn't exist" }, 404)
  if (localDateTimeToUtc(slot.date, slot.startTime) < new Date()) return json({ error: 'That tee time has already gone by' }, 409)
  // Same rule as booking online: admins and active members
  const user = booking.user
  if (slot.memberOnly && !(user?.role === 'ADMIN' || isActiveMember(user, localDate()))) {
    return json({ error: "That tee time is for members, and this booking isn't on an active member's account." }, 409)
  }
  const available = Math.max(0, slot.maxPlayers - slot.bookedPlayers)
  if (available < booking.players) {
    return json({ error: `Only ${playersLabel(available)} left at that time; this group needs ${booking.players}.` }, 409)
  }

  // Like other bookings, two moves into the same slot at the same instant could still overfill it
  const { data: updated, error: updateError } = await supabase.from('Booking').update({ teeTimeSlotId })
    .eq('id', booking.id).eq('status', 'CONFIRMED').eq('teeTimeSlotId', booking.slot.id).is('checkedInAt', null)
    .select('id')
  if (updateError) return json({ error: updateError.message }, 500)
  if (!updated?.length) return json({ error: 'This booking just changed. Refresh the tee sheet and try again.' }, 409)

  // The golfer's confirmation email shows the old time
  let emailError = null
  if (booking.source === 'ONLINE') {
    emailError = await sendBookingEmail(env, user?.email ?? booking.guestEmail, 'Tee Time Changed — Deer Run Golf Course', [
      'Your tee time at Deer Run Golf Course has moved.',
      '',
      `New time: ${slotWhen(slot)}`,
      `Was: ${slotWhen(booking.slot)}`,
      `Players: ${booking.players}`,
      '',
      'If this is not what you arranged with us, please call the pro shop.',
    ])
  }
  return emailError ? { emailError } : {}
}
