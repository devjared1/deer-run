import { requireAdmin, json } from '../_auth.js'
import { fetchAll } from '../_db.js'
import { ACCOUNT_SELECT, serializeAccount, accountBalances } from '../_houseAccounts.js'

const STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED']
const MAX_LIMIT_CENTS = 10_000_000 // $100,000

export function parseLimit(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > MAX_LIMIT_CENTS) return { error: 'Credit limit must be between $0 and $100,000' }
  return { value: n }
}

// GET /api/admin/house-accounts?status=&search= — accounts with the member and current balance (owing first)
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = (searchParams.get('search') || '').trim().toLowerCase()
  if (status && !STATUSES.includes(status)) return json({ error: 'Unknown status' }, 400)

  try {
    let accounts = await fetchAll(() => {
      let q = supabase.from('HouseAccount').select(ACCOUNT_SELECT).order('createdAt', { ascending: true })
      if (status) q = q.eq('status', status)
      return q
    })
    if (search) {
      accounts = accounts.filter(a => `${a.user?.name ?? ''} ${a.user?.email ?? ''}`.toLowerCase().includes(search))
    }
    const balances = await accountBalances(supabase, accounts.map(a => a.id))
    const list = accounts.map(a => serializeAccount(a, balances[a.id] ?? 0))
      .sort((a, b) => b.balanceCents - a.balanceCents || (a.user?.name ?? '').localeCompare(b.user?.name ?? ''))
    return json({
      accounts: list,
      totals: { owedCents: list.reduce((s, a) => s + Math.max(0, a.balanceCents), 0), count: list.length },
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/admin/house-accounts — { userId, creditLimitCents } opens an account for a member
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const limit = parseLimit(body?.creditLimitCents ?? 50000)
  if (limit.error) return json({ error: limit.error }, 400)

  const { data: user } = await supabase.from('User').select('id, role').eq('id', body?.userId ?? '').maybeSingle()
  if (!user) return json({ error: 'Choose a member' }, 400)

  const { data, error } = await supabase.from('HouseAccount')
    .insert({ id: crypto.randomUUID(), userId: user.id, creditLimitCents: limit.value })
    .select(ACCOUNT_SELECT).single()
  if (error?.code === '23505') return json({ error: 'This member already has a house account' }, 409)
  if (error) return json({ error: error.message }, 500)
  return json(serializeAccount(data, 0), 201)
}
