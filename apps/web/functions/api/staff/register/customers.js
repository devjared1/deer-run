import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { localDate } from '../../../../src/lib/timeclock.js'
import { isActiveMember } from '../../../../src/lib/membership.js'
import { accountBalances } from '../../admin/_houseAccounts.js'

// Adds each customer's member status and house account summary (null if they have none)
async function withAccounts(supabase, users, today) {
  const ids = users.map(u => u.id)
  const { data: accounts } = ids.length
    ? await supabase.from('HouseAccount').select('id, userId, status, creditLimitCents, pinHash, pinLockedAt').in('userId', ids)
    : { data: [] }
  const balances = await accountBalances(supabase, (accounts || []).map(a => a.id))
  const byUser = Object.fromEntries((accounts || []).map(a => [a.userId, {
    id: a.id,
    status: a.status,
    balanceCents: balances[a.id] ?? 0,
    availableCents: Math.max(0, a.creditLimitCents - (balances[a.id] ?? 0)),
    hasPin: !!a.pinHash,
    pinLocked: !!a.pinLockedAt,
  }]))
  return users.map(u => ({ ...u, isMember: isActiveMember(u, today), houseAccount: byUser[u.id] ?? null }))
}

// GET /api/staff/register/customers?search= — find a customer account to attach to a sale.
// GET /api/staff/register/customers?id= — one customer (e.g. their membership end date after a sale).
// isMember is true only for active memberships (memberUntil not passed); the register prices by it.
// houseAccount: { id, status, balanceCents, availableCents, hasPin, pinLocked } or null.
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const today = localDate()
  const id = new URL(request.url).searchParams.get('id')
  if (id) {
    const { data, error } = await supabase.from('User').select('id, name, email, role, memberUntil, membershipTier').eq('id', id)
    if (error) return json({ error: error.message }, 500)
    return json(await withAccounts(supabase, data || [], today))
  }

  // Strip characters that have meaning in PostgREST filter syntax
  const term = (new URL(request.url).searchParams.get('search') || '').replace(/[,()*%"]/g, ' ').trim()
  if (term.length < 2) return json([])

  const { data, error } = await supabase
    .from('User')
    .select('id, name, email, role, memberUntil, membershipTier')
    .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(10)
  if (error) return json({ error: error.message }, 500)

  return json(await withAccounts(supabase, data || [], today))
}
