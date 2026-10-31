import { requireAdmin, json } from '../_auth.js'
import { dollars, toCsv, csvResponse } from '../_csv.js'
import { parseDateRange, fetchAll } from './_report.js'
import { PAYMENT_LABELS, saleTipCents } from '../../staff/sales/_sale.js'
import { toUtcIso, localDate, COURSE_TZ } from '../../../../src/lib/timeclock.js'

const STATUSES = ['COMPLETED', 'PARTIALLY_REFUNDED', 'VOIDED', 'REFUNDED']
const LIST_SELECT =
  'id, number, status, isMemberPricing, subtotalCents, discountCents, taxCents, totalCents, refundedCents, createdAt, ' +
  'register:Register!Sale_registerId_fkey(id, name), cashier:Employee!Sale_cashierId_fkey(firstName, lastName), ' +
  'customer:User(name, email), payments:Payment(*)'

// GET /api/admin/sales?from=&to=&registerId=&status=&number=&page=&limit=
//   Sales rung up in a course-local date range (default today), newest first, paged.
//   `number` finds one receipt on any day and ignores the other filters.
// GET /api/admin/sales?...&format=csv&detail=sales|items
//   The whole range as CSV: one row per sale, or one row per item sold.
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const number = searchParams.get('number')?.trim()
  const status = searchParams.get('status')
  const registerId = searchParams.get('registerId')
  if (status && !STATUSES.includes(status)) return json({ error: 'Unknown status' }, 400)

  if (number) {
    if (!/^\d+$/.test(number)) return json({ error: 'Receipt number must be digits' }, 400)
    const { data, error } = await supabase.from('Sale').select(LIST_SELECT).eq('number', Number(number))
    if (error) return json({ error: error.message }, 500)
    return json({ sales: (data || []).map(serialize), total: data?.length ?? 0, page: 1, limit: 50 })
  }

  const range = parseDateRange(searchParams)
  if (range.error) return json({ error: range.error }, 400)

  const filtered = (q) => {
    q = q.gte('createdAt', range.startUtc).lt('createdAt', range.endUtc)
    if (status) q = q.eq('status', status)
    if (registerId) q = q.eq('registerId', registerId)
    return q
  }

  try {
    if (searchParams.get('format') === 'csv') {
      const detail = searchParams.get('detail') === 'items' ? 'items' : 'sales'
      const name = `${range.from}${range.to !== range.from ? `-to-${range.to}` : ''}`
      if (detail === 'items') {
        const rows = await fetchAll(() => filtered(supabase
          .from('Sale')
          .select('number, status, createdAt, items:SaleItem!SaleItem_saleId_fkey(*)')
          .order('createdAt', { ascending: true })))
        return csvResponse(itemsCsv(rows), `sales-items-${name}.csv`)
      }
      const rows = await fetchAll(() => filtered(supabase.from('Sale').select(LIST_SELECT).order('createdAt', { ascending: true })))
      return csvResponse(salesCsv(rows.map(serialize)), `sales-${name}.csv`)
    }

    const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1)
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get('limit'), 10) || 50))
    const { data, error, count } = await filtered(supabase
      .from('Sale')
      .select(LIST_SELECT, { count: 'exact' })
      .order('createdAt', { ascending: false })
      .range((page - 1) * limit, page * limit - 1))
    if (error) throw new Error(error.message)

    return json({ sales: (data || []).map(serialize), total: count ?? 0, page, limit, from: range.from, to: range.to })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

function serialize(sale) {
  return { ...sale, createdAt: toUtcIso(sale.createdAt) }
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function localParts(ts) {
  const d = new Date(toUtcIso(ts))
  return {
    date: localDate(d),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ }),
  }
}

function tenderSummary(payments) {
  if (!payments?.length) return 'No charge'
  return payments.map(p => `${PAYMENT_LABELS[p.method] ?? p.method} ${dollars(p.amountCents)}`).join('; ')
}

export function salesCsv(sales) {
  return toCsv(
    ['Receipt', 'Date', 'Time', 'Register', 'Cashier', 'Customer', 'Member Pricing', 'Status',
      'Discounts', 'Subtotal', 'Tax', 'Total', 'Refunded', 'Tenders', 'Card Tip'],
    sales.map(s => {
      const { date, time } = localParts(s.createdAt)
      return [
        s.number, date, time, s.register?.name ?? '',
        s.cashier ? `${s.cashier.firstName} ${s.cashier.lastName}` : '',
        s.customer ? (s.customer.name || s.customer.email) : '',
        s.isMemberPricing ? 'Yes' : 'No', s.status,
        dollars(s.discountCents), dollars(s.subtotalCents), dollars(s.taxCents), dollars(s.totalCents),
        dollars(s.refundedCents), tenderSummary(s.payments), dollars(saleTipCents(s)),
      ]
    }),
  )
}

export function itemsCsv(sales) {
  const rows = []
  for (const s of sales) {
    const { date } = localParts(s.createdAt)
    for (const i of [...s.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      rows.push([
        s.number, date, s.status, i.categoryName ?? '', i.description, i.quantity,
        dollars(i.unitPriceCents), dollars(i.discountCents), (i.taxRateBps / 100).toFixed(2),
        dollars(i.subtotalCents), dollars(i.taxCents), dollars(i.totalCents),
        i.refundedQuantity, dollars(i.refundedCents),
      ])
    }
  }
  return toCsv(
    ['Receipt', 'Date', 'Sale Status', 'Category', 'Item', 'Qty', 'Unit Price', 'Discount', 'Tax Rate %',
      'Subtotal', 'Tax', 'Total', 'Refunded Qty', 'Refunded'],
    rows,
  )
}
