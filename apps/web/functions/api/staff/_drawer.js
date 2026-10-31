import { toUtcIso } from '../../../src/lib/timeclock.js'
import { fetchAll } from '../admin/_db.js'
import { consumeApproval } from './_approvals.js'

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

// ─── Paid-ins, paid-outs and safe drops ─────────────────────────────────────

// Each movement needs a manager's approval for the matching ApprovalAction (same name as the type)
export const MOVEMENT_TYPES = ['PAID_IN', 'PAID_OUT', 'SAFE_DROP']
export const MOVEMENT_LABELS = { PAID_IN: 'Paid in', PAID_OUT: 'Paid out', SAFE_DROP: 'Safe drop' }

export const MOVEMENT_SELECT =
  'id, sessionId, registerId, type, amountCents, reason, recipient, createdAt, ' +
  'employee:Employee!CashDrawerMovement_employeeId_fkey(firstName, lastName), ' +
  'approval:ManagerApproval!CashDrawerMovement_approvalId_fkey(approver:Employee!ManagerApproval_approverId_fkey(firstName, lastName))'

export function serializeMovement(m) {
  return { ...m, createdAt: toUtcIso(m.createdAt) }
}

/** A session's movements, oldest first. */
export async function sessionMovements(supabase, sessionId) {
  const { data, error } = await supabase
    .from('CashDrawerMovement')
    .select(MOVEMENT_SELECT)
    .eq('sessionId', sessionId)
    .order('createdAt', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map(serializeMovement)
}

/** Totals by type: { paidInCents, paidOutCents, safeDropCents, paidInCount, paidOutCount, safeDropCount }. */
export function movementTotals(movements) {
  const totals = { paidInCents: 0, paidOutCents: 0, safeDropCents: 0, paidInCount: 0, paidOutCount: 0, safeDropCount: 0 }
  for (const m of movements) {
    const key = { PAID_IN: 'paidIn', PAID_OUT: 'paidOut', SAFE_DROP: 'safeDrop' }[m.type]
    if (!key) continue
    totals[`${key}Cents`] += m.amountCents
    totals[`${key}Count`]++
  }
  return totals
}

/** Expected cash = float + cash taken − cash refunded + paid in − paid out − safe drops. */
export function expectedCash(session, totals) {
  return session.openingFloatCents + totals.cashSalesCents - totals.cashRefundsCents +
    (totals.paidInCents ?? 0) - (totals.paidOutCents ?? 0) - (totals.safeDropCents ?? 0)
}

/** An open session with its running totals and movements (expected so far). */
export async function withRunningTotals(supabase, session) {
  if (!session) return null
  const [totals, movements] = await Promise.all([
    cashTotals(supabase, session.registerId, session.openedAt),
    sessionMovements(supabase, session.id),
  ])
  const all = { ...totals, ...movementTotals(movements) }
  return { ...session, ...all, movements, expectedCents: expectedCash(session, all) }
}

/**
 * Records a paid-in, paid-out or safe drop on the register's open drawer, using up a manager approval for that
 * type. Returns { movement } or { error, status, code? }.
 */
export async function recordMovement(supabase, { registerId, employeeId, type, amountCents, reason, recipient, approvalId }) {
  if (!MOVEMENT_TYPES.includes(type)) return { error: 'type must be PAID_IN, PAID_OUT or SAFE_DROP', status: 400 }
  const amount = parseCashAmount(amountCents, 'The amount')
  if (amount.error) return { error: amount.error, status: 400 }
  if (amount.value === 0) return { error: 'Enter an amount', status: 400 }
  const why = note(reason)
  const to = note(recipient)
  if (type === 'PAID_OUT' && !why) return { error: 'Enter what the cash was paid out for', status: 400 }

  const session = await openSession(supabase, registerId)
  if (!session) return { error: 'Open the cash drawer first (count the starting cash).', status: 409, code: 'DRAWER_CLOSED' }

  const approval = await consumeApproval(supabase, approvalId, { action: type, cashierId: employeeId })
  if (!approval) {
    return { error: 'A manager needs to approve this, and the approval may have expired. Approve it again.', status: 403, code: 'APPROVAL_REQUIRED' }
  }
  const release = () => supabase.from('ManagerApproval').update({ usedAt: null }).eq('id', approval.id)

  const { data, error } = await supabase
    .from('CashDrawerMovement')
    .insert({
      id: crypto.randomUUID(),
      sessionId: session.id,
      registerId,
      type,
      amountCents: amount.value,
      reason: why,
      recipient: type === 'PAID_OUT' ? to : null,
      employeeId,
      approvalId: approval.id,
    })
    .select(MOVEMENT_SELECT)
    .single()
  if (error) {
    await release()
    return { error: error.message, status: 500 }
  }

  // The drawer may have been closed in the same instant; its totals were taken without this, so undo it
  const { data: still } = await supabase.from('CashDrawerSession').select('closedAt').eq('id', session.id).maybeSingle()
  if (still?.closedAt) {
    await supabase.from('CashDrawerMovement').delete().eq('id', data.id)
    await release()
    return { error: 'The drawer was just closed. Open it again first.', status: 409, code: 'DRAWER_CLOSED' }
  }
  return { movement: serializeMovement(data) }
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
  const [cash, movements] = await Promise.all([
    cashTotals(supabase, session.registerId, toUtcIso(session.openedAt), closedAt),
    sessionMovements(supabase, session.id),
  ])
  const totals = { ...cash, ...movementTotals(movements) }
  const expectedCents = expectedCash(session, totals)
  const { data, error: updateError } = await supabase
    .from('CashDrawerSession')
    .update({
      closedAt,
      closedById: employeeId,
      cashSalesCents: totals.cashSalesCents,
      cashRefundsCents: totals.cashRefundsCents,
      paidInCents: totals.paidInCents,
      paidOutCents: totals.paidOutCents,
      safeDropCents: totals.safeDropCents,
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
  return {
    session: {
      ...serializeSession(data),
      cashSalesCount: totals.cashSalesCount,
      cashRefundsCount: totals.cashRefundsCount,
      paidInCount: totals.paidInCount,
      paidOutCount: totals.paidOutCount,
      safeDropCount: totals.safeDropCount,
      movements,
    },
  }
}

/**
 * Drawer sessions open at any point in a report range ({ startUtc, endUtc }), oldest first, optionally for
 * one register. Open sessions get running totals; every session gets `movements` (paid in/out, safe drops).
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
  // Closed sessions keep their totals from the close but still list their movements (open ones get them in
  // withRunningTotals). Loaded by time window, not a long id list: a movement always falls inside its session.
  const closed = sessions.filter(s => s.closedAt)
  const bySession = new Map(closed.map(s => [s.id, []]))
  if (closed.length) {
    const from = closed.reduce((min, s) => (s.openedAt < min ? s.openedAt : min), closed[0].openedAt)
    const to = closed.reduce((max, s) => (s.closedAt > max ? s.closedAt : max), closed[0].closedAt)
    const movements = await fetchAll(() => {
      let q = supabase
        .from('CashDrawerMovement')
        .select(MOVEMENT_SELECT)
        .gte('createdAt', from)
        .lte('createdAt', to)
        .order('createdAt', { ascending: true })
        .order('id', { ascending: true })
      if (registerId) q = q.eq('registerId', registerId)
      return q
    })
    for (const m of movements) {
      if (!bySession.has(m.sessionId)) continue
      bySession.get(m.sessionId).push(serializeMovement(m))
    }
  }
  return Promise.all(sessions.map(s => (s.closedAt ? { ...s, movements: bySession.get(s.id) ?? [] } : withRunningTotals(supabase, s))))
}
