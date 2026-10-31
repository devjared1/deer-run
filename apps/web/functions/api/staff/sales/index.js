import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { buildSale } from './_build.js'
import { loadSale, emailReceipt } from './_sale.js'
import { consumeApproval } from '../_approvals.js'
import { localDate, isValidYmd, startOfLocalDay, addDays, toUtcIso } from '../../../../src/lib/timeclock.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/staff/sales?date=YYYY-MM-DD&registerId=&number=
// Sales for a course-local day (default today), newest first. `number` finds one receipt on any day.
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || localDate()
  const number = searchParams.get('number')
  if (!isValidYmd(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400)

  let query = supabase
    .from('Sale')
    .select('id, number, status, totalCents, refundedCents, createdAt, register:Register!Sale_registerId_fkey(name), ' +
      'cashier:Employee!Sale_cashierId_fkey(firstName, lastName), customer:User(name, email)')
    .order('createdAt', { ascending: false })
    .limit(200)

  if (number) {
    if (!/^\d+$/.test(number)) return json({ error: 'Receipt number must be digits' }, 400)
    query = query.eq('number', Number(number))
  } else {
    query = query
      .gte('createdAt', startOfLocalDay(date).toISOString())
      .lt('createdAt', startOfLocalDay(addDays(date, 1)).toISOString())
    if (searchParams.get('registerId')) query = query.eq('registerId', searchParams.get('registerId'))
  }

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)

  return json((data || []).map(s => ({ ...s, createdAt: toUtcIso(s.createdAt) })))
}

// POST /api/staff/sales — complete a sale at the register
// Body: { registerId, customerId?, items: [...], payments: [{ method, tenderedCents }],
//         expectedTotalCents, receiptEmail? }  (see buildSale for item shapes)
// Prices, tax and totals are recomputed here from the database; the client's numbers are
// only used to confirm the customer is charged what the register showed.
export async function onRequestPost({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const receiptEmail = body.receiptEmail ? String(body.receiptEmail).trim().toLowerCase() : null
  if (receiptEmail && !EMAIL_PATTERN.test(receiptEmail)) return json({ error: 'Receipt email is not valid' }, 400)

  const { data: register } = await supabase
    .from('Register')
    .select('id, active')
    .eq('id', body.registerId ?? '')
    .maybeSingle()
  if (!register?.active) return json({ error: 'This register is not set up or is inactive. Choose a register.' }, 400)

  let customer = null
  if (body.customerId) {
    const { data } = await supabase.from('User').select('id, role').eq('id', body.customerId).maybeSingle()
    if (!data) return json({ error: 'Customer not found' }, 400)
    customer = data
  }

  const variantIds = [...new Set((body.items || []).map(i => i?.variantId).filter(Boolean))]
  const [{ data: settings }, { data: variants, error: variantError }] = await Promise.all([
    supabase.from('CourseSettings').select('salesTaxBps').eq('id', 'singleton').maybeSingle(),
    variantIds.length
      ? supabase
        .from('ProductVariant')
        .select('id, size, color, priceCents, memberPriceCents, active, ' +
          'product:Product(id, name, priceCents, memberPriceCents, trackInventory, active, ' +
          'category:ProductCategory(name, taxExempt, active))')
        .in('id', variantIds)
      : Promise.resolve({ data: [] }),
  ])
  if (variantError) return json({ error: variantError.message }, 500)

  const built = buildSale({
    items: body.items,
    variantsById: Object.fromEntries((variants || []).map(v => [v.id, v])),
    isMember: customer?.role === 'MEMBER',
    taxBps: settings?.salesTaxBps ?? 0,
    payments: body.payments,
    expectedTotalCents: body.expectedTotalCents,
  })
  if (built.error) return json({ error: built.error, totals: built.totals }, built.status)

  // Only managers can discount: a discounted sale must carry an unused DISCOUNT approval
  let approval = null
  if (built.lines.some(l => l.discountCents > 0)) {
    approval = await consumeApproval(supabase, body.approvalId, { action: 'DISCOUNT', cashierId: employee.id })
    if (!approval) {
      return json({ error: 'Discounts need a manager\'s approval, and it may have expired. Approve the discount again.', code: 'APPROVAL_REQUIRED' }, 403)
    }
  }

  const { data: created, error } = await supabase.rpc('create_sale', {
    p_sale: {
      registerId: register.id,
      cashierId: employee.id,
      customerId: customer?.id ?? null,
      userId: dbUser.id,
      isMemberPricing: customer?.role === 'MEMBER',
      ...built.totals,
      changeCents: built.changeCents,
      receiptEmail,
    },
    p_items: built.lines,
    p_payments: built.payments,
  })
  if (error) return json({ error: error.message }, 500)

  if (approval) await supabase.from('ManagerApproval').update({ saleId: created.id }).eq('id', approval.id)

  const sale = await loadSale(supabase, created.id)
  const emailError = receiptEmail ? await emailReceipt(env, sale, receiptEmail) : null

  return json({ sale, emailError }, 201)
}
