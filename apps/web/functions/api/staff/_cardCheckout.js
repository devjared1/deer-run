import { json } from '../admin/_auth.js'
import { makeStripe, isTestMode, stripeMessage } from './_stripe.js'
import { saveSale } from './sales/_save.js'
import { loadSale } from './sales/_sale.js'
import { toUtcIso } from '../../../src/lib/timeclock.js'
import { recordPayment, accountBalance } from '../admin/_houseAccounts.js'

// Card sales: the card is charged on the register's reader first and the sale is saved once Stripe says the
// payment succeeded, by whichever comes first: the register polling GET /api/staff/card-checkouts/:id, or the
// payment_intent.succeeded webhook. Completing is "claimed" with a conditional status update so the sale is
// saved exactly once.

// A claim older than this is assumed to have died mid-save and can be taken over
const STALE_CLAIM_MS = 2 * 60 * 1000

function serialize(c) {
  return {
    id: c.id,
    status: c.status,
    amountCents: c.amountCents,
    lastError: c.lastError,
    saleId: c.saleId,
    createdAt: toUtcIso(c.createdAt),
  }
}

async function load(supabase, id) {
  const { data, error } = await supabase.from('CardCheckout').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function update(supabase, id, fields) {
  const { data, error } = await supabase.from('CardCheckout').update({ ...fields, updatedAt: new Date().toISOString() })
    .eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

/** Sends the PaymentIntent to the reader. Returns an error message or null. */
async function sendToReader(stripe, checkout) {
  try {
    await stripe.terminal.readers.processPaymentIntent(checkout.stripeReaderId, { payment_intent: checkout.stripePaymentIntentId })
    return null
  } catch (e) {
    return stripeMessage(e)
  }
}

/**
 * Starts a card checkout: creates the PaymentIntent for the card part, saves the checkout with everything needed
 * to save the sale later, and sends the payment to the reader. A reader problem leaves the checkout PENDING with
 * lastError so the register can retry. Returns a Response.
 *   prepared: what saveSale needs, plus { registerId, cashierId, readerId, registerName, cardCents, createdBookingId }
 */
export async function startCardCheckout(supabase, env, prepared) {
  const stripe = makeStripe(env)
  if (!stripe) return json({ error: 'Card payments aren\'t set up (STRIPE_SECRET_KEY)' }, 503)

  const id = crypto.randomUUID()
  let intent
  try {
    intent = await stripe.paymentIntents.create({
      amount: prepared.cardCents,
      currency: 'usd',
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      description: prepared.kind === 'account_payment' ? 'Deer Run house account payment' : `Deer Run ${prepared.registerName} sale`,
      metadata: { cardCheckoutId: id, registerId: prepared.registerId, kind: prepared.kind ?? 'pos_sale' },
    }, { idempotencyKey: `card-checkout-${id}` })
  } catch (e) {
    return json({ error: stripeMessage(e) }, 502)
  }

  const { registerId, cashierId, readerId, registerName, cardCents, ...payload } = prepared
  const { data: checkout, error } = await supabase.from('CardCheckout').insert({
    id,
    registerId,
    cashierId,
    amountCents: cardCents,
    stripePaymentIntentId: intent.id,
    stripeReaderId: readerId,
    payload,
  }).select('*').single()
  if (error) {
    await stripe.paymentIntents.cancel(intent.id).catch(() => {})
    return json({ error: error.message }, 500)
  }

  const readerError = await sendToReader(stripe, checkout)
  const saved = readerError ? await update(supabase, id, { lastError: readerError }) : checkout
  return json({ cardCheckout: { ...serialize(saved), testMode: isTestMode(env) } }, 202)
}

/**
 * Saves the sale for a paid checkout. Safe to call from the register and the webhook at the same time.
 * Returns { checkout, sale?, warnings?, emailError? }.
 */
export async function completeCardCheckout(supabase, env, checkoutId, intent) {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString()
  const { data: claimed, error: claimError } = await supabase
    .from('CardCheckout')
    .update({ status: 'COMPLETING', updatedAt: new Date().toISOString() })
    .eq('id', checkoutId)
    .or(`status.in.(PENDING,SUCCEEDED),and(status.eq.COMPLETING,updatedAt.lt."${staleBefore}")`)
    .select('*')
    .maybeSingle()
  if (claimError) throw new Error(claimError.message)

  if (!claimed) {
    // Someone else completed it (or is completing it right now)
    const current = await load(supabase, checkoutId)
    const result = current?.payload?.result ?? {}
    return { checkout: current, sale: current?.saleId ? await loadSale(supabase, current.saleId) : null, ...result }
  }

  const amount = intent.amount_received ?? intent.amount
  if (intent.status !== 'succeeded' || amount !== claimed.amountCents) {
    const checkout = await update(supabase, claimed.id, {
      status: 'SUCCEEDED',
      lastError: `Stripe reports ${intent.status} for ${amount} cents; expected ${claimed.amountCents}. Check the payment in Stripe.`,
    })
    return { checkout }
  }

  const { payload } = claimed

  // A card payment on a house account (not a sale): record it on the account ledger
  if (payload.kind === 'account_payment') {
    const paid = await recordPayment(supabase, {
      accountId: payload.accountId, amountCents: claimed.amountCents, method: 'CARD',
      registerId: claimed.registerId, stripePaymentIntentId: intent.id, createdById: payload.createdById,
    })
    if (paid.error) {
      const checkout = await update(supabase, claimed.id, {
        status: 'SUCCEEDED', lastError: `The card was charged but the payment didn't save: ${paid.error}. Press "Save" to try again.`,
      })
      return { checkout }
    }
    const result = { accountPayment: { ...paid.entry, balanceCents: await accountBalance(supabase, payload.accountId) } }
    const checkout = await update(supabase, claimed.id, { status: 'COMPLETED', lastError: null, payload: { ...payload, result } })
    return { checkout, ...result }
  }

  // A walk-in booking was held as PENDING while the card was on the reader
  if (payload.createdBookingId) {
    await supabase.from('Booking').update({ status: 'CONFIRMED' }).eq('id', payload.createdBookingId)
  }
  const payments = payload.payments.map(p => (p.method === 'CARD_TERMINAL' ? { ...p, stripePaymentIntentId: intent.id } : p))
  const saved = await saveSale(supabase, env, { ...payload, payments })
  if (saved.error) {
    // The customer has paid: keep it retryable rather than losing it
    const checkout = await update(supabase, claimed.id, {
      status: 'SUCCEEDED',
      lastError: `The card was charged but the sale didn't save: ${saved.error}. Press "Save sale" to try again.`,
    })
    return { checkout }
  }

  const result = { warnings: saved.warnings, emailError: saved.emailError }
  const checkout = await update(supabase, claimed.id, {
    status: 'COMPLETED', saleId: saved.sale.id, lastError: null, payload: { ...payload, result },
  })
  return { checkout, sale: saved.sale, ...result }
}

/**
 * Brings a checkout up to date with Stripe and returns what the register should show:
 * { cardCheckout, sale?, warnings?, emailError? }. A declined card leaves it PENDING with lastError.
 */
export async function syncCardCheckout(supabase, env, checkout) {
  const testMode = isTestMode(env)
  if (checkout.status === 'COMPLETED') {
    const sale = checkout.saleId ? await loadSale(supabase, checkout.saleId) : null
    return { cardCheckout: { ...serialize(checkout), testMode }, sale, ...(checkout.payload?.result ?? {}) }
  }
  if (checkout.status === 'CANCELED') return { cardCheckout: { ...serialize(checkout), testMode } }

  const stripe = makeStripe(env)
  const intent = await stripe.paymentIntents.retrieve(checkout.stripePaymentIntentId)
  if (intent.status === 'succeeded') {
    const { checkout: done, ...rest } = await completeCardCheckout(supabase, env, checkout.id, intent)
    return { cardCheckout: { ...serialize(done), testMode }, ...rest }
  }
  if (intent.status === 'canceled') {
    return { cardCheckout: { ...serialize(await markCanceled(supabase, checkout)), testMode } }
  }

  // Still waiting: report a decline from the reader's last action for this payment
  let lastError = checkout.lastError
  try {
    const reader = await stripe.terminal.readers.retrieve(checkout.stripeReaderId)
    const action = reader.action
    if (action?.type === 'process_payment_intent' && action.process_payment_intent?.payment_intent === intent.id) {
      if (action.status === 'failed') lastError = action.failure_message || 'The card was declined'
      else if (action.status === 'in_progress') lastError = null
    }
  } catch (e) {
    lastError = stripeMessage(e)
  }
  if (lastError !== checkout.lastError) checkout = await update(supabase, checkout.id, { lastError })
  return { cardCheckout: { ...serialize(checkout), testMode } }
}

async function markCanceled(supabase, checkout) {
  if (checkout.payload?.createdBookingId) {
    await supabase.from('Booking').delete().eq('id', checkout.payload.createdBookingId).eq('status', 'PENDING')
  }
  return update(supabase, checkout.id, { status: 'CANCELED' })
}

/** Register actions on a checkout: retry | cancel | simulate | complete. Returns a Response. */
export async function cardCheckoutAction(supabase, env, checkout, action, options = {}) {
  const stripe = makeStripe(env)
  if (!stripe) return json({ error: 'Card payments aren\'t set up (STRIPE_SECRET_KEY)' }, 503)

  if (action === 'complete') {
    return json(await syncCardCheckout(supabase, env, checkout))
  }
  if (checkout.status !== 'PENDING') {
    return json({ error: `This card payment is already ${checkout.status.toLowerCase()}`, ...(await syncCardCheckout(supabase, env, checkout)) }, 409)
  }

  if (action === 'retry') {
    const readerError = await sendToReader(stripe, checkout)
    const saved = await update(supabase, checkout.id, { lastError: readerError })
    return json({ cardCheckout: { ...serialize(saved), testMode: isTestMode(env) } })
  }

  if (action === 'cancel') {
    await stripe.terminal.readers.cancelAction(checkout.stripeReaderId).catch(() => {})
    try {
      await stripe.paymentIntents.cancel(checkout.stripePaymentIntentId)
    } catch {
      // Already paid (the customer tapped just before cancel): finish the sale instead
      const synced = await syncCardCheckout(supabase, env, checkout)
      if (synced.cardCheckout.status !== 'CANCELED') return json({ ...synced, notice: 'The card had already been charged, so the sale was completed.' })
    }
    return json({ cardCheckout: { ...serialize(await markCanceled(supabase, checkout)), testMode: isTestMode(env) } })
  }

  if (action === 'simulate') {
    if (!isTestMode(env)) return json({ error: 'Simulated cards only work with Stripe test keys' }, 400)
    try {
      await stripe.testHelpers.terminal.readers.presentPaymentMethod(checkout.stripeReaderId, options.decline
        ? { card_present: { number: '4000000000000002' } } // Stripe's "card declined" test card
        : {})
    } catch (e) {
      return json({ error: stripeMessage(e) }, 502)
    }
    return json(await syncCardCheckout(supabase, env, checkout))
  }

  return json({ error: 'Unknown action' }, 400)
}
