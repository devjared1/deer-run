import { toUtcIso } from '../../../src/lib/timeclock.js'
import { fetchAll } from '../admin/_db.js'

export const SESSION_SELECT =
  '*, register:Register(id, name), openedBy:Employee!CashDrawerSession_openedById_fkey(firstName, lastName), ' +
  'closedBy:Employee!CashDrawerSession_closedById_fkey(firstName, lastName)'

/** The register's open drawer session, or null. */
export async function openSession(supabase, registerId) {
  const { data, error } = await supabase
    .from('CashDrawerSession')
    .select(SESSION_SELECT)
    .eq('registerId', registerId)
    .is('closedAt', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? serializeSession(data) : null
}

export function serializeSession(s) {
  return { ...s, openedAt: toUtcIso(s.openedAt), closedAt: toUtcIso(s.closedAt) }
}

/**
 * Cash taken and cash refunded at a register in [fromIso, toIso) (toIso null = until now). Cash taken is sale
 * payments plus cash payments on house accounts made at this register. Payment.amountCents is what was applied to
 * the sale, so change handed back is already netted out.
 */
export async function cashTotals(supabase, registerId, fromIso, toIso = null) {
  const window = q => (toIso ? q.gte('createdAt', fromIso).lt('createdAt', toIso) : q.gte('createdAt', fromIso))
  const [payments, refunds, accountPayments] = await Promise.all([
    fetchAll(() => window(supabase
      .from('Payment')
      .select('id, amountCents, sale:Sale!inner(registerId)')
      .eq('method', 'CASH')
      .eq('sale.registerId', registerId)
      .order('createdAt', { ascending: true }))),
    fetchAll(() => window(supabase
      .from('SaleRefund')
      .select('id, amountCents')
      .eq('method', 'CASH')
      .eq('registerId', registerId)
      .order('createdAt', { ascending: true }))),
    fetchAll(() => window(supabase
      .from('HouseAccountEntry')
      .select('id, amountCents')
      .eq('type', 'PAYMENT')
      .eq('method', 'CASH')
      .eq('registerId', registerId)
      .order('createdAt', { ascending: true }))),
  ])
  const cashAccountPaymentsCents = accountPayments.reduce((sum, e) => sum - e.amountCents, 0)
  const cashSalesCents = payments.reduce((sum, p) => sum + p.amountCents, 0) + cashAccountPaymentsCents
  const cashRefundsCents = refunds.reduce((sum, r) => sum + r.amountCents, 0)
  return {
    cashSalesCents, // all cash taken: sales + account payments
    cashRefundsCents,
    cashAccountPaymentsCents,
    cashSalesCount: payments.length + accountPayments.length,
    cashRefundsCount: refunds.length,
  }
}

/** An open session with its running totals: expected = float + cash taken − cash refunded. */
export async function withRunningTotals(supabase, session) {
  if (!session) return null
  const totals = await cashTotals(supabase, session.registerId, session.openedAt)
  return { ...session, ...totals, expectedCents: session.openingFloatCents + totals.cashSalesCents - totals.cashRefundsCents }
}

export const DRAWER_REQUIRED_MESSAGE = 'Open the cash drawer first (count the starting cash), then take the cash payment.'

const MAX_CASH_CENTS = 10_000_000 // $100,000

export function parseCashAmount(value, label) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > MAX_CASH_CENTS) return { error: `${label} must be between $0 and $100,000` }
  return { value: n }
}

function note(value) {
  const s = typeof value === 'string' ? value.trim().slice(0, 300) : ''
  return s || null
}

/** Opens a drawer session. Returns { session } or { error, status }. */
export async function openDrawer(supabase, { registerId, employeeId, floatCents, openNote }) {
  const amount = parseCashAmount(floatCents, 'Starting cash')
  if (amount.error) return { error: amount.error, status: 400 }
  const { data, error } = await supabase
    .from('CashDrawerSession')
    .insert({ id: crypto.randomUUID(), registerId, openedById: employeeId, openingFloatCents: amount.value, openNote: note(openNote) })
    .select(SESSION_SELECT)
    .single()
  // 23505 = the one-open-session-per-register index
  if (error?.code === '23505') return { error: 'This register\'s drawer is already open', status: 409 }
  if (error) return { error: error.message, status: 500 }
  return { session: serializeSession(data) }
}

/**
 * Closes a drawer session with the counted cash. Totals are worked out at close and stored, so later
 * changes can't alter a closed drawer. Returns { session } or { error, status }.
 */
export async function closeDrawer(supabase, sessionId, { employeeId, countedCents, closeNote }) {
  const amount = parseCashAmount(countedCents, 'Counted cash')
  if (amount.error) return { error: amount.error, status: 400 }

  const { data: session, error } = await supabase.from('CashDrawerSession').select('*').eq('id', sessionId).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (!session) return { error: 'Drawer session not found', status: 404 }
  if (session.closedAt) return { error: 'This drawer is already closed', status: 409 }

  const closedAt = new Date().toISOString()
  const totals = await cashTotals(supabase, session.registerId, toUtcIso(session.openedAt), closedAt)
  const expectedCents = session.openingFloatCents + totals.cashSalesCents - totals.cashRefundsCents
  const { data, error: updateError } = await supabase
    .from('CashDrawerSession')
    .update({
      closedAt,
      closedById: employeeId,
      cashSalesCents: totals.cashSalesCents,
      cashRefundsCents: totals.cashRefundsCents,
      expectedCents,
      countedCents: amount.value,
      overShortCents: amount.value - expectedCents,
      closeNote: note(closeNote),
    })
    .eq('id', session.id)
    .is('closedAt', null) // someone else may have just closed it
    .select(SESSION_SELECT)
    .maybeSingle()
  if (updateError) return { error: updateError.message, status: 500 }
  if (!data) return { error: 'This drawer was just closed by someone else', status: 409 }
  return { session: { ...serializeSession(data), cashSalesCount: totals.cashSalesCount, cashRefundsCount: totals.cashRefundsCount } }
}

/**
 * Drawer sessions open at any point in a report range ({ startUtc, endUtc }), oldest first, optionally for
 * one register. Open sessions get running totals.
 */
export async function loadDrawerSessions(supabase, range, registerId = null) {
  let query = supabase
    .from('CashDrawerSession')
    .select(SESSION_SELECT)
    .lt('openedAt', range.endUtc)
    .or(`closedAt.is.null,closedAt.gte."${range.startUtc}"`)
    .order('openedAt', { ascending: true })
    .limit(500)
  if (registerId) query = query.eq('registerId', registerId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const sessions = (data || []).map(serializeSession)
  return Promise.all(sessions.map(s => (s.closedAt ? s : withRunningTotals(supabase, s))))
}
