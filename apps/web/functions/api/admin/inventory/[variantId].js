import { requireAdmin, json } from '../_auth.js'
import { toUtcIso } from '../../../../src/lib/timeclock.js'

const REASONS = ['INITIAL', 'RECEIVED', 'COUNT_CORRECTION', 'DAMAGED', 'RETURNED_TO_VENDOR', 'OTHER']
const MODES = ['add', 'remove', 'count']
const HISTORY_LIMIT = 50

// GET /api/admin/inventory/:variantId — current stock and recent adjustments (newest first)
export async function onRequestGet({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const [{ data: variant }, { data: history, error }] = await Promise.all([
    supabase.from('ProductVariant').select('id, size, color, stockQty, product:Product(name)').eq('id', params.variantId).maybeSingle(),
    supabase
      .from('InventoryAdjustment')
      .select('id, quantityChange, stockAfter, reason, note, userId, createdAt')
      .eq('variantId', params.variantId)
      .order('createdAt', { ascending: false })
      .limit(HISTORY_LIMIT),
  ])
  if (!variant) return json({ error: 'Product variant not found' }, 404)
  if (error) return json({ error: error.message }, 500)

  // userId is a plain column (no foreign key), so look up who made each change separately
  const userIds = [...new Set((history || []).map(h => h.userId).filter(Boolean))]
  const { data: users } = userIds.length
    ? await supabase.from('User').select('id, name, email').in('id', userIds)
    : { data: [] }
  const userName = Object.fromEntries((users || []).map(u => [u.id, u.name || u.email]))

  return json({
    variant,
    history: (history || []).map(h => ({ ...h, createdAt: toUtcIso(h.createdAt), by: userName[h.userId] ?? null })),
  })
}

// POST /api/admin/inventory/:variantId — { mode: add | remove | count, quantity, reason, note }
// add/remove change stock by quantity; count sets stock to the counted quantity.
export async function onRequestPost({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { mode, reason, note } = body
  const quantity = Number(body.quantity)
  if (!MODES.includes(mode)) return json({ error: `mode must be one of: ${MODES.join(', ')}` }, 400)
  if (!REASONS.includes(reason)) return json({ error: 'reason is not valid' }, 400)
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) {
    return json({ error: 'Quantity must be a whole number, 0 or more' }, 400)
  }
  if (mode !== 'count' && quantity === 0) return json({ error: 'Quantity must be more than 0' }, 400)

  const { data, error } = await supabase.rpc('adjust_inventory', {
    p_variant_id: params.variantId,
    p_quantity: mode === 'remove' ? -quantity : quantity,
    p_is_count: mode === 'count',
    p_reason: reason,
    p_note: typeof note === 'string' && note.trim() ? note.trim() : null,
    p_user_id: dbUser.id,
  })
  // P0001 = RAISE EXCEPTION in adjust_inventory (variant not found, stock below zero)
  if (error) return json({ error: error.message }, error.code === 'P0001' ? 400 : 500)

  return json({ adjustment: { ...data, createdAt: toUtcIso(data.createdAt) }, stockQty: data.stockAfter })
}
