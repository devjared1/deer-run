import { requireAdmin, json } from '../_auth.js'
import {
  PRODUCT_SELECT, serializeProduct, parseProduct, parseVariants, findCodeConflict,
  variantRow, applyInitialStock, productErrorResponse,
} from './_validate.js'

// PUT /api/admin/products/:id — update product fields and, if `variants` is sent, sync variants:
// variants with an id are updated, without an id are created, and missing ones are deleted
// (or deactivated if they have stock history). Stock itself only changes via /api/admin/inventory.
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: existing } = await supabase
    .from('Product')
    .select('id, trackInventory, variants:ProductVariant(id, size, color)')
    .eq('id', params.id)
    .maybeSingle()
  if (!existing) return json({ error: 'Product not found' }, 404)

  const { data: update, error: productError } = parseProduct(body, { partial: true })
  if (productError) return json({ error: productError }, 400)

  if (update.categoryId) {
    const { data: category } = await supabase.from('ProductCategory').select('id').eq('id', update.categoryId).maybeSingle()
    if (!category) return json({ error: 'Category not found' }, 400)
  }

  let variants = null
  if (body.variants !== undefined) {
    const parsed = parseVariants(body.variants)
    if (parsed.error) return json({ error: parsed.error }, 400)
    variants = parsed.variants

    const existingIds = new Set(existing.variants.map(v => v.id))
    if (variants.some(v => v.id && !existingIds.has(v.id))) {
      return json({ error: 'A variant in the request belongs to a different product' }, 400)
    }
    const conflict = await findCodeConflict(supabase, variants, existing.id)
    if (conflict) return json({ error: conflict }, 409)
  }

  if (Object.keys(update).length) {
    const { error } = await supabase.from('Product').update(update).eq('id', existing.id)
    if (error) return productErrorResponse(error)
  }

  const warnings = []
  if (variants) {
    for (const v of variants.filter(v => v.id)) {
      const { error } = await supabase.from('ProductVariant').update(variantRow(v)).eq('id', v.id)
      if (error) return productErrorResponse(error)
    }

    const created = variants.filter(v => !v.id).map(v => ({ ...v, id: crypto.randomUUID() }))
    if (created.length) {
      const { error } = await supabase
        .from('ProductVariant')
        .insert(created.map(v => ({ id: v.id, productId: existing.id, ...variantRow(v) })))
      if (error) return productErrorResponse(error)
      const tracking = update.trackInventory ?? existing.trackInventory
      if (tracking) warnings.push(...await applyInitialStock(supabase, created, dbUser.id))
    }

    const keep = new Set(variants.filter(v => v.id).map(v => v.id))
    for (const old of existing.variants.filter(v => !keep.has(v.id))) {
      const { error } = await supabase.from('ProductVariant').delete().eq('id', old.id)
      if (error?.code === '23503') {
        // Has stock history: keep it for the record but take it off sale
        await supabase.from('ProductVariant').update({ active: false }).eq('id', old.id)
        warnings.push(`${[old.size, old.color].filter(Boolean).join(' / ') || 'A variant'} has stock history, so it was deactivated instead of deleted`)
      } else if (error) {
        return productErrorResponse(error)
      }
    }
  }

  const { data: saved } = await supabase.from('Product').select(PRODUCT_SELECT).eq('id', existing.id).single()
  return json({ ...serializeProduct(saved), warnings })
}

// DELETE /api/admin/products/:id — refused if any variant has stock history (deactivate instead)
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase.from('Product').delete().eq('id', params.id).select('id')
  if (error) return productErrorResponse(error)
  if (!data?.length) return json({ error: 'Product not found' }, 404)

  return json({ success: true })
}
