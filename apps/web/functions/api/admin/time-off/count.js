import { requireAdmin, json } from '../_auth.js'

// GET /api/admin/time-off/count — { pending } for the admin sidebar badge
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { count, error } = await supabase
    .from('TimeOffRequest')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING')
  if (error) return json({ error: error.message }, 500)

  return json({ pending: count ?? 0 })
}
