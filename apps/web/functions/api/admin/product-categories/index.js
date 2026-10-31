import { requireAdmin, json } from '../_auth.js'
import { parseCategory, categoryErrorResponse } from './_validate.js'

// GET /api/admin/product-categories — all categories with product counts
// (*): memberDiscount is only there once its migration has run; the admin page hides the column until then
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase
    .from('ProductCategory')
    .select('*, products:Product(count)')
    .order('sortOrder', { ascending: true })
    .order('name', { ascending: true })
  if (error) return json({ error: error.message }, 500)

  return json((data || []).map(({ products, ...c }) => ({ ...c, productCount: products?.[0]?.count ?? 0 })))
}

// POST /api/admin/product-categories
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

  const { data: fields, error: validationError } = parseCategory(body)
  if (validationError) return json({ error: validationError }, 400)

  const { data, error } = await supabase
    .from('ProductCategory')
    .insert({ id: crypto.randomUUID(), ...fields })
    .select('*')
    .single()
  if (error) return categoryErrorResponse(error)

  return json({ ...data, productCount: 0 }, 201)
}
