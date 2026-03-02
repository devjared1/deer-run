import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function json(data, status = 200) {
  return Response.json(data, { status })
}

async function getOptionalUser(request, supabase) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7))
  if (error || !user) return null
  const { data: dbUser } = await supabase.from('User').select('*').eq('supabaseId', user.id).maybeSingle()
  return dbUser
}

export async function onRequestPost({ request, env }) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const dbUser = await getOptionalUser(request, supabase)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { teeTimeSlotId, players, guestName, guestEmail } = body

  if (!teeTimeSlotId || !players || players < 1 || players > 4) {
    return json({ error: 'teeTimeSlotId and players (1–4) are required' }, 400)
  }
  if (!dbUser && (!guestName || !guestEmail)) {
    return json({ error: 'guestName and guestEmail required for unauthenticated bookings' }, 400)
  }

  // Load course settings for price
  const { data: settings } = await supabase
    .from('CourseSettings')
    .select('pricePerPlayerCents')
    .eq('id', 'singleton')
    .single()

  if (!settings) return json({ error: 'Course settings not configured' }, 500)

  // Check slot availability
  const { data: slot } = await supabase
    .from('TeeTimeSlot')
    .select('*, Booking(players, status)')
    .eq('id', teeTimeSlotId)
    .maybeSingle()

  if (!slot) return json({ error: 'Tee time slot not found' }, 404)
  if (slot.memberOnly && !dbUser) return json({ error: 'This slot is for members only' }, 403)

  const booked = (slot.Booking || [])
    .filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + b.players, 0)

  if (booked + players > slot.maxPlayers) {
    return json({ error: 'Not enough spots available' }, 409)
  }

  // Create PENDING booking
  const totalCents = settings.pricePerPlayerCents * players
  const { data: booking, error: bookingError } = await supabase
    .from('Booking')
    .insert({
      id: crypto.randomUUID(),
      teeTimeSlotId,
      userId: dbUser?.id ?? null,
      guestName: dbUser ? null : guestName,
      guestEmail: dbUser ? null : guestEmail,
      players,
      totalCents,
      status: 'PENDING',
    })
    .select()
    .single()

  if (bookingError) return json({ error: bookingError.message }, 500)

  // Create Stripe Checkout session
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  const origin = new URL(request.url).origin
  const playerLabel = `${players} player${players > 1 ? 's' : ''}`

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Deer Run Golf — Tee Time (${playerLabel})` },
        unit_amount: totalCents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book`,
    metadata: { bookingId: booking.id },
    customer_email: dbUser?.email ?? guestEmail,
  })

  // Store Stripe session ID on the booking
  await supabase.from('Booking').update({ stripeSessionId: session.id }).eq('id', booking.id)

  return json({ bookingId: booking.id, checkoutUrl: session.url })
}
