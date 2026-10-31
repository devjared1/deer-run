import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'

// GET /api/staff/register/customers?search= — find a customer account to attach to a sale
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  // Strip characters that have meaning in PostgREST filter syntax
  const term = (new URL(request.url).searchParams.get('search') || '').replace(/[,()*%"]/g, ' ').trim()
  if (term.length < 2) return json([])

  const { data, error } = await supabase
    .from('User')
    .select('id, name, email, role')
    .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(10)
  if (error) return json({ error: error.message }, 500)

  return json(data || [])
}
