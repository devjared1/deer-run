import Stripe from 'stripe'

export const STRIPE_API_VERSION = '2023-10-16'

export function makeStripe(env) {
  if (!env.STRIPE_SECRET_KEY) return null
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })
}

/** Test mode keys (sk_test_…) allow Stripe's simulated reader and the "simulate a card" button. */
export function isTestMode(env) {
  return typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_test_')
}

// The course's Stripe Terminal location (readers are registered to it)
export const TERMINAL_LOCATION = {
  display_name: 'Deer Run Golf Course',
  address: { line1: '1175 County Road 100', city: 'Moulton', state: 'AL', postal_code: '35650', country: 'US' },
}

/** The course's Terminal location id, creating it the first time. */
export async function ensureTerminalLocation(stripe) {
  const { data } = await stripe.terminal.locations.list({ limit: 100 })
  const existing = data.find(l => l.display_name === TERMINAL_LOCATION.display_name) ?? data[0]
  if (existing) return existing.id
  return (await stripe.terminal.locations.create(TERMINAL_LOCATION)).id
}

/** A short, cashier-friendly message for a Stripe error. */
export function stripeMessage(e) {
  if (e?.code === 'terminal_reader_offline') return 'The card reader is offline. Check its power and Wi-Fi, then try again.'
  if (e?.code === 'terminal_reader_busy') return 'The card reader is busy with another payment. Cancel that on the reader, then try again.'
  if (e?.code === 'terminal_reader_timeout') return 'The card reader didn\'t answer in time. Try again.'
  return e?.message || 'Stripe error'
}
