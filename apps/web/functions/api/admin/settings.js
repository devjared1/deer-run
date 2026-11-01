import { requireAdmin, json } from './_auth.js'
import { isValidYmd } from '../../../src/lib/timeclock.js'
import { POSITIONS } from './employees/_validate.js'
import { makeStripe, syncTerminalTipping, stripeMessage } from '../staff/_stripe.js'
import { MAX_ROUND_MINUTES, MIN_ROUND_MINUTES } from '../../../src/lib/pace.js'
import {
  MAX_PAY_AT_COURSE_FEE_CENTS, MIN_PAY_AT_COURSE_FEE_CENTS, RATE_KEYS, RATE_LABELS, RATE_PRODUCTS,
} from '../../../src/lib/rates.js'
import { formatCents } from '../../../src/lib/money.js'
import { loadRates } from '../_rates.js'

const PAY_PERIOD_LENGTHS = [7, 14]
const MAX_RATE_CENTS = 100000 // $1,000
const MAX_HOLIDAYS = 60
const MAX_TAX_BPS = 2000 // 20%
const MAX_TIP_PERCENT = 50
const MAX_LATE_FEE_CENTS = 50000 // house account late fee, $500

// GET /api/admin/settings → CourseSettings + rates: { WEEKDAY_9, WEEKDAY_18, WEEKEND_9, WEEKEND_18, CART } (cents)
// PUT takes any of the CourseSettings fields below, holidayDates ['YYYY-MM-DD'] and rates { key: cents }
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase
    .from('CourseSettings')
    .select('*')
    .eq('id', 'singleton')
    .single()

  if (error) return json({ error: error.message }, 500)
  return json({ ...data, ...(await ratesForAdmin(supabase)) })
}

// { rates: { key: cents } } from the rate products, or {} before migration 11 (no Product.rateKey yet)
async function ratesForAdmin(supabase) {
  const { error } = await supabase.from('Product').select('rateKey').limit(1)
  if (error) return {}
  const { rates } = await loadRates(supabase)
  return { rates }
}

/**
 * Sets each rate product's price (and clears variant price overrides, so the register charges exactly this).
 * A missing rate product is created in its category (made if needed). Returns an error message or null.
 */
async function saveRates(supabase, rates) {
  const { fromProducts } = await loadRates(supabase)
  const { data: tagged } = await supabase.from('Product').select('id, rateKey').not('rateKey', 'is', null)
  const byKey = Object.fromEntries((tagged ?? []).map(p => [p.rateKey, p.id]))

  for (const [key, cents] of Object.entries(rates)) {
    const productId = fromProducts[key] ?? byKey[key]
    if (productId) {
      const { error } = await supabase.from('Product').update({ priceCents: cents, active: true }).eq('id', productId)
      if (error) return error.message
      const { error: vErr } = await supabase.from('ProductVariant').update({ priceCents: null }).eq('productId', productId)
      if (vErr) return vErr.message
      continue
    }
    const def = RATE_PRODUCTS[key]
    let { data: category } = await supabase.from('ProductCategory').select('id').eq('name', def.category).maybeSingle()
    if (!category) {
      const { data: made, error: cErr } = await supabase
        .from('ProductCategory').insert({ id: crypto.randomUUID(), name: def.category }).select('id').single()
      if (cErr) return cErr.message
      category = made
    }
    const id = crypto.randomUUID()
    const { error: pErr } = await supabase.from('Product').insert({
      id, categoryId: category.id, name: def.name, description: def.description, priceCents: cents,
      memberPriceCents: key === 'CART' ? null : 0, rateKey: key, sortOrder: RATE_KEYS.indexOf(key),
    })
    if (pErr) return pErr.message
    const { error: vErr } = await supabase.from('ProductVariant').insert({ id: crypto.randomUUID(), productId: id })
    if (vErr) return vErr.message
  }
  return null
}

