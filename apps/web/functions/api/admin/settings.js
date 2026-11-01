import { requireAdmin, json } from './_auth.js'
import { isValidYmd } from '../../../src/lib/timeclock.js'
import { POSITIONS } from './employees/_validate.js'
import { makeStripe, syncTerminalTipping, stripeMessage } from '../staff/_stripe.js'
import { MAX_ROUND_MINUTES, MIN_ROUND_MINUTES } from '../../../src/lib/pace.js'

const PAY_PERIOD_LENGTHS = [7, 14]
const MAX_TAX_BPS = 2000 // 20%
const MAX_TIP_PERCENT = 50
const MAX_LATE_FEE_CENTS = 50000 // house account late fee, $500

// GET /api/admin/settings
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
  return json(data)
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

  const { data, error } = await supabase
    .from('CourseSettings')
    .update(allowed)
    .eq('id', 'singleton')
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

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
