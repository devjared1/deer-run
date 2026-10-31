import { makeStripe } from '../staff/_stripe.js'
import { isExpiredHold, bookedPlayers, UNPAID_HOLD_MINUTES, HOLD_COLUMNS } from '../../../src/lib/teesheet.js'
import { localDateTimeToUtc } from '../../../src/lib/timeclock.js'
import { formatCents } from '../../../src/lib/money.js'
import { sendBookingEmail, slotWhen } from './_email.js'

// Unpaid online bookings. POST /api/bookings creates a PENDING booking with a PaymentIntent, and the webhook
// confirms it when the payment succeeds. If the golfer never finishes paying, the booking stops holding its
// spots after UNPAID_HOLD_MINUTES (isExpiredHold in src/lib/teesheet.js, used wherever capacity is worked out)
// and is released here: the PaymentIntent is cancelled first, so a late payment can't go through, then the
// booking is marked CANCELLED. Release runs lazily (in the background when availability is shown or a booking
// is made) and from the daily job (POST /api/internal/bookings).

/**
 * Cancels the PaymentIntent of a PENDING online booking. Returns { outcome, intent }, outcome being
 *   'cancelled'  — cancelled now, or already cancelled: no payment can succeed on it any more
 *   'paid'       — it already succeeded (the payment beat us): settle it with settlePaidBooking, don't cancel
 *   'processing' — a payment is in flight (e.g. a bank debit); Stripe won't cancel it, so leave the booking
 * Throws on other Stripe errors.
 */
export async function cancelBookingPayment(stripe, paymentIntentId) {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (outcomeOf(intent)) return { outcome: outcomeOf(intent), intent }
  try {
    const cancelled = await stripe.paymentIntents.cancel(paymentIntentId)
    return { outcome: 'cancelled', intent: cancelled }
  } catch (e) {
    // The golfer may have paid in the moment between the two calls
    const again = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (outcomeOf(again)) return { outcome: outcomeOf(again), intent: again }
    throw e
  }
}

function outcomeOf(intent) {
  if (intent.status === 'canceled') return 'cancelled'
  if (intent.status === 'succeeded') return 'paid'
  if (intent.status === 'processing' || intent.status === 'requires_capture') return 'processing'
  return null
}

/**
 * Call before cancelling a PENDING online booking by hand (customer, staff, admin): cancels its PaymentIntent
 * so the payment can't go through afterwards. Returns null when it's safe to cancel the booking, or a 409/502/503
 * Response when it isn't: the payment just succeeded (the booking is settled as the webhook would: CONFIRMED, or
 * refunded if its hold had run out and the time is full) or is still processing.
 */
export async function stopPendingPayment(env, booking, supabase) {
  const stripe = makeStripe(env)
  if (!stripe) return Response.json({ error: 'Stripe is not configured, so the online payment could not be cancelled' }, { status: 503 })
  let settled
  try {
    const { outcome, intent } = await cancelBookingPayment(stripe, booking.stripePaymentId)
    if (outcome === 'cancelled') return null
    if (outcome === 'processing') {
      return Response.json({ error: 'The online payment for this booking is still processing. Try again in a few minutes.' }, { status: 409 })
    }
    settled = await settlePaidBooking(supabase, env, intent, booking.id)
  } catch (e) {
    return Response.json({ error: `Couldn't cancel the online payment: ${e.message}` }, { status: 502 })
  }
  return Response.json({
    error: settled.action === 'refunded'
      ? 'The online payment for this booking finished after its hold ran out and the time is full, so the payment was refunded.'
      : 'The online payment for this booking just went through, so it is now paid. Refresh, and cancel again if it should still be cancelled.',
    code: 'BOOKING_PAID',
  }, { status: 409 })
}

