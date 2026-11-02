import { requireAdmin, json } from '../_auth.js'
import { fetchAll } from '../_db.js'
import { addDays, dayOfWeek, localDate } from '../../../../src/lib/timeclock.js'

// GET /api/admin/reports/teetime-usage?weeks=8 — how full the tee sheet ran, by weekday and hour, over the last `weeks`
// full weeks before today (1–26, default 8). Paid (CONFIRMED) players over the slots' capacity.
// → { from, to, weeks, overall: { capacity, booked, share }, cells: [{ weekday (0 = Sunday), hour (0–23), capacity,
//     booked, share (0–1) }] } (only weekday/hour pairs that had tee times)
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const weeks = Math.min(26, Math.max(1, parseInt(new URL(request.url).searchParams.get('weeks') || '8', 10) || 8))
  const to = addDays(localDate(), -1)
  const from = addDays(to, -(weeks * 7) + 1)

  let slots
  try {
    slots = await fetchAll(() => supabase.from('TeeTimeSlot')
      .select('id, date, startTime, maxPlayers, bookings:Booking(players, status)')
      .gte('date', from).lte('date', to)
      .order('id'))
  } catch (e) {
    return json({ error: e.message }, 500)
  }

  const cells = new Map()
  let capacity = 0
  let booked = 0
  for (const slot of slots) {
    const weekday = dayOfWeek(String(slot.date).slice(0, 10))
    const hour = Number(slot.startTime.slice(0, 2))
    const key = `${weekday}|${hour}`
    const cell = cells.get(key) ?? { weekday, hour, capacity: 0, booked: 0 }
    const players = (slot.bookings || []).filter(b => b.status === 'CONFIRMED').reduce((sum, b) => sum + b.players, 0)
    cell.capacity += slot.maxPlayers
    cell.booked += Math.min(players, slot.maxPlayers)
    cells.set(key, cell)
    capacity += slot.maxPlayers
    booked += Math.min(players, slot.maxPlayers)
  }

  const share = (b, c) => (c ? Math.round((b / c) * 1000) / 1000 : 0)
  return json({
    from, to, weeks,
    overall: { capacity, booked, share: share(booked, capacity) },
    cells: [...cells.values()].map(c => ({ ...c, share: share(c.booked, c.capacity) }))
      .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour),
  })
}
