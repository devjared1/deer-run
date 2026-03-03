import { requireAdmin, json } from '../_auth.js'

// GET /api/admin/users?role=&search=&page=&limit=
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const role   = searchParams.get('role')
  const search = searchParams.get('search')
  const page   = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '25'))
  const offset = (page - 1) * limit

  let query = supabase
    .from('User')
    .select('id, email, name, role, createdAt', { count: 'exact' })
    .order('createdAt', { ascending: false })
    .range(offset, offset + limit - 1)

  if (role) query = query.eq('role', role)
  if (search) query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) return json({ error: error.message }, 500)

  return json({ users: data || [], total: count || 0, page, limit })
}
