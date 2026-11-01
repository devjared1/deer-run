import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { bookedPlayers, HOLD_COLUMNS } from '../../../src/lib/teesheet.js'
import { releaseInBackground, slotsWithExpiredHolds } from './_holds.js'
import { loadRates } from '../_rates.js'
import { bookingPrice } from '../../../src/lib/rates.js'

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

// POST /api/bookings  { teeTimeSlotId, players (1–4), roundHoles? (9|18, default 18), cart? (bool), guestName?, guestEmail? }
//   (guest fields required when not signed in) → PENDING booking + PaymentIntent
//   → { bookingId, clientSecret, totalCents, players, roundHoles, cart }
export async function onRequestPost(context) {
  const { request, env } = context
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
  const roundHoles = body.roundHoles === undefined ? 18 : Number(body.roundHoles)
  const cart = body.cart === true

  if (!teeTimeSlotId || !players || players < 1 || players > 4) {
    return json({ error: 'teeTimeSlotId and players (1–4) are required' }, 400)
  }
  if (![9, 18].includes(roundHoles)) return json({ error: 'roundHoles must be 9 or 18' }, 400)
  if (!dbUser && (!guestName || !guestEmail)) {
    return json({ error: 'guestName and guestEmail required for unauthenticated bookings' }, 400)
  }

  // Check slot availability
  const { data: slot } = await supabase
    .from('TeeTimeSlot')
    .select(`*, Booking(${HOLD_COLUMNS})`)
    .eq('id', teeTimeSlotId)
    .maybeSingle()

  if (!slot) return json({ error: 'Tee time slot not found' }, 404)
  if (slot.memberOnly && !dbUser) return json({ error: 'This slot is for members only' }, 403)

  // Unpaid online bookings past their hold don't count (and are released in the background)
  releaseInBackground(context, supabase, slotsWithExpiredHolds([slot], 'Booking'))
  const booked = bookedPlayers(slot.Booking)

  if (booked + players > slot.maxPlayers) {
    return json({ error: 'Not enough spots available' }, 409)
  }

  // Price from the rate products (what the register charges): weekday/weekend × 9/18, plus the cart per rider
  const { rates, holidayDates } = await loadRates(supabase)
  const { totalCents } = bookingPrice({
    rates, holidayDates, ymd: String(slot.date).slice(0, 10), holes: roundHoles, players, cart,
  })
  const customerEmail = dbUser?.email ?? guestEmail
  const playerLabel = `${players} player${players > 1 ? 's' : ''}, ${roundHoles} holes${cart ? ', cart' : ''}`

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

  // Create PENDING booking first to get its ID for PaymentIntent metadata
  const bookingId = crypto.randomUUID()
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    receipt_email: customerEmail,
    description: `Deer Run Golf — Tee Time (${playerLabel})`,
    metadata: { bookingId },
  })

  const { error: bookingError } = await supabase
    .from('Booking')
    .insert({
      id: bookingId,
      teeTimeSlotId,
      userId: dbUser?.id ?? null,
      guestName: dbUser ? null : guestName,
      guestEmail: dbUser ? null : guestEmail,
      players,
      totalCents,
      roundHoles,
      // Only sent when true, so walking bookings still work on a database without migration 11
      ...(cart ? { cartIncluded: true } : {}),
      status: 'PENDING',
      stripePaymentId: paymentIntent.id,
    })

  if (bookingError) {
    // Clean up the PaymentIntent if booking insert fails
    await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {})
    return json({ error: bookingError.message }, 500)
  }

  // totalCents (what the PaymentIntent charges) and the round are echoed so the payment step shows the server's amount
  return json({ bookingId, clientSecret: paymentIntent.client_secret, totalCents, players, roundHoles, cart })
}
