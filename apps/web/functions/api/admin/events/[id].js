import { requireAdmin, json } from '../_auth.js'

// PUT /api/admin/events/:id
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const body = await request.json()
  const fields = ['name', 'description', 'startTime', 'format']
  const boolFields = ['memberOnly', 'featured', 'past']
  const update = {}

  for (const f of fields) if (body[f] !== undefined) update[f] = body[f]
  for (const f of boolFields) if (body[f] !== undefined) update[f] = Boolean(body[f])
  if (body.eventDate !== undefined) update.eventDate = new Date(body.eventDate).toISOString()
  if (body.entry !== undefined) update.entry = body.entry !== null ? Number(body.entry) : null
  if (body.spotsTotal !== undefined) update.spotsTotal = body.spotsTotal !== null ? Number(body.spotsTotal) : null

  const { data, error } = await supabase
    .from('TournamentEvent')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'Event not found' }, 404)

  return json(data)
}

// DELETE /api/admin/events/:id
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { error } = await supabase.from('TournamentEvent').delete().eq('id', params.id)
  if (error) return json({ error: error.message }, 500)

  return json({ success: true })
}
