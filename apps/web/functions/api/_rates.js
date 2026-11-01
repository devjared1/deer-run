import { withDefaultRates } from '../../src/lib/rates.js'

/**
 * The current greens fee and cart rates: { rates: { WEEKDAY_9, WEEKDAY_18, WEEKEND_9, WEEKEND_18, CART } (cents),
 * holidayDates: ['YYYY-MM-DD'], fromProducts: { key: productId } }.
 * Prices come from the active POS products tagged with Product.rateKey (what the register charges, including a
 * variant price override); a missing one falls back to DEFAULT_RATES. Before migration 11 (no rateKey column)
 * everything is the default.
 */
export async function loadRates(supabase) {
  const [{ data: products, error }, { data: settings }] = await Promise.all([
    supabase
      .from('Product')
      .select('id, rateKey, priceCents, active, variants:ProductVariant(priceCents, active, sortOrder)')
      .not('rateKey', 'is', null),
    supabase.from('CourseSettings').select('*').eq('id', 'singleton').maybeSingle(),
  ])

  const found = {}
  const fromProducts = {}
  if (!error) {
    for (const p of products ?? []) {
      if (!p.active) continue
      const variant = (p.variants ?? []).filter(v => v.active).sort((a, b) => a.sortOrder - b.sortOrder)[0]
      found[p.rateKey] = variant?.priceCents ?? p.priceCents
      fromProducts[p.rateKey] = p.id
    }
  }
  return { rates: withDefaultRates(found), holidayDates: settings?.holidayDates ?? [], fromProducts }
}
