import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'

// GET /api/staff/register/catalog — everything the register screen needs: active categories,
// active products with their active variants, the tax rate, and the active registers.
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, isRegisterManager } = result

  const [settings, categories, products, registers] = await Promise.all([
    supabase.from('CourseSettings').select('salesTaxBps').eq('id', 'singleton').maybeSingle(),
    supabase
      .from('ProductCategory')
      .select('id, name, taxExempt, sortOrder')
      .eq('active', true)
      .order('sortOrder', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('Product')
      .select('id, categoryId, name, priceCents, memberPriceCents, trackInventory, sortOrder, membershipMonths, membershipTier, ' +
        'variants:ProductVariant(id, size, color, sku, barcode, priceCents, memberPriceCents, stockQty, active, sortOrder)')
      .eq('active', true)
      .order('sortOrder', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('Register').select('id, name').eq('active', true).order('name', { ascending: true }),
  ])
  const failed = [settings, categories, products, registers].find(r => r.error)
  if (failed) return json({ error: failed.error.message }, 500)

  const activeCategoryIds = new Set(categories.data.map(c => c.id))
  const sellable = products.data
    .filter(p => activeCategoryIds.has(p.categoryId))
    .map(p => ({
      ...p,
      variants: p.variants.filter(v => v.active).sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter(p => p.variants.length)

  return json({
    salesTaxBps: settings.data?.salesTaxBps ?? 0,
    categories: categories.data,
    products: sellable,
    registers: registers.data,
    isRegisterManager,
  })
}
