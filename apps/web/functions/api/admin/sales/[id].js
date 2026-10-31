import { requireAdmin, json } from '../_auth.js'
import { loadSale, emailReceipt } from '../../staff/sales/_sale.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/admin/sales/:id — a sale with items, payments and refunds (same shape as the register's)
export async function onRequestGet({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  try {
    const sale = await loadSale(result.supabase, params.id)
    return sale ? json(sale) : json({ error: 'Sale not found' }, 404)
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/admin/sales/:id — { action: 'email', email } emails the receipt.
// Voids and refunds stay at the register, where the money changes hands.
export async function onRequestPost({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (body?.action !== 'email') return json({ error: "action must be 'email'" }, 400)

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) return json({ error: 'Enter a valid email address' }, 400)

  try {
    const sale = await loadSale(result.supabase, params.id)
    if (!sale) return json({ error: 'Sale not found' }, 404)
    const error = await emailReceipt(env, sale, email)
    if (error) return json({ error: `Couldn't send the receipt: ${error}` }, 502)
    return json({ success: true })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
