import { requireAdmin, json } from '../_auth.js'

// PUT /api/admin/teetimes/:id
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const body = await request.json()
  const allowed = {}
  if (body.maxPlayers !== undefined) allowed.maxPlayers = Number(body.maxPlayers)
  if (body.memberOnly !== undefined) allowed.memberOnly = Boolean(body.memberOnly)
  if (body.startTime !== undefined) allowed.startTime = body.startTime
  if (body.date !== undefined) allowed.date = body.date

  const { data, error } = await supabase
    .from('TeeTimeSlot')
    .update(allowed)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'Slot not found' }, 404)

  return json(data)
}

// DELETE /api/admin/teetimes/:id
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  // Check for active bookings first
  const { data: bookings } = await supabase
    .from('Booking')
    .select('id')
    .eq('teeTimeSlotId', params.id)
    .in('status', ['PENDING', 'CONFIRMED'])
    .limit(1)

  if (bookings?.length) return json({ error: 'Cannot delete slot with active bookings' }, 409)

  const { error } = await supabase.from('TeeTimeSlot').delete().eq('id', params.id)
  if (error) return json({ error: error.message }, 500)

  return json({ success: true })
}
