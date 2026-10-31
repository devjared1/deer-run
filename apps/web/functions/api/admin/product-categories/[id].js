import { requireAdmin, json } from '../_auth.js'
import { parseCategory, categoryErrorResponse } from './_validate.js'

// PUT /api/admin/product-categories/:id
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: update, error: validationError } = parseCategory(body, { partial: true })
  if (validationError) return json({ error: validationError }, 400)
  if (!Object.keys(update).length) return json({ error: 'No fields to update' }, 400)

  const { data, error } = await supabase
    .from('ProductCategory')
    .update(update)
    .eq('id', params.id)
    .select('id, name, taxExempt, sortOrder, active')
    .maybeSingle()
  if (error) return categoryErrorResponse(error)
  if (!data) return json({ error: 'Category not found' }, 404)

  return json(data)
}

// DELETE /api/admin/product-categories/:id — only when it has no products
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase.from('ProductCategory').delete().eq('id', params.id).select('id')
  if (error) return categoryErrorResponse(error)
  if (!data?.length) return json({ error: 'Category not found' }, 404)

  return json({ success: true })
}
