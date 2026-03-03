import { requireAdmin, json } from './_auth.js'

// GET /api/admin/settings
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase
    .from('CourseSettings')
    .select('*')
    .eq('id', 'singleton')
    .single()

  if (error) return json({ error: error.message }, 500)
  return json(data)
}

// PUT /api/admin/settings
export async function onRequestPut({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const body = await request.json()
  const allowed = {}
  const intFields = ['publicBookingDays', 'memberBookingDays', 'pricePerPlayerCents', 'intervalMinutes']
  const strFields = ['firstTeeTime', 'lastTeeTime']

  for (const f of intFields) if (body[f] !== undefined) allowed[f] = Number(body[f])
  for (const f of strFields) if (body[f] !== undefined) allowed[f] = String(body[f])

  const { data, error } = await supabase
    .from('CourseSettings')
    .update(allowed)
    .eq('id', 'singleton')
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)
  return json(data)
}
