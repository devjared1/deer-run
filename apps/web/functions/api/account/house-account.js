import { authenticate, json } from '../admin/_auth.js'
import {
  loadAccount, serializeAccount, accountBalance, recordPayment, serializeEntry, checkAccountPin, money,
} from '../admin/_houseAccounts.js'
import { PIN_PATTERN, hashPin } from '../staff/_pin.js'
import { makeStripe, stripeMessage } from '../staff/_stripe.js'
import { toUtcIso } from '../../../src/lib/timeclock.js'

// The signed-in member's own house account (My Account).

async function ownAccount(supabase, dbUser) {
  return loadAccount(supabase, { userId: dbUser.id })
}

// GET /api/account/house-account — { account: null } if the member doesn't have one, otherwise
// { account (balance, limit, PIN and autopay status), entries (latest 50), statements (latest 24) }
export async function onRequestGet({ request, env }) {
  const result = await authenticate(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result
  try {
    const account = await ownAccount(supabase, dbUser)
    if (!account) return json({ account: null })
    const [balance, entries, statements] = await Promise.all([
      accountBalance(supabase, account.id),
      supabase.from('HouseAccountEntry').select('id, type, amountCents, description, method, createdAt, sale:Sale(number)')
        .eq('accountId', account.id).order('createdAt', { ascending: false }).limit(50),
      supabase.from('Statement').select('id, periodStart, periodEnd, closingCents, dueDate, status, paidAt')
        .eq('accountId', account.id).order('periodStart', { ascending: false }).limit(24),
    ])
    return json({
      account: serializeAccount(account, balance),
      entries: (entries.data || []).map(serializeEntry),
      statements: (statements.data || []).map(s => ({ ...s, paidAt: toUtcIso(s.paidAt) })),
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

/** The member's Stripe Customer, created the first time (for online payments and autopay). */
async function ensureCustomer(stripe, supabase, account) {
  if (account.stripeCustomerId) return account.stripeCustomerId
  const customer = await stripe.customers.create({
    email: account.user?.email, name: account.user?.name || undefined,
    metadata: { houseAccountId: account.id, userId: account.userId },
  }, { idempotencyKey: `house-account-customer-${account.id}` })
  await supabase.from('HouseAccount').update({ stripeCustomerId: customer.id }).eq('id', account.id)
  return customer.id
}

// POST /api/account/house-account
//   { action: 'set_pin', currentPin?, newPin }        set or change the 4–6 digit PIN used at the register
//   { action: 'pay', amountCents }                    start an online payment → { clientSecret } (Stripe Payment Element)
//   { action: 'confirm_payment', paymentIntentId }    record a finished online payment (the webhook does too)
//   { action: 'autopay_setup' }                       save a card → { clientSecret } (SetupIntent)
//   { action: 'autopay_confirm', setupIntentId }      turn autopay on with the saved card
//   { action: 'autopay_disable' }                     turn autopay off and remove the saved card
export async function onRequestPost({ request, env }) {
  const result = await authenticate(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const account = await ownAccount(supabase, dbUser)
  if (!account) return json({ error: 'You don\'t have a house account. Ask at the pro shop to open one.' }, 404)

  if (body?.action === 'set_pin') {
    if (account.pinLockedAt) return json({ error: 'Your PIN is locked after too many wrong tries. Ask at the pro shop to reset it.' }, 423)
    if (account.pinHash) {
      const check = await checkAccountPin(supabase, account, body.currentPin)
      if (!check.ok) return json({ error: check.code === 'ACCOUNT_PIN' ? check.error.replace('Wrong PIN', 'Your current PIN is wrong') : check.error }, check.status)
    }
    if (!PIN_PATTERN.test(String(body.newPin ?? ''))) return json({ error: 'The new PIN must be 4 to 6 digits' }, 400)
    const { error } = await supabase.from('HouseAccount').update({ pinHash: await hashPin(String(body.newPin)), pinFailedAttempts: 0 }).eq('id', account.id)
    return error ? json({ error: error.message }, 500) : json({ success: true })
  }

  const stripe = makeStripe(env)
  if (!stripe) return json({ error: 'Online payments aren\'t set up yet' }, 503)

  try {
    if (body?.action === 'pay') {
      const balance = await accountBalance(supabase, account.id)
      const amount = Number(body.amountCents)
      if (balance < 50) return json({ error: 'There\'s nothing to pay right now' }, 400)
      if (!Number.isInteger(amount) || amount < 50 || amount > balance) {
        return json({ error: `Enter an amount between $0.50 and ${money(balance)}` }, 400)
      }
      const customer = await ensureCustomer(stripe, supabase, account)
      const intent = await stripe.paymentIntents.create({
        amount, currency: 'usd', customer,
        automatic_payment_methods: { enabled: true },
        receipt_email: account.user?.email,
        description: 'Deer Run house account payment',
        metadata: { kind: 'account_payment', houseAccountId: account.id, userId: dbUser.id },
      })
      return json({ clientSecret: intent.client_secret, paymentIntentId: intent.id })
    }

    if (body?.action === 'confirm_payment') {
      const intent = await stripe.paymentIntents.retrieve(String(body.paymentIntentId ?? ''))
      if (intent.metadata?.houseAccountId !== account.id) return json({ error: 'Payment not found' }, 404)
      if (intent.status !== 'succeeded') return json({ status: intent.status })
      const paid = await recordPayment(supabase, { accountId: account.id, amountCents: intent.amount_received, method: 'ONLINE', stripePaymentIntentId: intent.id })
      if (paid.error) return json({ error: paid.error }, paid.status)
      return json({ status: 'succeeded', balanceCents: await accountBalance(supabase, account.id) })
    }

    if (body?.action === 'autopay_setup') {
      const customer = await ensureCustomer(stripe, supabase, account)
      const intent = await stripe.setupIntents.create({
        customer, usage: 'off_session', payment_method_types: ['card'],
        metadata: { kind: 'autopay_setup', houseAccountId: account.id },
      })
      return json({ clientSecret: intent.client_secret })
    }

    if (body?.action === 'autopay_confirm') {
      const intent = await stripe.setupIntents.retrieve(String(body.setupIntentId ?? ''), { expand: ['payment_method'] })
      if (intent.customer !== account.stripeCustomerId || intent.metadata?.houseAccountId !== account.id) {
        return json({ error: 'Card setup not found' }, 404)
      }
      if (intent.status !== 'succeeded') return json({ error: `The card wasn't saved (${intent.status}). Try again.` }, 409)
      const pm = intent.payment_method
      // Replacing the card: remove the old one from Stripe
      if (account.stripePaymentMethodId && account.stripePaymentMethodId !== pm.id) {
        await stripe.paymentMethods.detach(account.stripePaymentMethodId).catch(() => {})
      }
      await supabase.from('HouseAccount').update({
        autopayEnabled: true, stripePaymentMethodId: pm.id, cardBrand: pm.card?.brand ?? null, cardLast4: pm.card?.last4 ?? null,
      }).eq('id', account.id)
      return json({ success: true, cardBrand: pm.card?.brand, cardLast4: pm.card?.last4 })
    }

    if (body?.action === 'autopay_disable') {
      if (account.stripePaymentMethodId) await stripe.paymentMethods.detach(account.stripePaymentMethodId).catch(() => {})
      await supabase.from('HouseAccount').update({ autopayEnabled: false, stripePaymentMethodId: null, cardBrand: null, cardLast4: null }).eq('id', account.id)
      return json({ success: true })
    }
  } catch (e) {
    return json({ error: stripeMessage(e) }, 502)
  }

  return json({ error: 'Unknown action' }, 400)
}
