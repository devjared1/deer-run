import { json } from '../_auth.js'

/** Validates a register payload; with partial = true only fields present are checked. */
export function parseRegister(body, { partial = false } = {}) {
  const data = {}
  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? '').trim()
    if (!name) return { error: 'Name is required' }
    data.name = name
  }
  if (body.stripeReaderId !== undefined) {
    const readerId = String(body.stripeReaderId ?? '').trim()
    if (readerId && !/^tmr_[A-Za-z0-9]+$/.test(readerId)) return { error: 'Card reader ID looks like tmr_… (from the Stripe dashboard)' }
    data.stripeReaderId = readerId || null
  }
  if (body.active !== undefined) data.active = Boolean(body.active)
  return { data }
}

export function registerErrorResponse(error) {
  if (error.code === '23505') {
    return json({ error: error.message.includes('stripeReaderId') ? 'That card reader is already assigned to another register' : 'A register with that name already exists' }, 409)
  }
  if (error.code === '23503') return json({ error: 'This register has sales, so it can\'t be deleted. Deactivate it instead.' }, 409)
  return json({ error: error.message }, 500)
}
