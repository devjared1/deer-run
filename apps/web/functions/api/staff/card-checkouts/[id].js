import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { syncCardCheckout, cardCheckoutAction } from '../_cardCheckout.js'
import { stripeMessage } from '../_stripe.js'

async function loadCheckout(supabase, id) {
  const { data } = await supabase.from('CardCheckout').select('*').eq('id', id).maybeSingle()
  return data
}

// GET /api/staff/card-checkouts/:id — the register polls this while the card is on the reader.
// Returns { cardCheckout: { id, status, amountCents, lastError, saleId, testMode }, sale?, warnings?, emailError? }.
// When Stripe reports the payment succeeded, this saves the sale (if the webhook hasn't already).
export async function onRequestGet({ request, env, params }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const checkout = await loadCheckout(result.supabase, params.id)
  if (!checkout) return json({ error: 'Card payment not found' }, 404)
  try {
    return json(await syncCardCheckout(result.supabase, env, checkout))
  } catch (e) {
    return json({ error: stripeMessage(e) }, 502)
  }
}

// POST /api/staff/card-checkouts/:id
//   { action: 'retry' }               send the payment to the reader again (after a decline or a reader error)
//   { action: 'cancel' }              cancel on the reader and in Stripe (completes instead if already paid)
//   { action: 'simulate', decline? }  test mode only: present Stripe's test card on a simulated reader
//   { action: 'complete' }            retry saving the sale for a payment that's charged but not saved
export async function onRequestPost({ request, env, params }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const checkout = await loadCheckout(result.supabase, params.id)
  if (!checkout) return json({ error: 'Card payment not found' }, 404)
  try {
    return await cardCheckoutAction(result.supabase, env, checkout, body?.action, { decline: !!body?.decline })
  } catch (e) {
    return json({ error: stripeMessage(e) }, 502)
  }
}
