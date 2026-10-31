import { isValidYmd, localDate, startOfLocalDay, addDays, daysBetween } from '../../../../src/lib/timeclock.js'
import { PAYMENT_LABELS } from '../../staff/sales/_sale.js'
import { fetchAll } from '../_db.js'
import { loadDrawerSessions, MOVEMENT_SELECT, serializeMovement } from '../../staff/_drawer.js'

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
 *              totalCents, discountCents } and payments { method, amountCents, tipCents }
 *   refunds  — voids and refunds made in the range (on sales from any day), with { kind, method,
 *              amountCents, taxCents, items: [{ quantity, amountCents, taxCents, saleItem: { categoryName } }] }
 *   noSales  — number of No Sale drawer openings in the range
 *   drawerMovements — paid-ins, paid-outs and safe drops made in the range ({ type, amountCents, ... })
 * Sales count in full on the day they were rung up; voids and refunds come off on the day they happen,
 * so a day's report never changes after the day ends. All amounts are in cents.
 */
const ACCOUNT_PAYMENT_LABELS = { CASH: 'Cash', CARD: 'Card', ONLINE: 'Online', AUTOPAY: 'Autopay' }

export function buildReport({ sales, refunds, noSales = 0, accountPayments = [], drawerMovements = [] }) {
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
  // Tips added on the card reader: charged on top of the sale, so not sales, tax or a card tender amount
  const tips = { count: 0, totalCents: 0 }
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
      if (p.tipCents > 0) { tips.count++; tips.totalCents += p.tipCents }
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

  // House account payments received (settling balances, not sales): by method; cash ones went into the drawer
  const byMethod = new Map()
  for (const e of accountPayments) {
    const m = byMethod.get(e.method) ?? { method: e.method, label: ACCOUNT_PAYMENT_LABELS[e.method] ?? e.method, count: 0, amountCents: 0 }
    m.count++
    m.amountCents -= e.amountCents // payments are negative ledger entries
    byMethod.set(e.method, m)
  }
  const accountPaymentRows = [...byMethod.values()].sort((a, b) => b.amountCents - a.amountCents)
  const cashAccountPayments = byMethod.get('CASH')?.amountCents ?? 0

  // Paid-ins, paid-outs and safe drops: cash moved in or out of the drawers that isn't a sale
  const movementTotals = { PAID_IN: 0, PAID_OUT: 0, SAFE_DROP: 0 }
  const movementCounts = { PAID_IN: 0, PAID_OUT: 0, SAFE_DROP: 0 }
  for (const m of drawerMovements) {
    if (!(m.type in movementTotals)) continue
    movementTotals[m.type] += m.amountCents
    movementCounts[m.type]++
  }

  const cash = tenders.get('CASH')
  const netCash = (cash ? cash.collectedCents - cash.refundedCents : 0) + cashAccountPayments
  return {
    sales: totals,
    returns,
    net,
    categories: categoryRows,
    tenders: tenderRows,
    cardTips: tips,
    // Net cash from transactions: cash taken (sales + account payments) minus cash refunds, no starting cash
    cashExpectedCents: netCash,
    // Drawer cash movements; drawerCashCents = net cash + paid in − paid out − safe drops (before starting cash)
    cashMovements: {
      paidInCents: movementTotals.PAID_IN,
      paidInCount: movementCounts.PAID_IN,
      paidOutCents: movementTotals.PAID_OUT,
      paidOutCount: movementCounts.PAID_OUT,
      safeDropCents: movementTotals.SAFE_DROP,
      safeDropCount: movementCounts.SAFE_DROP,
      rows: drawerMovements,
    },
    drawerCashCents: netCash + movementTotals.PAID_IN - movementTotals.PAID_OUT - movementTotals.SAFE_DROP,
    accountPayments: { rows: accountPaymentRows, totalCents: accountPaymentRows.reduce((sum, r) => sum + r.amountCents, 0) },
    noSaleCount: noSales,
  }
}

/** Loads the data for a report and builds it. `registerId` limits it to one register. */
export async function loadReport(supabase, range, registerId = null) {
  const scoped = q => (registerId ? q.eq('registerId', registerId) : q)
  // Paid-ins, paid-outs and safe drops made in the range (count on the day they happen)
  const movementsPromise = fetchAll(() => scoped(supabase
    .from('CashDrawerMovement')
    .select(MOVEMENT_SELECT)
    .gte('createdAt', range.startUtc)
    .lt('createdAt', range.endUtc)
    .order('createdAt', { ascending: true })
    .order('id', { ascending: true })))

  const [sales, refunds, noSaleRes, registerRes, drawerSessions, accountPayments] = await Promise.all([
    fetchAll(() => scoped(supabase
      .from('Sale')
      .select('id, subtotalCents, discountCents, taxCents, totalCents, ' +
        'items:SaleItem!SaleItem_saleId_fkey(categoryName, quantity, subtotalCents, taxCents), payments:Payment(*)')
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
    // Online and autopay payments have no register, so a single register's report only has its own
    fetchAll(() => scoped(supabase
      .from('HouseAccountEntry')
      .select('id, amountCents, method')
      .eq('type', 'PAYMENT')
      .gte('createdAt', range.startUtc)
      .lt('createdAt', range.endUtc)
      .order('createdAt', { ascending: true }))),
  ])
  if (noSaleRes.error) throw new Error(noSaleRes.error.message)
  const drawerMovements = (await movementsPromise).map(serializeMovement)

  return {
    from: range.from,
    to: range.to,
    register: registerRes.data ?? null,
    generatedAt: new Date().toISOString(),
    ...buildReport({ sales, refunds, noSales: noSaleRes.count ?? 0, accountPayments, drawerMovements }),
    // Drawer sessions open at any point in the range (a session can start before or end after it)
    drawerSessions,
  }
}

