import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { localDate } from '../../../../src/lib/timeclock.js'
import { isActiveMember } from '../../../../src/lib/membership.js'

// GET /api/staff/register/customers?search= — find a customer account to attach to a sale.
// GET /api/staff/register/customers?id= — one customer (e.g. their membership end date after a sale).
// isMember is true only for active memberships (memberUntil not passed); the register prices by it.
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const today = localDate()
  const id = new URL(request.url).searchParams.get('id')
  if (id) {
    const { data, error } = await supabase.from('User').select('id, name, email, role, memberUntil, membershipTier').eq('id', id)
    if (error) return json({ error: error.message }, 500)
    return json((data || []).map(u => ({ ...u, isMember: isActiveMember(u, today) })))
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

  return json((data || []).map(u => ({ ...u, isMember: isActiveMember(u, today) })))
}
