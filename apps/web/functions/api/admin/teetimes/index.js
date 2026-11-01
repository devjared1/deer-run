import { requireAdmin, json } from '../_auth.js'
import { fetchAll } from '../_db.js'
import { bookedPlayers, HOLD_COLUMNS } from '../../../../src/lib/teesheet.js'
import { addDays, daysBetween, isValidHhmm, isValidYmd, localDate } from '../../../../src/lib/timeclock.js'

// GET /api/admin/teetimes?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  // Course-local defaults (B5: UTC is already tomorrow after 7 pm Central)
  const start = searchParams.get('start') || localDate()
  const end = searchParams.get('end') || addDays(localDate(), 14)

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

// POST /api/admin/teetimes — create a single slot: { date, startTime, maxPlayers?, memberOnly? } → 201 slot
// Bulk actions over a date range (course-local "YYYY-MM-DD", inclusive), each → 200 with counts:
//   { action: 'generate', from, to, firstTeeTime, lastTeeTime, intervalMinutes, maxPlayers?, memberOnly? }
//     → { created, skipped }   (slots every intervalMinutes from first to last tee time; existing slots are skipped)
//   { action: 'close', from, to, startTime?, endTime?, dryRun? }
//     → { deleted, kept }      (deletes the slots in range with no bookings at all; slots with bookings are kept)
//   { action: 'members', from, to, startTime?, endTime?, memberOnly, dryRun? }
//     → { updated }            (sets memberOnly on every slot in range)
// startTime/endTime ("HH:MM", inclusive) narrow close/members to part of the day. dryRun returns the counts the
// action would have, without changing anything (for the confirmation).
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (body.action !== undefined) return bulkAction(supabase, body)

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

// ─── Bulk actions ───────────────────────────────────────────────────────────

const MAX_RANGE_DAYS = 366
const MAX_GENERATED = 20000
const CHUNK = 500

const toMinutes = hhmm => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHhmm = mins => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

function validRange(from, to) {
  if (!isValidYmd(from) || !isValidYmd(to)) return 'from and to are required (YYYY-MM-DD)'
  if (to < from) return 'The end date is before the start date'
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) return `Pick a range of at most ${MAX_RANGE_DAYS} days`
  return null
}

function validTimeWindow(startTime, endTime) {
  if (startTime && !isValidHhmm(startTime)) return 'startTime must be HH:MM'
  if (endTime && !isValidHhmm(endTime)) return 'endTime must be HH:MM'
  if (startTime && endTime && endTime < startTime) return 'The last time is before the first time'
  return null
}

async function bulkAction(supabase, body) {
  const { action, from, to } = body
  if (!['generate', 'close', 'members'].includes(action)) {
    return json({ error: 'action must be generate, close or members' }, 400)
  }
  const rangeError = validRange(from, to)
  if (rangeError) return json({ error: rangeError }, 400)

  try {
    if (action === 'generate') return await generateSlots(supabase, body)
    return await updateSlots(supabase, body)
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

async function generateSlots(supabase, body) {
  const { from, to, firstTeeTime, lastTeeTime } = body
  const interval = Number(body.intervalMinutes)
  const maxPlayers = Number(body.maxPlayers ?? 4)
  const memberOnly = Boolean(body.memberOnly)

  if (!isValidHhmm(firstTeeTime) || !isValidHhmm(lastTeeTime)) {
    return json({ error: 'firstTeeTime and lastTeeTime are required (HH:MM)' }, 400)
  }
  if (lastTeeTime < firstTeeTime) return json({ error: 'The last tee time is before the first' }, 400)
  if (!Number.isInteger(interval) || interval < 5 || interval > 120) {
    return json({ error: 'intervalMinutes must be a whole number from 5 to 120' }, 400)
  }
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 8) {
    return json({ error: 'maxPlayers must be from 1 to 8' }, 400)
  }

  const times = []
  for (let m = toMinutes(firstTeeTime); m <= toMinutes(lastTeeTime); m += interval) times.push(toHhmm(m))
  const days = daysBetween(from, to) + 1
  if (times.length * days > MAX_GENERATED) {
    return json({ error: `That would be more than ${MAX_GENERATED.toLocaleString('en-US')} slots; pick a shorter range` }, 400)
  }

  const existing = await fetchAll(() => supabase.from('TeeTimeSlot')
    .select('date, startTime')
    .gte('date', from)
    .lte('date', to)
    .order('id'))
  const taken = new Set(existing.map(s => `${s.date} ${s.startTime}`))

  const rows = []
  let skipped = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const startTime of times) {
      if (taken.has(`${d} ${startTime}`)) { skipped++; continue }
      rows.push({ id: crypto.randomUUID(), date: d, startTime, maxPlayers, memberOnly })
    }
  }

  // ignoreDuplicates: a slot created meanwhile (another admin, the single-slot form) is skipped, not an error
  let created = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await supabase.from('TeeTimeSlot')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'date,startTime', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(error.message)
    created += data?.length ?? 0
  }
  skipped += rows.length - created

  return json({ created, skipped })
}

// close / members: the slots in the date range (and optional time window)
async function updateSlots(supabase, body) {
  const { action, from, to, startTime, endTime, dryRun } = body
  const windowError = validTimeWindow(startTime, endTime)
  if (windowError) return json({ error: windowError }, 400)
  if (action === 'members' && typeof body.memberOnly !== 'boolean') {
    return json({ error: 'memberOnly (true or false) is required' }, 400)
  }

  const slots = await fetchAll(() => {
    let q = supabase.from('TeeTimeSlot')
      .select('id, memberOnly, Booking(id)')
      .gte('date', from)
      .lte('date', to)
      .order('id')
    if (startTime) q = q.gte('startTime', startTime)
    if (endTime) q = q.lte('startTime', endTime)
    return q
  })

  if (action === 'members') {
    const ids = slots.filter(s => s.memberOnly !== body.memberOnly).map(s => s.id)
    if (!dryRun) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { error } = await supabase.from('TeeTimeSlot').update({ memberOnly: body.memberOnly }).in('id', ids.slice(i, i + CHUNK))
        if (error) throw new Error(error.message)
      }
    }
    return json({ updated: ids.length })
  }

  // Any booking row (even cancelled or refunded) keeps its slot: bookings point at their slot
  const open = slots.filter(s => !s.Booking?.length).map(s => s.id)
  const kept = slots.length - open.length
  if (!dryRun) {
    for (let i = 0; i < open.length; i += CHUNK) {
      const { error } = await supabase.from('TeeTimeSlot').delete().in('id', open.slice(i, i + CHUNK))
      if (error) throw new Error(error.message)
    }
  }
  return json({ deleted: open.length, kept })
}