/**
 * Releases expired holds: for each PENDING online booking older than UNPAID_HOLD_MINUTES (optionally only in
 * `slotIds`), cancels its PaymentIntent and marks it CANCELLED. If the payment had already succeeded it's
 * settled like the webhook does (settlePaidBooking: confirmed if there's room, otherwise refunded); if it's
 * processing it's left alone. Updates are conditional on the booking still being PENDING. Without a Stripe key
 * nothing is released (the holds still don't count toward capacity).
 * Returns { checked, released, confirmed, refunded, processing, errors }.
 */
export async function releaseExpiredHolds(supabase, env, { slotIds = null, limit = 10 } = {}) {
  const summary = { checked: 0, released: 0, confirmed: 0, refunded: 0, processing: 0, errors: [] }
  const stripe = makeStripe(env)
  if (!stripe) return summary

  const cutoff = new Date(Date.now() - UNPAID_HOLD_MINUTES * 60_000).toISOString()
  // select('*') so this works whether or not Booking.source exists yet (migration 6)
  let query = supabase.from('Booking').select('*')
    .eq('status', 'PENDING')
    .not('stripePaymentId', 'is', null)
    .lt('createdAt', cutoff)
    .order('createdAt', { ascending: true })
    .limit(limit)
  if (slotIds) {
    if (!slotIds.length) return summary
    query = query.in('teeTimeSlotId', slotIds)
  }
  const { data, error } = await query
  if (error) {
    summary.errors.push(error.message)
    return summary
  }

  for (const booking of (data || []).filter(b => isExpiredHold(b))) {
    summary.checked++
    try {
      const { outcome, intent } = await cancelBookingPayment(stripe, booking.stripePaymentId)
      if (outcome === 'processing') {
        summary.processing++
      } else if (outcome === 'paid') {
        const settled = await settlePaidBooking(supabase, env, intent, booking.id)
        if (settled.action === 'confirmed' || settled.action === 'refunded') summary[settled.action]++
      } else {
        const { error: updateError } = await supabase.from('Booking').update({ status: 'CANCELLED' })
          .eq('id', booking.id).eq('status', 'PENDING')
        if (updateError) throw updateError
        summary.released++
      }
    } catch (e) {
      summary.errors.push(`${booking.id}: ${e.message}`)
    }
  }
  return summary
}

/**
 * Webhook: payment_intent.succeeded for an online booking (metadata.bookingId). Returns { action }:
 *   'confirmed' — the booking held its spots (CONFIRMED, or PENDING inside its hold), or its hold had run out
 *                 but the tee time still has room and hasn't started: it's CONFIRMED (the caller emails the golfer)
 *   'refunded'  — its hold ran out and the time filled up (or has gone by): the payment is refunded in full,
 *                 the booking marked REFUNDED and the golfer emailed. This happens only when the release
 *                 couldn't cancel the PaymentIntent because a slow payment (e.g. a bank debit) was processing
 *   'flagged'   — the booking was CANCELLED / REFUNDED (cancelled by hand, or released) yet the payment went
 *                 through. Every cancel path cancels the PaymentIntent first, so this shouldn't happen; the
 *                 booking isn't revived and no money moves automatically: the pro shop is emailed to refund or rebook
 *   'missing'   — no such booking
 * Throws on database / Stripe errors so the webhook returns 500 and Stripe retries (the refund is idempotent).
 */
