import { json } from '../../admin/_auth.js'
import { makeStripe, stripeMessage } from '../../staff/_stripe.js'
import { golferBooking, linkTokenFrom } from '../_golfer.js'
import { cancelBookingPayment } from '../_holds.js'
import { slotWhen } from '../_email.js'
import { formatCents } from '../../../../src/lib/money.js'
import {
  applyChange, CHANGE_BOOKING_SELECT, quoteChange, recordChange, serializeChange,
} from '../_change.js'

// POST /api/bookings/:id/change[?t=<link token>] — the golfer changes their own online booking (see _change.js):
// signed in as its owner, or with the signed link from the booking emails (guests).
//   { teeTimeSlotId, players, preview: true }  → { quote }  (nothing changes)
//   { teeTimeSlotId, players }                 → the change, one of:
//       { status: 'applied', change, booking, warning? }   (same or lower price, or pay at course: done now)
//       { status: 'payment_required', change, clientSecret, chargeCents }  (pay the difference, then confirm)
//       { status: 'failed', change, error }
//   { action: 'confirm', changeId }  after the Payment Element succeeds → applied / failed, or
//       { status: 'processing' } while the payment is still going through (the webhook finishes it)
//   { action: 'cancel', changeId }   the golfer closed the payment: its PaymentIntent is cancelled → { status: 'cancelled' }
//       (if it had just been paid, the change is applied instead)
// 409 NOT_CHANGEABLE (paid at the pro shop, within 24 hours, checked in…), NO_ROOM; 404 for someone else's booking.
export async function onRequestPost({ request, env, params }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const access = await golferBooking(request, env, params.id, CHANGE_BOOKING_SELECT, linkTokenFrom(request, body))
  if (access instanceof Response) return access
  const { supabase, booking, userId } = access
  const golferEmail = booking.user?.email ?? booking.guestEmail ?? undefined

  if (body?.action === 'confirm' || body?.action === 'cancel') return finishPayment(supabase, env, booking, body)

  const quote = await quoteChange(supabase, booking, body ?? {})
  if (quote.error) return json({ error: quote.error, code: quote.code }, quote.status)
  if (body.preview) return json({ quote })

  try {
    // Same or lower price, or pay at course: make the change now
    if (!quote.chargeCents) {
      const change = await recordChange(supabase, booking, quote, { userId, status: 'PENDING_PAYMENT' })
      return respond(supabase, booking.id, await applyChange(supabase, env, change.id))
    }

    // A higher price: the golfer pays the difference first. Any earlier unfinished change is dropped.
    const stripe = makeStripe(env)
    if (!stripe) return json({ error: 'Online payments aren\'t set up. Call the pro shop to change this booking.' }, 503)
    await dropUnpaidChanges(supabase, stripe, booking.id)

    const change = await recordChange(supabase, booking, quote, { userId, status: 'PENDING_PAYMENT' })
    let intent
    try {
      intent = await stripe.paymentIntents.create({
        amount: quote.chargeCents,
        currency: 'usd',
        receipt_email: golferEmail,
        description: `Deer Run Golf — Tee time change to ${slotWhen(quote.slot)}, ${quote.players} player${quote.players === 1 ? '' : 's'} ` +
          `(difference ${formatCents(quote.chargeCents)})`,
        metadata: { bookingChangeId: change.id },
      })
    } catch (e) {
      await supabase.from('BookingChange').update({ status: 'FAILED', failureReason: `payment not started: ${stripeMessage(e)}` }).eq('id', change.id)
      return json({ error: `The payment couldn't be started: ${stripeMessage(e)}` }, 502)
    }
    const { error: saveError } = await supabase.from('BookingChange').update({ stripePaymentIntentId: intent.id }).eq('id', change.id)
    if (saveError) {
      await stripe.paymentIntents.cancel(intent.id).catch(() => {})
      return json({ error: saveError.message }, 500)
    }
    return json({
      status: 'payment_required',
      change: serializeChange({ ...change, stripePaymentIntentId: intent.id }),
      clientSecret: intent.client_secret,
      chargeCents: quote.chargeCents,
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

async function finishPayment(supabase, env, booking, { action, changeId }) {
  const { data: change, error } = await supabase.from('BookingChange').select('*')
    .eq('id', changeId ?? '').eq('bookingId', booking.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!change) return json({ error: 'Change not found' }, 404)
  if (change.status !== 'PENDING_PAYMENT') return respond(supabase, booking.id, { change, applied: change.status === 'APPLIED' })

  const stripe = makeStripe(env)
  if (!stripe || !change.stripePaymentIntentId) return json({ error: 'This change has no online payment' }, 409)
  try {
    if (action === 'cancel') {
      const { outcome } = await cancelBookingPayment(stripe, change.stripePaymentIntentId)
      if (outcome === 'cancelled') {
        await supabase.from('BookingChange').update({ status: 'CANCELLED' }).eq('id', change.id).eq('status', 'PENDING_PAYMENT')
        return json({ status: 'cancelled' })
      }
      if (outcome === 'processing') return json({ status: 'processing' })
      // It was paid after all: make the change
    } else {
      const intent = await stripe.paymentIntents.retrieve(change.stripePaymentIntentId)
      if (intent.status === 'processing') return json({ status: 'processing' })
      if (intent.status !== 'succeeded') return json({ error: 'The payment for this change isn\'t finished.' }, 409)
    }
    return respond(supabase, booking.id, await applyChange(supabase, env, change.id))
  } catch (e) {
    return json({ error: stripeMessage(e) }, 502)
  }
}

// Earlier changes the golfer started paying for and left: cancel their payments so they can't go through later
async function dropUnpaidChanges(supabase, stripe, bookingId) {
  const { data } = await supabase.from('BookingChange').select('id, stripePaymentIntentId')
    .eq('bookingId', bookingId).eq('status', 'PENDING_PAYMENT')
  for (const old of data || []) {
    if (!old.stripePaymentIntentId) continue
    const { outcome } = await cancelBookingPayment(stripe, old.stripePaymentIntentId).catch(() => ({ outcome: null }))
    if (outcome === 'cancelled') {
      await supabase.from('BookingChange').update({ status: 'CANCELLED' }).eq('id', old.id).eq('status', 'PENDING_PAYMENT')
    }
  }
}

async function respond(supabase, bookingId, outcome) {
  const { data: fresh } = await supabase.from('Booking').select('*, teeTimeSlot:TeeTimeSlot(date, startTime)').eq('id', bookingId).single()
  const change = serializeChange(outcome.change)
  if (outcome.applied) return json({ status: 'applied', change, booking: fresh, ...(outcome.warning ? { warning: outcome.warning } : {}) })
  if (outcome.change?.status === 'APPLYING') return json({ status: 'processing', change, booking: fresh })
  return json({
    status: 'failed',
    change,
    booking: fresh,
    error: `The change couldn't be made: ${outcome.reason ?? outcome.change?.failureReason ?? 'please try again'}.` +
      (outcome.change?.refundCents ? ` The ${formatCents(outcome.change.refundCents)} you paid was refunded.` : ''),
  })
}
