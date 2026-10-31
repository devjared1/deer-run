import { Resend } from 'resend'
import { fetchAll } from './_db.js'
import { PIN_PATTERN, verifyPinHash } from '../staff/_pin.js'
import { toUtcIso, localDate, addDays, startOfLocalDay, formatLocalDate, COURSE_TZ } from '../../../src/lib/timeclock.js'

// Member house accounts (POS Phase 4). The balance is the sum of HouseAccountEntry.amountCents
// (positive = the member owes the course). Charges and refunds are written by create_sale() / refund_sale();
// payments and adjustments here.

export const SITE = 'https://deerrun.golf'
export const PIN_MAX_ATTEMPTS = 5
// Statements are due this many days after the period ends
export const DUE_DAYS = 15

export const ACCOUNT_SELECT =
  'id, userId, status, creditLimitCents, pinHash, pinFailedAttempts, pinLockedAt, autopayEnabled, ' +
  'stripeCustomerId, stripePaymentMethodId, cardBrand, cardLast4, createdAt, user:User(id, name, email, role, memberUntil)'

const money = (cents) => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`
export { money }

/** Account for API responses: secrets replaced by flags, plus balance and available credit. */
export function serializeAccount(account, balanceCents) {
  const { pinHash, stripeCustomerId, stripePaymentMethodId, ...rest } = account
  return {
    ...rest,
    pinLockedAt: toUtcIso(account.pinLockedAt),
    createdAt: toUtcIso(account.createdAt),
    hasPin: !!pinHash,
    pinLocked: !!account.pinLockedAt,
    hasSavedCard: !!stripePaymentMethodId,
    balanceCents,
    availableCents: Math.max(0, account.creditLimitCents - balanceCents),
  }
}

export async function accountBalance(supabase, accountId, before = null) {
  const rows = await fetchAll(() => {
    let q = supabase.from('HouseAccountEntry').select('id, amountCents').eq('accountId', accountId).order('createdAt', { ascending: true })
    if (before) q = q.lt('createdAt', before)
    return q
  })
  return rows.reduce((sum, r) => sum + r.amountCents, 0)
}

/** Balances for many accounts at once: { [accountId]: cents }. */
export async function accountBalances(supabase, accountIds) {
  if (!accountIds.length) return {}
  const rows = await fetchAll(() => supabase.from('HouseAccountEntry').select('id, accountId, amountCents')
    .in('accountId', accountIds).order('createdAt', { ascending: true }))
  const out = Object.fromEntries(accountIds.map(id => [id, 0]))
  for (const r of rows) out[r.accountId] += r.amountCents
  return out
}

/** Loads an account by id ({ id }) or member ({ userId }). Returns the row (with user) or null. */
export async function loadAccount(supabase, { id, userId }) {
  let q = supabase.from('HouseAccount').select(ACCOUNT_SELECT)
  q = id ? q.eq('id', id) : q.eq('userId', userId)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Checks the member's account PIN. Five wrong tries lock it until an admin resets it.
 * Returns { ok: true } or { error, status, code }.
 */
export async function checkAccountPin(supabase, account, pin) {
  if (account.pinLockedAt) {
    return { error: 'The account PIN is locked after too many wrong tries. A manager can reset it in Admin → House Accounts.', status: 423, code: 'ACCOUNT_PIN_LOCKED' }
  }
  if (!account.pinHash) {
    return { error: 'This member hasn\'t set an account PIN yet (My Account on the website).', status: 400, code: 'ACCOUNT_PIN_NOT_SET' }
  }
  const ok = PIN_PATTERN.test(String(pin ?? '')) && await verifyPinHash(String(pin), account.pinHash)
  if (ok) {
    if (account.pinFailedAttempts) await supabase.from('HouseAccount').update({ pinFailedAttempts: 0 }).eq('id', account.id)
    return { ok: true }
  }
  const attempts = account.pinFailedAttempts + 1
  const locked = attempts >= PIN_MAX_ATTEMPTS
  await supabase.from('HouseAccount').update({ pinFailedAttempts: attempts, pinLockedAt: locked ? new Date().toISOString() : null }).eq('id', account.id)
  return locked
    ? { error: 'Wrong PIN. The account PIN is now locked; a manager can reset it.', status: 423, code: 'ACCOUNT_PIN_LOCKED' }
    : { error: `Wrong PIN (${PIN_MAX_ATTEMPTS - attempts} ${PIN_MAX_ATTEMPTS - attempts === 1 ? 'try' : 'tries'} left)`, status: 403, code: 'ACCOUNT_PIN' }
}

/** When the balance is paid off, open statements are marked PAID. */
export async function settleStatements(supabase, accountId) {
  if (await accountBalance(supabase, accountId) > 0) return
  await supabase.from('Statement').update({ status: 'PAID', paidAt: new Date().toISOString() })
    .eq('accountId', accountId).in('status', ['OPEN', 'AUTOPAY_FAILED'])
}

/**
 * Records a payment on the account (a negative entry). Idempotent per Stripe PaymentIntent, so the webhook and the
 * page that took the payment can both call it. Returns { entry } or { error, status }.
 *   { accountId, amountCents (> 0), method: CASH | CARD | ONLINE | AUTOPAY, registerId?, stripePaymentIntentId?, createdById?, note? }
 */
export async function recordPayment(supabase, p) {
  if (!Number.isInteger(p.amountCents) || p.amountCents < 1) return { error: 'Payment amount must be at least $0.01', status: 400 }
  const labels = { CASH: 'Cash payment', CARD: 'Card payment', ONLINE: 'Online payment', AUTOPAY: 'Autopay' }
  const row = {
    id: crypto.randomUUID(),
    accountId: p.accountId,
    type: 'PAYMENT',
    amountCents: -p.amountCents,
    description: p.note ? `${labels[p.method]} — ${p.note}` : labels[p.method],
    method: p.method,
    registerId: p.registerId ?? null,
    stripePaymentIntentId: p.stripePaymentIntentId ?? null,
    createdById: p.createdById ?? null,
  }
  const { data, error } = await supabase.from('HouseAccountEntry').insert(row).select('*').single()
  if (error?.code === '23505' && p.stripePaymentIntentId) {
    const { data: existing } = await supabase.from('HouseAccountEntry').select('*').eq('stripePaymentIntentId', p.stripePaymentIntentId).single()
    return { entry: existing, duplicate: true }
  }
  if (error) return { error: error.message, status: 500 }
  await settleStatements(supabase, p.accountId)
  return { entry: { ...data, createdAt: toUtcIso(data.createdAt) } }
}

export function serializeEntry(e) {
  return { ...e, createdAt: toUtcIso(e.createdAt) }
}

/**
 * A statement for any course-local date range, worked out from the ledger (nothing is saved):
 * { periodStart, periodEnd, openingCents, chargesCents, creditsCents, closingCents, entries }.
 */
export async function buildStatement(supabase, accountId, periodStart, periodEnd) {
  const startUtc = startOfLocalDay(periodStart).toISOString()
  const endUtc = startOfLocalDay(addDays(periodEnd, 1)).toISOString()
  const [openingCents, entries] = await Promise.all([
    accountBalance(supabase, accountId, startUtc),
    fetchAll(() => supabase.from('HouseAccountEntry')
      .select('id, type, amountCents, description, method, saleId, createdAt, sale:Sale(number)')
      .eq('accountId', accountId).gte('createdAt', startUtc).lt('createdAt', endUtc)
      .order('createdAt', { ascending: true })),
  ])
  const chargesCents = entries.filter(e => e.amountCents > 0).reduce((s, e) => s + e.amountCents, 0)
  const creditsCents = entries.filter(e => e.amountCents < 0).reduce((s, e) => s + e.amountCents, 0)
  return {
    periodStart, periodEnd, openingCents, chargesCents, creditsCents,
    closingCents: openingCents + chargesCents + creditsCents,
    entries: entries.map(serializeEntry),
  }
}

/** The previous calendar month (course time) as { periodStart, periodEnd }. */
export function previousMonth(today = localDate()) {
  const firstOfThis = `${today.slice(0, 7)}-01`
  const periodEnd = addDays(firstOfThis, -1)
  return { periodStart: `${periodEnd.slice(0, 7)}-01`, periodEnd }
}

/** Plain-text statement email. */
export function statementEmail(account, statement, { autopay = null } = {}) {
  const name = account.user?.name?.split(' ')[0] || 'there'
  const range = `${formatLocalDate(statement.periodStart, { month: 'long', day: 'numeric' })} – ${
    formatLocalDate(statement.periodEnd, { month: 'long', day: 'numeric', year: 'numeric' })}`
  const lines = [`Hi ${name},`, '', `Your Deer Run house account statement for ${range}:`, '',
    `Previous balance   ${money(statement.openingCents)}`,
    `Charges            ${money(statement.chargesCents)}`,
    `Payments/credits   ${money(statement.creditsCents)}`,
    `Balance            ${money(statement.closingCents)}`, '']
  for (const e of statement.entries ?? []) {
    const day = new Date(toUtcIso(e.createdAt)).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: COURSE_TZ })
    lines.push(`  ${day.padEnd(6)} ${e.description.padEnd(28).slice(0, 28)} ${money(e.amountCents).padStart(10)}`)
  }
  if (statement.entries?.length) lines.push('')
  if (statement.closingCents <= 0) {
    lines.push('Nothing is due. Thank you!')
  } else if (autopay === 'charged') {
    lines.push(`${money(statement.closingCents)} was charged to your saved card (autopay). Thank you!`)
  } else {
    const due = statement.dueDate ? ` by ${formatLocalDate(statement.dueDate, { month: 'long', day: 'numeric', year: 'numeric' })}` : ''
    if (autopay === 'failed') lines.push('We couldn\'t charge your saved card for autopay, so this statement is due as an invoice.')
    lines.push(`Amount due: ${money(statement.closingCents)}${due}.`, `Pay online: ${SITE}/account`,
      'or pay at the pro shop.')
  }
  lines.push('', 'Statements, charges and autopay settings are in My Account on the website.', '', 'Deer Run Golf Course',
    '(256) 974-7384')
  return {
    subject: statement.closingCents > 0 && autopay !== 'charged'
      ? `Deer Run statement: ${money(statement.closingCents)} due`
      : 'Your Deer Run house account statement',
    text: lines.join('\n'),
  }
}

/** Emails a statement to the member. Returns an error message, or null. */
export async function sendStatement(env, account, statement, options) {
  if (!env.RESEND_API_KEY) return 'Email is not configured'
  if (!account.user?.email) return 'The member has no email address'
  try {
    const { subject, text } = statementEmail(account, statement, options)
    const { error } = await new Resend(env.RESEND_API_KEY).emails.send({ from: 'noreply@deerrun.golf', to: account.user.email, subject, text })
    return error ? error.message : null
  } catch (e) {
    return e.message
  }
}

export { localDate, addDays }
