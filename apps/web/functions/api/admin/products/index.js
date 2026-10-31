import { requireAdmin, json } from '../_auth.js'
import {
  PRODUCT_SELECT, serializeProduct, parseProduct, parseVariants, findCodeConflict,
  variantRow, applyInitialStock, productErrorResponse,
} from './_validate.js'

// GET /api/admin/products?categoryId=&search=&status=active|inactive|all
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('categoryId')
  const search     = searchParams.get('search')
  const status     = searchParams.get('status') || 'all'

  let query = supabase
    .from('Product')
    .select(PRODUCT_SELECT)
    .order('sortOrder', { ascending: true })
    .order('name', { ascending: true })

  if (categoryId) query = query.eq('categoryId', categoryId)
  if (status === 'active')   query = query.eq('active', true)
  if (status === 'inactive') query = query.eq('active', false)
  if (search) {
    // Strip characters that have meaning in PostgREST filter syntax
    const term = search.replace(/[,()*%"]/g, ' ').trim()
    if (term) query = query.ilike('name', `%${term}%`)
  }

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)

  return json((data || []).map(serializeProduct))
}

// POST /api/admin/products — create a product with its variants
// Body: product fields + variants: [{ size, color, sku, barcode, priceCents, memberPriceCents, active, initialStock }]
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: fields, error: productError } = parseProduct(body)
  if (productError) return json({ error: productError }, 400)
  const { variants, error: variantError } = parseVariants(body.variants ?? [])
  if (variantError) return json({ error: variantError }, 400)

  const { data: category } = await supabase.from('ProductCategory').select('id').eq('id', fields.categoryId).maybeSingle()
  if (!category) return json({ error: 'Category not found' }, 400)

  const conflict = await findCodeConflict(supabase, variants)
  if (conflict) return json({ error: conflict }, 409)

  const productId = crypto.randomUUID()
  const { error } = await supabase.from('Product').insert({ id: productId, ...fields })
  if (error) return productErrorResponse(error)

  const inserted = variants.map(v => ({ ...v, id: crypto.randomUUID() }))
  const { error: insertError } = await supabase
    .from('ProductVariant')
    .insert(inserted.map(v => ({ id: v.id, productId, ...variantRow(v) })))
  if (insertError) {
    // Don't leave a product without variants behind
    await supabase.from('Product').delete().eq('id', productId)
    return productErrorResponse(insertError)
  }

  const warnings = fields.trackInventory ? await applyInitialStock(supabase, inserted, dbUser.id) : []

  const { data: saved } = await supabase.from('Product').select(PRODUCT_SELECT).eq('id', productId).single()
  return json({ ...serializeProduct(saved), warnings }, 201)
}
