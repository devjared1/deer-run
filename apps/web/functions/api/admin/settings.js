import { requireAdmin, json } from './_auth.js'
import { isValidYmd } from '../../../src/lib/timeclock.js'
import { POSITIONS } from './employees/_validate.js'

const PAY_PERIOD_LENGTHS = [7, 14]
const MAX_TAX_BPS = 2000 // 20%

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
  for (const f of ['registerPositions', 'managerPositions']) {
    if (body[f] === undefined) continue
    if (!Array.isArray(body[f]) || body[f].some(p => !POSITIONS.includes(p))) {
      return json({ error: `${f} must be a list of positions` }, 400)
    }
    allowed[f] = [...new Set(body[f])]
  }

  const { data, error } = await supabase
    .from('CourseSettings')
    .update(allowed)
    .eq('id', 'singleton')
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)
  return json(data)
}
