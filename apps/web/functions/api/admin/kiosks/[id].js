import { requireAdmin, json } from '../_auth.js'

// DELETE /api/admin/kiosks/:id — remove a time clock device. It's signed out on its next request and shows the
// set-up screen; punches already made are kept.
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { data, error } = await result.supabase.from('ClockKiosk').delete().eq('id', params.id).select('id')
  if (error) return json({ error: error.message }, 500)
  if (!data?.length) return json({ error: 'Time clock not found' }, 404)
  return json({ success: true })
}
