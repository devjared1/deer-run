import { requireAdmin, json } from '../_auth.js'
import {
  ACCOUNT_SELECT, serializeAccount, accountBalance, loadAccount, buildStatement, sendStatement, serializeEntry, settleStatements, localDate,
} from '../_houseAccounts.js'
import { parseLimit } from './index.js'
import { isValidYmd, daysBetween, toUtcIso } from '../../../../src/lib/timeclock.js'

const STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED']

function parseRange(from, to) {
  if (!isValidYmd(from) || !isValidYmd(to)) return { error: 'Statement dates must be YYYY-MM-DD' }
  if (to < from) return { error: 'The end date must be on or after the start date' }
  if (daysBetween(from, to) > 400) return { error: 'A statement can cover at most about a year' }
  return { from, to }
}

// GET /api/admin/house-accounts/:id[?from=&to=]
// The account, its latest 200 entries and its saved statements. With from/to, also an on-demand statement for that
// course-local range (printable; nothing is saved).
export async function onRequestGet({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  try {
    const account = await loadAccount(supabase, { id: params.id })
    if (!account) return json({ error: 'House account not found' }, 404)
    const { searchParams } = new URL(request.url)
    let statement = null
    if (searchParams.get('from') || searchParams.get('to')) {
      const range = parseRange(searchParams.get('from'), searchParams.get('to'))
      if (range.error) return json({ error: range.error }, 400)
      statement = await buildStatement(supabase, account.id, range.from, range.to)
    }
    const [balance, entriesRes, statementsRes] = await Promise.all([
      accountBalance(supabase, account.id),
      supabase.from('HouseAccountEntry').select('*, sale:Sale(id, number)').eq('accountId', account.id)
        .order('createdAt', { ascending: false }).limit(200),
      supabase.from('Statement').select('*').eq('accountId', account.id).order('periodStart', { ascending: false }).limit(36),
    ])
    if (entriesRes.error) throw new Error(entriesRes.error.message)
    return json({
      account: serializeAccount(account, balance),
      entries: (entriesRes.data || []).map(serializeEntry),
      statements: (statementsRes.data || []).map(s => ({
        ...s, emailedAt: toUtcIso(s.emailedAt), paidAt: toUtcIso(s.paidAt), createdAt: toUtcIso(s.createdAt),
        reminderSentAt: toUtcIso(s.reminderSentAt), lateFeeAt: toUtcIso(s.lateFeeAt),
      })),
      statement,
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// PUT /api/admin/house-accounts/:id — { status?, creditLimitCents?, resetPin? }
// resetPin clears the member's PIN and lockout so they can set a new one in My Account.
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const update = {}
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json({ error: 'Status must be ACTIVE, SUSPENDED or CLOSED' }, 400)
    update.status = body.status
  }
  if (body.creditLimitCents !== undefined) {
    const limit = parseLimit(body.creditLimitCents)
    if (limit.error) return json({ error: limit.error }, 400)
    update.creditLimitCents = limit.value
  }
  if (body.resetPin) Object.assign(update, { pinHash: null, pinFailedAttempts: 0, pinLockedAt: null })
  if (!Object.keys(update).length) return json({ error: 'Nothing to update' }, 400)

  if (update.status === 'CLOSED' && await accountBalance(supabase, params.id) !== 0) {
    return json({ error: 'Settle the balance (payment or adjustment) before closing the account' }, 409)
  }
  const { data, error } = await supabase.from('HouseAccount').update(update).eq('id', params.id).select(ACCOUNT_SELECT).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'House account not found' }, 404)
  return json(serializeAccount(data, await accountBalance(supabase, data.id)))
}

// POST /api/admin/house-accounts/:id
//   { action: 'adjust', amountCents, reason }   manual correction: + adds to what the member owes, − credits them
//   { action: 'email_statement', from, to }     email an on-demand statement for a date range
export async function onRequestPost({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const account = await loadAccount(supabase, { id: params.id })
  if (!account) return json({ error: 'House account not found' }, 404)

  if (body?.action === 'adjust') {
    const amount = Number(body.amountCents)
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000) {
      return json({ error: 'Enter an amount (positive adds a charge, negative gives a credit)' }, 400)
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''
    if (!reason) return json({ error: 'Enter a reason' }, 400)
    const { data, error } = await supabase.from('HouseAccountEntry').insert({
      id: crypto.randomUUID(), accountId: account.id, type: 'ADJUSTMENT', amountCents: amount,
      description: `Adjustment — ${reason}`, createdById: dbUser.id,
    }).select('*').single()
    if (error) return json({ error: error.message }, 500)
    await settleStatements(supabase, account.id)
    return json({ entry: serializeEntry(data), balanceCents: await accountBalance(supabase, account.id) }, 201)
  }

  if (body?.action === 'email_statement') {
    const range = parseRange(body.from, body.to)
    if (range.error) return json({ error: range.error }, 400)
    const statement = await buildStatement(supabase, account.id, range.from, range.to)
    const error = await sendStatement(env, account, statement)
    return error ? json({ error: `Couldn't email the statement: ${error}` }, 502) : json({ success: true, to: account.user?.email })
  }

  return json({ error: 'Unknown action' }, 400)
}

export { localDate }
