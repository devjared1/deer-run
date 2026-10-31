import { json } from '../_auth.js'

export const PRODUCT_SELECT =
  'id, categoryId, name, description, priceCents, memberPriceCents, trackInventory, active, sortOrder, createdAt, ' +
  'category:ProductCategory(id, name, taxExempt), ' +
  'variants:ProductVariant(id, size, color, sku, barcode, priceCents, memberPriceCents, stockQty, active, sortOrder)'

// SKUs and barcodes: letters, digits, dot, dash, underscore (what scanners and labels produce)
const CODE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/
const MAX_CENTS = 10_000_000 // $100,000

export function serializeProduct(product) {
  const variants = [...(product.variants || [])].sort((a, b) => a.sortOrder - b.sortOrder)
  return { ...product, variants, totalStock: variants.reduce((sum, v) => sum + v.stockQty, 0) }
}

function parseCents(value, label, nullable) {
  if (value === null || value === undefined || value === '') {
    return nullable ? { value: null } : { error: `${label} is required` }
  }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > MAX_CENTS) return { error: `${label} must be between $0 and $100,000` }
  return { value: n }
}

function optionalText(value) {
  const s = String(value ?? '').trim()
  return s || null
}

/** Validates product fields. With partial = true only fields present in body are checked. */
export function parseProduct(body, { partial = false } = {}) {
  const data = {}
  const has = (f) => body[f] !== undefined

  if (has('categoryId') || !partial) {
    if (!body.categoryId) return { error: 'Category is required' }
    data.categoryId = String(body.categoryId)
  }
  if (has('name') || !partial) {
    const name = optionalText(body.name)
    if (!name) return { error: 'Name is required' }
    data.name = name
  }
  if (has('description')) data.description = optionalText(body.description)
  if (has('priceCents') || !partial) {
    const r = parseCents(body.priceCents, 'Price', false)
    if (r.error) return r
    data.priceCents = r.value
  }
  if (has('memberPriceCents')) {
    const r = parseCents(body.memberPriceCents, 'Member price', true)
    if (r.error) return r
    data.memberPriceCents = r.value
  }
  if (has('trackInventory')) data.trackInventory = Boolean(body.trackInventory)
  if (has('active')) data.active = Boolean(body.active)
  if (has('sortOrder')) {
    const n = Number(body.sortOrder)
    if (!Number.isInteger(n)) return { error: 'Sort order must be a whole number' }
    data.sortOrder = n
  }
  return { data }
}

/**
 * Validates the variant list. An empty list means one default variant (no size/color).
 * Otherwise every variant needs a size or color, and combinations, SKUs and barcodes must be unique.
 * Returns { variants } (each with optional id and initialStock) or { error }.
 */
export function parseVariants(list) {
  if (!Array.isArray(list)) return { error: 'variants must be a list' }
  const input = list.length ? list : [{}]
  const variants = []
  const combos = new Set()
  const codes = { sku: new Set(), barcode: new Set() }

  for (const [i, v] of input.entries()) {
    const label = input.length > 1 ? `Variant ${i + 1}` : 'Product'
    const variant = {
      id: v.id ? String(v.id) : null,
      size: optionalText(v.size),
      color: optionalText(v.color),
      sku: optionalText(v.sku),
      barcode: optionalText(v.barcode),
      active: v.active === undefined ? true : Boolean(v.active),
      sortOrder: i,
      initialStock: 0,
    }

    if (input.length > 1 && !variant.size && !variant.color) {
      return { error: `${label} needs a size or color (products with more than one variant are told apart by them)` }
    }
    const combo = `${variant.size ?? ''}|${variant.color ?? ''}`.toLowerCase()
    if (combos.has(combo)) return { error: `Two variants have the same size and color (${[variant.size, variant.color].filter(Boolean).join(' / ')})` }
    combos.add(combo)

    for (const field of ['sku', 'barcode']) {
      const value = variant[field]
      if (value === null) continue
      if (!CODE_PATTERN.test(value)) return { error: `${label}: ${field.toUpperCase()} may only contain letters, numbers, dots, dashes and underscores` }
      if (codes[field].has(value)) return { error: `${field.toUpperCase()} "${value}" is used twice` }
      codes[field].add(value)
    }

    for (const field of ['priceCents', 'memberPriceCents']) {
      const r = parseCents(v[field], `${label} ${field === 'priceCents' ? 'price' : 'member price'}`, true)
      if (r.error) return r
      variant[field] = r.value
    }

    if (!variant.id && v.initialStock !== undefined && v.initialStock !== null && v.initialStock !== '') {
      const n = Number(v.initialStock)
      if (!Number.isInteger(n) || n < 0) return { error: `${label}: starting stock must be a whole number, 0 or more` }
      variant.initialStock = n
    }

    variants.push(variant)
  }
  return { variants }
}

/** Returns an error message if any SKU/barcode is already used by another product's variant. */
export async function findCodeConflict(supabase, variants, productId = null) {
  const filters = []
  for (const field of ['sku', 'barcode']) {
    const values = variants.map(v => v[field]).filter(Boolean)
    // Safe to quote directly: CODE_PATTERN allows no quotes, commas or parentheses
    if (values.length) filters.push(`${field}.in.(${values.map(s => `"${s}"`).join(',')})`)
  }
  if (!filters.length) return null

  let query = supabase.from('ProductVariant').select('sku, barcode, productId, product:Product(name)').or(filters.join(','))
  if (productId) query = query.neq('productId', productId)
  const { data, error } = await query.limit(1)
  if (error) return error.message
  if (!data?.length) return null

  const hit = data[0]
  const field = variants.some(v => v.sku && v.sku === hit.sku) ? 'SKU' : 'Barcode'
  const value = field === 'SKU' ? hit.sku : hit.barcode
  return `${field} "${value}" is already used by ${hit.product?.name ?? 'another product'}`
}

/** Variant row for insert/update (without id and initialStock). */
export function variantRow(v) {
  const { id: _id, initialStock: _stock, ...row } = v
  return row
}

/** Gives new variants their starting stock through adjust_inventory. Returns warning messages. */
export async function applyInitialStock(supabase, inserted, userId) {
  const warnings = []
  for (const v of inserted) {
    if (!v.initialStock) continue
    const { error } = await supabase.rpc('adjust_inventory', {
      p_variant_id: v.id,
      p_quantity: v.initialStock,
      p_is_count: false,
      p_reason: 'INITIAL',
      p_note: 'Starting stock',
      p_user_id: userId,
    })
    if (error) warnings.push(`Starting stock wasn't saved for ${[v.size, v.color].filter(Boolean).join(' / ') || 'the product'}: ${error.message}`)
  }
  return warnings
}

export function productErrorResponse(error) {
  if (error.code === '23505') {
    const field = error.message.includes('barcode') ? 'barcode' : 'SKU'
    return json({ error: `That ${field} is already used by another product` }, 409)
  }
  if (error.code === '23503') {
    return json({ error: 'This product has sales or stock history, so it can\'t be deleted. Deactivate it instead.' }, 409)
  }
  return json({ error: error.message }, 500)
}
