import { requireAdmin, json } from '../_auth.js'
import { isExpiredHold } from '../../../../src/lib/teesheet.js'
import { isValidYmd } from '../../../../src/lib/timeclock.js'

// GET /api/admin/bookings?status=&date=&from=&to=&search=&page=&limit=
// → { bookings: [{ …, source, checkedInAt, holdExpired }], total, page, limit }
// status: one status or a comma-separated list (PENDING,CONFIRMED). date (one tee date) or from/to (tee dates,
// inclusive, either may be left out). search: guest or member name / email (contains, any case).
// holdExpired marks an unpaid online booking past its 30-minute hold (src/lib/teesheet.js).
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const statuses = (searchParams.get('status') || '').split(',').map(s => s.trim()).filter(Boolean)
  const date   = searchParams.get('date')
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')
  // PostgREST filter syntax uses , ( ) and * / % as wildcards: keep them out of the search text
  const search = (searchParams.get('search') || '').replace(/[,()*%\\]/g, ' ').trim()
  const page   = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '25'))
  const offset = (page - 1) * limit

  for (const d of [date, from, to]) {
    if (d && !isValidYmd(d)) return json({ error: 'Dates must be YYYY-MM-DD' }, 400)
  }

  // Filtering on the tee date needs an inner join, or non-matching bookings come back with TeeTimeSlot null
  const byTeeDate = !!(date || from || to)
  const slot = byTeeDate ? 'TeeTimeSlot!inner(id, date, startTime)' : 'TeeTimeSlot(id, date, startTime)'

  let query = supabase
    .from('Booking')
    .select(`id, players, totalCents, status, source, checkedInAt, guestName, guestEmail, stripeSessionId, stripePaymentId, createdAt, ${slot}, User(id, name, email, role)`, { count: 'exact' })
    .order('createdAt', { ascending: false })
    .range(offset, offset + limit - 1)

  if (statuses.length === 1) query = query.eq('status', statuses[0])
  else if (statuses.length > 1) query = query.in('status', statuses)
  if (date) query = query.eq('TeeTimeSlot.date', date)
  if (from) query = query.gte('TeeTimeSlot.date', from)
  if (to) query = query.lte('TeeTimeSlot.date', to)

  if (search) {
    const { data: users, error: userError } = await supabase
      .from('User')
      .select('id')
      .or(`name.ilike.*${search}*,email.ilike.*${search}*`)
      .limit(200)
    if (userError) return json({ error: userError.message }, 500)
    const filters = [`guestName.ilike.*${search}*`, `guestEmail.ilike.*${search}*`]
    if (users?.length) filters.push(`userId.in.(${users.map(u => u.id).join(',')})`)
    query = query.or(filters.join(','))
  }

  const { data, error, count } = await query
  if (error) return json({ error: error.message }, 500)

  const now = new Date()
  const bookings = (data || []).map(b => ({ ...b, holdExpired: isExpiredHold(b, now) }))
  return json({ bookings, total: count || 0, page, limit })
}
