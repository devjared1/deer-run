import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { localDate } from '../../../../src/lib/timeclock.js'
import { serializeBooking } from './index.js'

const BOOKING_SELECT = 'id, players, status, source, guestName, guestEmail, checkedInAt, createdAt, ' +
  'slot:TeeTimeSlot(id, date, startTime), user:User(id, name, email, role, memberUntil), ' +
  'saleItems:SaleItem(sale:Sale!SaleItem_saleId_fkey(id, number))'

// POST /api/staff/teesheet/:bookingId — { action: 'check_in' | 'undo_check_in' }
// Check-in records the time the group arrived. Only paid (CONFIRMED) bookings can be checked in; the
// register then opens a sale with the prepaid greens fee at $0 so add-ons go on the same ticket.
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
  if (!['check_in', 'undo_check_in'].includes(body?.action)) return json({ error: "action must be 'check_in' or 'undo_check_in'" }, 400)

  const { data: booking, error } = await supabase.from('Booking').select(BOOKING_SELECT).eq('id', params.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!booking) return json({ error: 'Booking not found' }, 404)

  if (body.action === 'check_in') {
    if (booking.status !== 'CONFIRMED') {
      return json({
        error: booking.status === 'PENDING'
          ? "This booking's online payment wasn't finished. Book the group as a walk-in instead."
          : `This booking is ${booking.status.toLowerCase()}`,
      }, 409)
    }
    // Keep the first check-in time if the button is pressed twice
    if (!booking.checkedInAt) {
      const { error: updateError } = await supabase.from('Booking').update({ checkedInAt: new Date().toISOString() }).eq('id', booking.id)
      if (updateError) return json({ error: updateError.message }, 500)
    }
  } else {
    const { error: updateError } = await supabase.from('Booking').update({ checkedInAt: null }).eq('id', booking.id)
    if (updateError) return json({ error: updateError.message }, 500)
  }

  const { data: fresh } = await supabase.from('Booking').select(BOOKING_SELECT).eq('id', booking.id).single()
  return json({ ...serializeBooking(fresh, localDate()), slot: fresh.slot })
}
