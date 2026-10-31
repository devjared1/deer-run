import { requireAdmin, json } from '../_auth.js'
import { makeStripe, isTestMode, ensureTerminalLocation, stripeMessage } from '../../staff/_stripe.js'

function serializeReader(r) {
  return {
    id: r.id,
    label: r.label,
    status: r.status, // 'online' | 'offline' | null
    deviceType: r.device_type,
    serialNumber: r.serial_number,
    location: r.location,
    simulated: r.device_type?.startsWith('simulated') || false,
  }
}

// GET /api/admin/registers/readers — the Stripe Terminal readers on the account with their online status
// (shown next to each register). Returns { configured, testMode, readers }.
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  const stripe = makeStripe(env)
  if (!stripe) return json({ configured: false, testMode: false, readers: [] })
  try {
    const { data } = await stripe.terminal.readers.list({ limit: 100 })
    return json({ configured: true, testMode: isTestMode(env), readers: data.map(serializeReader) })
  } catch (e) {
    return json({ error: stripeMessage(e) }, 502)
  }
}

// POST /api/admin/registers/readers — { registrationCode, label, registerId? }
// Pairs a reader with Stripe (registration code from the reader's settings screen; in test mode "simulated-wpe"
// creates a simulated reader), registers it to the course's Terminal location (created the first time), and
// assigns it to the register if registerId is given.
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const registrationCode = String(body?.registrationCode ?? '').trim()
  const label = String(body?.label ?? '').trim().slice(0, 100)
  if (!registrationCode) return json({ error: 'Enter the pairing code shown on the reader' }, 400)
  if (!label) return json({ error: 'Name the reader (e.g. the register\'s name)' }, 400)

  const stripe = makeStripe(env)
  if (!stripe) return json({ error: 'Stripe isn\'t set up (STRIPE_SECRET_KEY)' }, 503)

  let reader
  try {
    const location = await ensureTerminalLocation(stripe)
    reader = await stripe.terminal.readers.create({ registration_code: registrationCode, label, location })
  } catch (e) {
    return json({ error: stripeMessage(e) }, 502)
  }

  if (body.registerId) {
    const { error } = await supabase.from('Register').update({ stripeReaderId: reader.id }).eq('id', body.registerId)
    if (error) {
      const taken = error.code === '23505' ? ' (another register already uses it)' : ''
      return json({ error: `Paired ${reader.id}, but it wasn't assigned to the register${taken}: ${error.message}` }, 409)
    }
  }
  return json({ reader: serializeReader(reader) }, 201)
}
