import { isValidYmd, localDate, startOfLocalDay, addDays, daysBetween } from '../../../../src/lib/timeclock.js'
import { PAYMENT_LABELS } from '../../staff/sales/_sale.js'
import { fetchAll } from '../_db.js'
import { loadDrawerSessions } from '../../staff/_drawer.js'

// Longest range a report or export covers at once
export const MAX_REPORT_DAYS = 366

export { fetchAll }

/**
 * Validates ?from=&to= (course-local dates, inclusive; default today) or ?date= (one day).
 * Returns { from, to, startUtc, endUtc } (endUtc exclusive) or { error }.
 */
export function parseDateRange(searchParams) {
  const date = searchParams.get('date')
  const from = searchParams.get('from') || date || localDate()
  const to = searchParams.get('to') || date || from
  if (!isValidYmd(from) || !isValidYmd(to)) return { error: 'Dates must be YYYY-MM-DD' }
  if (to < from) return { error: 'The end date must be on or after the start date' }
  if (daysBetween(from, to) >= MAX_REPORT_DAYS) return { error: `The range can be at most ${MAX_REPORT_DAYS} days` }
  return {
    from, to,
    startUtc: startOfLocalDay(from).toISOString(),
    endUtc: startOfLocalDay(addDays(to, 1)).toISOString(),
  }
}

const UNCATEGORIZED = 'Custom / Misc'

/**
 * Builds a sales report (the end-of-day "Z" report when the range is one day) from:
 *   sales    — sales rung up in the range, with items { categoryName, quantity, subtotalCents, taxCents,
 *              totalCents, discountCents } and payments { method, amountCents }
 *   refunds  — voids and refunds made in the range (on sales from any day), with { kind, method,
 *              amountCents, taxCents, items: [{ quantity, amountCents, taxCents, saleItem: { categoryName } }] }
 *   noSales  — number of No Sale drawer openings in the range
 * Sales count in full on the day they were rung up; voids and refunds come off on the day they happen,
 * so a day's report never changes after the day ends. All amounts are in cents.
 */
export function buildReport({ sales, refunds, noSales = 0 }) {
  const categories = new Map()
  const category = name => {
    const key = name || UNCATEGORIZED
    if (!categories.has(key)) categories.set(key, { name: key, quantity: 0, salesCents: 0, taxCents: 0, refundedQuantity: 0, refundCents: 0, refundTaxCents: 0 })
    return categories.get(key)
  }
  const tenders = new Map()
  const tender = method => {
    if (!tenders.has(method)) tenders.set(method, { method, label: PAYMENT_LABELS[method] ?? method, count: 0, collectedCents: 0, refundedCents: 0 })
    return tenders.get(method)
  }

  const totals = { count: 0, grossCents: 0, discountCents: 0, salesCents: 0, taxCents: 0, totalCents: 0, noChargeCount: 0 }
  for (const sale of sales) {
    totals.count++
    totals.discountCents += sale.discountCents
    totals.salesCents += sale.subtotalCents
    totals.taxCents += sale.taxCents
    totals.totalCents += sale.totalCents
    if (!sale.payments?.length) totals.noChargeCount++
    for (const item of sale.items || []) {
      const c = category(item.categoryName)
      c.quantity += item.quantity
      c.salesCents += item.subtotalCents
      c.taxCents += item.taxCents
    }
    for (const p of sale.payments || []) {
      const t = tender(p.method)
      t.count++
      t.collectedCents += p.amountCents
    }
  }
  totals.grossCents = totals.salesCents + totals.discountCents

  const returns = { voidCount: 0, voidCents: 0, voidTaxCents: 0, refundCount: 0, refundCents: 0, refundTaxCents: 0, taxCents: 0 }
  for (const r of refunds) {
    if (r.kind === 'VOID') { returns.voidCount++; returns.voidCents += r.amountCents; returns.voidTaxCents += r.taxCents }
    else { returns.refundCount++; returns.refundCents += r.amountCents; returns.refundTaxCents += r.taxCents }
    returns.taxCents += r.taxCents
    tender(r.method).refundedCents += r.amountCents
    for (const item of r.items || []) {
      const c = category(item.saleItem?.categoryName)
      c.refundedQuantity += item.quantity
      c.refundCents += item.amountCents - item.taxCents
      c.refundTaxCents += item.taxCents
    }
  }
  const returnedCents = returns.voidCents + returns.refundCents

  const net = {
    salesCents: totals.salesCents - (returnedCents - returns.taxCents),
    taxCents: totals.taxCents - returns.taxCents,
    totalCents: totals.totalCents - returnedCents,
  }

  const categoryRows = [...categories.values()]
    .map(c => ({ ...c, netCents: c.salesCents - c.refundCents, netTaxCents: c.taxCents - c.refundTaxCents }))
    .sort((a, b) => b.netCents - a.netCents || a.name.localeCompare(b.name))
  const tenderRows = [...tenders.values()]
    .map(t => ({ ...t, netCents: t.collectedCents - t.refundedCents }))
    .sort((a, b) => b.netCents - a.netCents)

  const cash = tenders.get('CASH')
  return {
    sales: totals,
    returns,
    net,
    categories: categoryRows,
    tenders: tenderRows,
    // No opening float yet (cash drawer sessions are a later phase): this is cash in minus cash out
    cashExpectedCents: cash ? cash.collectedCents - cash.refundedCents : 0,
    noSaleCount: noSales,
  }
}

/** Loads the data for a report and builds it. `registerId` limits it to one register. */
export async function loadReport(supabase, range, registerId = null) {
  const scoped = q => (registerId ? q.eq('registerId', registerId) : q)

  const [sales, refunds, noSaleRes, registerRes, drawerSessions] = await Promise.all([
    fetchAll(() => scoped(supabase
      .from('Sale')
      .select('id, subtotalCents, discountCents, taxCents, totalCents, ' +
        'items:SaleItem!SaleItem_saleId_fkey(categoryName, quantity, subtotalCents, taxCents), payments:Payment(method, amountCents)')
      .gte('createdAt', range.startUtc)
      .lt('createdAt', range.endUtc)
      .order('createdAt', { ascending: true }))),
    fetchAll(() => scoped(supabase
      .from('SaleRefund')
      .select('id, kind, method, amountCents, taxCents, items:SaleRefundItem(quantity, amountCents, taxCents, saleItem:SaleItem(categoryName))')
      .gte('createdAt', range.startUtc)
      .lt('createdAt', range.endUtc)
      .order('createdAt', { ascending: true }))),
    scoped(supabase
      .from('ManagerApproval')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'NO_SALE')
      .gte('createdAt', range.startUtc)
      .lt('createdAt', range.endUtc)),
    registerId ? supabase.from('Register').select('id, name').eq('id', registerId).maybeSingle() : Promise.resolve({ data: null }),
    loadDrawerSessions(supabase, range, registerId),
  ])
  if (noSaleRes.error) throw new Error(noSaleRes.error.message)

  return {
    from: range.from,
    to: range.to,
    register: registerRes.data ?? null,
    generatedAt: new Date().toISOString(),
    ...buildReport({ sales, refunds, noSales: noSaleRes.count ?? 0 }),
    // Drawer sessions open at any point in the range (a session can start before or end after it)
    drawerSessions,
  }
}

