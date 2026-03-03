import { requireAdmin, json } from '../_auth.js'

// GET /api/admin/bookings?status=&date=&page=&limit=
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const date   = searchParams.get('date')
  const page   = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '25'))
  const offset = (page - 1) * limit

  let query = supabase
    .from('Booking')
    .select('id, players, totalCents, status, guestName, guestEmail, stripeSessionId, createdAt, TeeTimeSlot(id, date, startTime), User(id, name, email, role)', { count: 'exact' })
    .order('createdAt', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (date) query = query.eq('TeeTimeSlot.date', date)

  const { data, error, count } = await query
  if (error) return json({ error: error.message }, 500)

  return json({ bookings: data || [], total: count || 0, page, limit })
}
