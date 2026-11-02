import { createClient } from '@supabase/supabase-js'
import { stopPendingPayment } from './_holds.js'
import { golferBooking, linkTokenFrom } from './_golfer.js'
import { notifyWaitlistInBackground } from './_waitlist.js'
import { siteOrigin } from '../_links.js'
import { localDateTimeToUtc } from '../../../src/lib/timeclock.js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestGet({ env, params }) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: booking, error } = await supabase
    .from('Booking')
    .select('*, teeTimeSlot:TeeTimeSlot(date, startTime)')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !booking) return json({ error: 'Booking not found' }, 404)

  return json(booking)
}

// DELETE /api/bookings/:id[?t=<link token>] — the golfer cancels: signed in as its owner, or with the signed link from
// the booking emails (guests). At least 24 hours before the tee time. Frees the spots for the waitlist.
export async function onRequestDelete(context) {
  const { request, env, params } = context
  const access = await golferBooking(request, env, params.id, '*, teeTimeSlot:TeeTimeSlot(date, startTime)', linkTokenFrom(request))
  if (access instanceof Response) return access
  const { supabase, booking } = access

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    return json({ error: 'Booking cannot be cancelled' }, 400)
  }

  // 24 hours before the tee time itself (course time), not UTC midnight of the slot date
  const teeTime = localDateTimeToUtc(String(booking.teeTimeSlot.date).slice(0, 10), booking.teeTimeSlot.startTime)
  const msUntil = teeTime.getTime() - Date.now()
  if (msUntil <= 24 * 60 * 60 * 1000) {
    return json({ error: 'Bookings must be cancelled at least 24 hours in advance' }, 400)
  }

  // An unfinished online payment is cancelled first, so it can't go through after the booking is gone
  if (booking.status === 'PENDING' && booking.stripePaymentId) {
    const stopped = await stopPendingPayment(env, booking, supabase)
    if (stopped) return stopped
  }

  const { data: updated, error: updateError } = await supabase
    .from('Booking')
    .update({ status: 'CANCELLED' })
    .eq('id', params.id)
    .eq('status', booking.status)
    .select('id')

  if (updateError) return json({ error: updateError.message }, 500)
  if (!updated?.length) return json({ error: 'This booking just changed. Refresh and try again.' }, 409)

  // The spots are free: tell the waitlist for that day
  notifyWaitlistInBackground(context, supabase, [booking.teeTimeSlot.date], siteOrigin(env, request))
  return json({ success: true })
}
