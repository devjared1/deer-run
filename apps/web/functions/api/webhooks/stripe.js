import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

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
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
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
    }
  }

  return json({ received: true })
}