// PUT /api/admin/settings
export async function onRequestPut({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const body = await request.json()
  const allowed = {}
  const intFields = ['publicBookingDays', 'memberBookingDays', 'pricePerPlayerCents', 'intervalMinutes']
  const strFields = ['firstTeeTime', 'lastTeeTime']

  for (const f of intFields) if (body[f] !== undefined) allowed[f] = Number(body[f])
  for (const f of strFields) if (body[f] !== undefined) allowed[f] = String(body[f])

  if (body.payPeriodDays !== undefined) {
    if (!PAY_PERIOD_LENGTHS.includes(Number(body.payPeriodDays))) {
      return json({ error: 'Pay period must be weekly (7) or bi-weekly (14)' }, 400)
    }
    allowed.payPeriodDays = Number(body.payPeriodDays)
  }
  if (body.payPeriodAnchor !== undefined) {
    if (!isValidYmd(body.payPeriodAnchor)) return json({ error: 'Pay period start must be a date (YYYY-MM-DD)' }, 400)
    allowed.payPeriodAnchor = body.payPeriodAnchor
  }

  if (body.salesTaxBps !== undefined) {
    const bps = Number(body.salesTaxBps)
    if (!Number.isInteger(bps) || bps < 0 || bps > MAX_TAX_BPS) {
      return json({ error: 'Sales tax rate must be between 0% and 20%, to two decimal places' }, 400)
    }
    allowed.salesTaxBps = bps
  }
  if (body.lateFeeCents !== undefined) {
    const fee = Number(body.lateFeeCents)
    if (!Number.isInteger(fee) || fee < 0 || fee > MAX_LATE_FEE_CENTS) {
      return json({ error: 'The late fee must be between $0 (off) and $500' }, 400)
    }
    allowed.lateFeeCents = fee
  }
  // Pay at course: hold fee per online booking (0 = online bookings pay in full)
  if (body.payAtCourseFeeCents !== undefined) {
    const fee = Number(body.payAtCourseFeeCents)
    if (!Number.isInteger(fee) || (fee !== 0 && (fee < MIN_PAY_AT_COURSE_FEE_CENTS || fee > MAX_PAY_AT_COURSE_FEE_CENTS))) {
      return json({ error: `The hold fee must be $0 (off) or between ${formatCents(MIN_PAY_AT_COURSE_FEE_CENTS)} and ${formatCents(MAX_PAY_AT_COURSE_FEE_CENTS)}` }, 400)
    }
    allowed.payAtCourseFeeCents = fee
  }
  if (body.roundMinutes !== undefined) {
    const minutes = Number(body.roundMinutes)
    if (!Number.isInteger(minutes) || minutes < MIN_ROUND_MINUTES || minutes > MAX_ROUND_MINUTES) {
      return json({ error: `The expected round must be between ${MIN_ROUND_MINUTES / 60} and ${MAX_ROUND_MINUTES / 60} hours` }, 400)
    }
    allowed.roundMinutes = minutes
  }
  for (const f of ['registerPositions', 'managerPositions', 'coursePositions']) {
    if (body[f] === undefined) continue
    if (!Array.isArray(body[f]) || body[f].some(p => !POSITIONS.includes(p))) {
      return json({ error: `${f} must be a list of positions` }, 400)
    }
    allowed[f] = [...new Set(body[f])]
  }

  // On-reader tipping (off by default): up to 3 whole-number percentages shown on the card reader
  if (body.tippingEnabled !== undefined) allowed.tippingEnabled = !!body.tippingEnabled
  if (body.tipPreTax !== undefined) allowed.tipPreTax = !!body.tipPreTax
  if (body.tipPercentages !== undefined) {
    const list = Array.isArray(body.tipPercentages) ? body.tipPercentages.map(Number) : []
    if (!list.length || list.length > 3 || list.some(p => !Number.isInteger(p) || p < 1 || p > MAX_TIP_PERCENT)) {
      return json({ error: `Tip suggestions must be 1 to 3 whole percentages between 1 and ${MAX_TIP_PERCENT}` }, 400)
    }
    allowed.tipPercentages = [...new Set(list)].sort((a, b) => a - b)
  }

  // Weekend rates apply on these dates too
  if (body.holidayDates !== undefined) {
    const list = Array.isArray(body.holidayDates) ? body.holidayDates : []
    if (list.length > MAX_HOLIDAYS || list.some(d => !isValidYmd(d))) {
      return json({ error: `Holidays must be dates (YYYY-MM-DD), at most ${MAX_HOLIDAYS}` }, 400)
    }
    allowed.holidayDates = [...new Set(list)].sort()
  }

  // Greens fee and cart rates (cents), saved onto the rate products the register sells
  let rates = null
  if (body.rates !== undefined) {
    rates = {}
    for (const key of RATE_KEYS) {
      if (body.rates?.[key] === undefined) continue
      const cents = Number(body.rates[key])
      if (!Number.isInteger(cents) || cents < 0 || cents > MAX_RATE_CENTS) {
        return json({ error: `${RATE_LABELS[key]} must be between $0 and $${MAX_RATE_CENTS / 100}` }, 400)
      }
      rates[key] = cents
    }
  }

  const { data, error } = await supabase
    .from('CourseSettings')
    .update(allowed)
    .eq('id', 'singleton')
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  if (rates && Object.keys(rates).length) {
    const ratesError = await saveRates(supabase, rates)
    if (ratesError) return json({ error: `Settings saved, but the rates weren't: ${ratesError}` }, 500)
  }
  Object.assign(data, await ratesForAdmin(supabase))

  // The readers take the tip percentages from Stripe (a Terminal configuration). The setting is saved either way;
  // a Stripe problem comes back as a warning.
  let warning = null
  if (data.tippingEnabled && (allowed.tippingEnabled || allowed.tipPercentages)) {
    const stripe = makeStripe(env)
    if (!stripe) warning = 'Card payments aren\'t set up (STRIPE_SECRET_KEY), so the readers can\'t show tips yet.'
    else {
      try {
        await syncTerminalTipping(stripe, data.tipPercentages)
      } catch (e) {
        warning = `Saved, but the tip percentages didn't reach the card readers: ${stripeMessage(e)}. Save again to retry.`
      }
    }
  }
  return json(warning ? { ...data, warning } : data)
}
