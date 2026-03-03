import { requireAdmin, json } from '../_auth.js'

// PUT /api/admin/bookings/:id — update status (cancel, refund, confirm)
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { status } = await request.json()
  const allowed = ['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED']
  if (!allowed.includes(status)) return json({ error: `status must be one of: ${allowed.join(', ')}` }, 400)

  const { data, error } = await supabase
    .from('Booking')
    .update({ status })
    .eq('id', params.id)
    .select('id, status, totalCents, TeeTimeSlot(date, startTime), User(name, email), guestName, guestEmail')
    .single()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'Booking not found' }, 404)

  return json(data)
}
