import { requireAdmin, json } from '../_auth.js'

// PUT /api/admin/users/:id — update role
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser: adminUser } = result

  if (params.id === adminUser.id) return json({ error: 'Cannot change your own role' }, 400)

  const { role } = await request.json()
  if (!['GUEST', 'MEMBER', 'ADMIN'].includes(role)) {
    return json({ error: 'role must be GUEST, MEMBER, or ADMIN' }, 400)
  }

  const { data, error } = await supabase
    .from('User')
    .update({ role })
    .eq('id', params.id)
    .select('id, email, name, role')
    .single()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'User not found' }, 404)

  return json(data)
}
