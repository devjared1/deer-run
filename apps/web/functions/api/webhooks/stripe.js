import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'

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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const bookingId = session.metadata?.bookingId

    if (bookingId) {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })

      await supabase
        .from('Booking')
        .update({ status: 'CONFIRMED', stripePaymentId: session.payment_intent })
        .eq('id', bookingId)

      const customerEmail = session.customer_details?.email || session.customer_email

      if (env.RESEND_API_KEY && customerEmail) {
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
          const total = `$${(booking.totalCents / 100).toFixed(0)}`

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
              `Total Paid: ${total}`,
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
