import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { makeStripe, stripeMessage } from '../_stripe.js'

// GET /api/staff/register/reader?registerId= — the register's card reader status, asked of Stripe Terminal.
// → { readerStatus: 'online' | 'offline' | null, error? } (null: no reader paired, Stripe not set up, or Stripe
// didn't answer; `error` says why in the last case). The register polls this every 30 s, which also tells it
// whether the server can be reached at all (the connection-lost banner).
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const registerId = new URL(request.url).searchParams.get('registerId')
  if (!registerId) return json({ error: 'registerId is required' }, 400)

  const { data: register, error } = await supabase
    .from('Register')
    .select('stripeReaderId')
    .eq('id', registerId)
    .eq('active', true)
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!register) return json({ error: 'Register not found' }, 404)

  const stripe = makeStripe(env)
  if (!register.stripeReaderId || !stripe) return json({ readerStatus: null })
  try {
    const reader = await stripe.terminal.readers.retrieve(register.stripeReaderId)
    const status = reader.status === 'online' || reader.status === 'offline' ? reader.status : null
    return json({ readerStatus: status })
  } catch (e) {
    return json({ readerStatus: null, error: stripeMessage(e) })
  }
}