export async function settlePaidBooking(supabase, env, intent, bookingId = intent.metadata?.bookingId) {
  const { data: booking, error } = await supabase
    .from('Booking')
    .select(`*, teeTimeSlot:TeeTimeSlot(id, date, startTime, maxPlayers, bookings:Booking(id, source, ${HOLD_COLUMNS}))`)
    .eq('id', bookingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!booking) return { action: 'missing' }

  const now = new Date()
  const slot = booking.teeTimeSlot
  const confirm = async fromStatuses => {
    const { error: updateError } = await supabase.from('Booking').update({ status: 'CONFIRMED', stripePaymentId: intent.id })
      .eq('id', booking.id).in('status', fromStatuses)
    if (updateError) throw new Error(updateError.message)
    return { action: 'confirmed' }
  }

  if (booking.status === 'CONFIRMED' || (booking.status === 'PENDING' && !isExpiredHold(booking, now))) {
    return confirm(['PENDING', 'CONFIRMED'])
  }

  if (booking.status === 'PENDING') {
    const others = (slot.bookings || []).filter(b => b.id !== booking.id)
    const room = slot.maxPlayers - bookedPlayers(others, now)
    const started = localDateTimeToUtc(slot.date, slot.startTime) < now
    if (room >= booking.players && !started) return confirm(['PENDING'])

    const stripe = makeStripe(env)
    if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set')
    try {
      await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `booking-hold-expired-${intent.id}` })
    } catch (e) {
      if (e?.code !== 'charge_already_refunded') throw e
    }
    const { error: updateError } = await supabase.from('Booking').update({ status: 'REFUNDED', stripePaymentId: intent.id })
      .eq('id', booking.id).eq('status', 'PENDING')
    if (updateError) throw new Error(updateError.message)
    const emailError = await sendBookingEmail(env, intent.receipt_email, 'Tee Time Payment Refunded — Deer Run Golf Course', [
      `Your payment for the ${slotWhen(slot)} tee time finished after we had to release the time, and it is no longer available.`,
      '',
      `We've refunded the full ${formatCents(intent.amount_received ?? intent.amount)} to your payment method. It can take 5–10 business days to appear.`,
      '',
      'Please book another time on our website or call the pro shop. Sorry for the trouble.',
    ])
    if (emailError) console.error('Booking refund email failed:', booking.id, emailError)
    return { action: 'refunded' }
  }

  // Already refunded (above on an earlier delivery, or by an admin in Stripe): nothing to do
  const stripe = makeStripe(env)
  if (stripe) {
    const { data: refunds } = await stripe.refunds.list({ payment_intent: intent.id, limit: 1 })
    if (refunds.length) return { action: 'refunded' }
  }

  console.error('Payment succeeded for a booking that is', booking.status, booking.id, intent.id)
  const emailError = await sendBookingEmail(env, env.CONTACT_EMAIL_TO, 'Paid online booking needs attention', [
    `An online payment of ${formatCents(intent.amount_received ?? intent.amount)} went through for a tee time booking that is ${booking.status.toLowerCase()}.`,
    '',
    `Tee time: ${slotWhen(slot)}, ${booking.players} player${booking.players === 1 ? '' : 's'}`,
    `Golfer: ${booking.guestName || intent.receipt_email || 'unknown'}${intent.receipt_email ? ` (${intent.receipt_email})` : ''}`,
    `Booking: ${booking.id}`,
    `Stripe payment: ${intent.id}`,
    '',
    'Either refund the payment in Stripe, or book the group again (Admin → Bookings can set the booking back to Confirmed if there is room).',
  ])
  if (emailError) console.error('Booking attention email failed:', booking.id, emailError)
  return { action: 'flagged' }
}

/** Ids of the slots (with their `bookings`/`Booking` list) that have an expired hold to release. */
export function slotsWithExpiredHolds(slots, key = 'bookings') {
  const now = new Date()
  return (slots || []).filter(s => (s[key] || []).some(b => isExpiredHold(b, now))).map(s => s.id)
}

/**
 * Releases the expired holds in these slots after the response is sent (context.waitUntil), so showing
 * availability isn't slowed down by Stripe calls. Capacity is already correct without it.
 */
export function releaseInBackground(context, supabase, slotIds) {
  if (!slotIds.length) return
  const work = releaseExpiredHolds(supabase, context.env, { slotIds })
    .then(s => { if (s.errors.length) console.error('Releasing unpaid bookings:', s.errors.join('; ')) })
    .catch(e => console.error('Releasing unpaid bookings:', e.message))
  if (typeof context.waitUntil === 'function') context.waitUntil(work)
}
