import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { isTestMode } from '../_stripe.js'

// GET /api/staff/register/catalog — everything the register screen needs: active categories,
// active products with their active variants, the tax rate, and the active registers (with hasCardReader).
// cardTestMode: Stripe test keys, so the register offers "simulate a card" for the simulated reader.
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, isRegisterManager } = result

  const [settings, categories, products, registers] = await Promise.all([
    supabase.from('CourseSettings').select('salesTaxBps').eq('id', 'singleton').maybeSingle(),
    // (*): includes memberDiscount once that column exists (isMemberDiscountCategory falls back to names)
    supabase
      .from('ProductCategory')
      .select('*')
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
    supabase.from('Register').select('id, name, stripeReaderId').eq('active', true).order('name', { ascending: true }),
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
    // hasCardReader: the register can take cards (a reader is paired and Stripe is configured)
    registers: (registers.data || []).map(({ stripeReaderId, ...r }) => ({ ...r, hasCardReader: !!stripeReaderId && !!env.STRIPE_SECRET_KEY })),
    cardTestMode: isTestMode(env),
    isRegisterManager,
  })
}
