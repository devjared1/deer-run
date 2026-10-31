import { requireAdmin, json } from '../_auth.js'
import { bookedPlayers, HOLD_COLUMNS } from '../../../../src/lib/teesheet.js'

// GET /api/admin/teetimes?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') || new Date().toISOString().split('T')[0]
  const end = searchParams.get('end') || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('TeeTimeSlot')
    .select(`*, Booking(id, ${HOLD_COLUMNS})`)
    .gte('date', start)
    .lte('date', end)
    .order('date')
    .order('startTime')

  if (error) return json({ error: error.message }, 500)

  // Unpaid online bookings past their hold don't count (src/lib/teesheet.js)
  const now = new Date()
  const slots = (data || []).map(slot => {
    const booked = bookedPlayers(slot.Booking, now)
    const { Booking, ...slotData } = slot
    return { ...slotData, bookedPlayers: booked, available: Math.max(0, slot.maxPlayers - booked) }
  })

  return json(slots)
}

// POST /api/admin/teetimes — create a single slot
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const body = await request.json()
  const { date, startTime, maxPlayers = 4, memberOnly = false } = body

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'date required (YYYY-MM-DD)' }, 400)
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) return json({ error: 'startTime required (HH:MM)' }, 400)

  const { data, error } = await supabase
    .from('TeeTimeSlot')
    .insert({ id: crypto.randomUUID(), date, startTime, maxPlayers: Number(maxPlayers), memberOnly: Boolean(memberOnly) })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return json({ error: 'Slot already exists for that date/time' }, 409)
    return json({ error: error.message }, 500)
  }

  return json(data, 201)
}
