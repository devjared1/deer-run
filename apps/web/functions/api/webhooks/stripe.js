import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { completeCardCheckout } from '../staff/_cardCheckout.js'
import { recordPayment } from '../admin/_houseAccounts.js'
import { settlePaidBooking } from '../bookings/_holds.js'
import { formatCents } from '../../../src/lib/money.js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestPost({ request, env }) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return json({ error: 'Missing stripe-signature header' }, 400)

  const rawBody = await request.text()

  let event
  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return json({ error: `Webhook signature verification failed: ${err.message}` }, 400)
  }

  // Register (POS) card payments: save the sale if the register hasn't already (e.g. it was closed mid-payment)
  if (event.type === 'payment_intent.succeeded' && event.data.object.metadata?.cardCheckoutId) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    try {
      const done = await completeCardCheckout(supabase, env, event.data.object.metadata.cardCheckoutId, event.data.object)
      if (done.checkout?.status === 'SUCCEEDED') console.error('POS card checkout charged but not saved:', done.checkout.id, done.checkout.lastError)
    } catch (e) {
      // 500 makes Stripe retry the webhook later
      return json({ error: e.message }, 500)
    }
    return json({ received: true })
  }

  // House accounts: online payments from My Account, and autopay charges on statements. Recording is idempotent
  // per PaymentIntent, so it's fine that the page (and the statements job) may have recorded it already.
  const meta = event.data.object.metadata ?? {}
  if (meta.houseAccountId && (meta.kind === 'account_payment' || meta.kind === 'autopay')) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    const intent = event.data.object
    if (event.type === 'payment_intent.succeeded') {
      const paid = await recordPayment(supabase, {
        accountId: meta.houseAccountId,
        amountCents: intent.amount_received ?? intent.amount,
        method: meta.kind === 'autopay' ? 'AUTOPAY' : 'ONLINE',
        stripePaymentIntentId: intent.id,
      })
      if (paid.error) return json({ error: paid.error }, 500)
      if (meta.statementId) {
        await supabase.from('Statement').update({ status: 'PAID', paidAt: new Date().toISOString(), autopayError: null })
          .eq('id', meta.statementId)
      }
    } else if (event.type === 'payment_intent.payment_failed' && meta.statementId) {
      await supabase.from('Statement')
        .update({ status: 'AUTOPAY_FAILED', autopayError: intent.last_payment_error?.message ?? 'The card was declined' })
        .eq('id', meta.statementId).neq('status', 'PAID')
    }
    return json({ received: true })
  }

  // Online tee time bookings
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object
    const bookingId = paymentIntent.metadata?.bookingId

    if (bookingId) {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })

      // Confirms the booking, unless it no longer holds its spots (released after its 30-minute hold, or
      // cancelled): then it's re-confirmed if there's still room, refunded, or flagged to the pro shop
      let settled
      try {
        settled = await settlePaidBooking(supabase, env, paymentIntent)
      } catch (e) {
        // 500 makes Stripe retry the webhook later
        return json({ error: e.message }, 500)
      }

      const customerEmail = paymentIntent.receipt_email

      if (settled.action === 'confirmed' && env.RESEND_API_KEY && customerEmail) {
        const { data: booking } = await supabase
          .from('Booking')
          .select('*, teeTimeSlot:TeeTimeSlot(date, startTime)')
          .eq('id', bookingId)
          .maybeSingle()

        if (booking) {
          const slotDate = new Date(booking.teeTimeSlot.date).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
          })
          const [h, m] = booking.teeTimeSlot.startTime.split(':').map(Number)
          const slotTime = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
          // Pay at course: only the hold fee was charged; the rest is paid at the pro shop
          const payment = booking.holdFeeCents != null
            ? [
                `Hold Fee Paid: ${formatCents(booking.holdFeeCents)} (non-refundable if the booking is cancelled or missed)`,
                `Due at the Course: ${formatCents(booking.balanceDueCents)}, at the pro shop when you check in`,
              ]
            : [`Total Paid: ${formatCents(booking.totalCents)}`]

          const resend = new Resend(env.RESEND_API_KEY)
          await resend.emails.send({
            from: 'noreply@deerrun.golf',
            to: customerEmail,
            subject: 'Tee Time Confirmed — Deer Run Golf Course',
            text: [
              'Your tee time at Deer Run Golf Course is confirmed!',
              '',
              `Date: ${slotDate}`,
              `Tee Time: ${slotTime}`,
              `Players: ${booking.players}`,
              ...payment,
              '',
              'We look forward to seeing you on the course.',
              'Pro Shop: (256) 974-7384',
              '1175 County Road 100, Moulton, AL 35650',
            ].join('\n'),
          })
        }
      }
    }
  }

  return json({ received: true })
}
