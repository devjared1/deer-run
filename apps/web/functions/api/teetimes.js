import { createClient } from '@supabase/supabase-js'
import { isActiveMember } from '../../src/lib/membership.js'
import { daysBetween, localDate, localDateTimeToUtc } from '../../src/lib/timeclock.js'
import { fetchAll } from './admin/_db.js'
import { bookedPlayers, HOLD_COLUMNS } from '../../src/lib/teesheet.js'
import { releaseInBackground, slotsWithExpiredHolds } from './bookings/_holds.js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

async function getOptionalUser(request, supabase) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7))
  if (error || !user) return null
  const { data: dbUser } = await supabase.from('User').select('*').eq('supabaseId', user.id).maybeSingle()
  return dbUser
}

// GET /api/teetimes?date=YYYY-MM-DD
//   → [{ ...TeeTimeSlot, bookedPlayers, available, full }] for one day (member-only slots hidden from guests)
// GET /api/teetimes?from=YYYY-MM-DD&to=YYYY-MM-DD   (inclusive, at most MAX_RANGE_DAYS days)
//   → [{ date, open, spots }] per day in the range: `open` = slots with room, `spots` = open player spots.
//   Same member-only and unpaid-hold rules as the single day; today's tee times that have already gone by
//   don't count. Days without slots are left out. Used for the booking calendar's availability hints.
const MAX_RANGE_DAYS = 31

export async function onRequestGet(context) {
  const { request, env } = context
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') // expected: YYYY-MM-DD
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const ymd = /^\d{4}-\d{2}-\d{2}$/

  if (!date && (from || to)) {
    if (!ymd.test(from || '') || !ymd.test(to || '') || from > to || daysBetween(from, to) >= MAX_RANGE_DAYS) {
      return json({ error: `from and to required (YYYY-MM-DD, from <= to, at most ${MAX_RANGE_DAYS} days)` }, 400)
    }
    return summary(context, from, to)
  }

  if (!date || !ymd.test(date)) {
    return json({ error: 'date query param required (YYYY-MM-DD)' }, 400)
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const dbUser = await getOptionalUser(request, supabase)
  // Members-only slots: admins and active members (memberUntil not passed)
  const isMember = dbUser?.role === 'ADMIN' || isActiveMember(dbUser, localDate())

  const { data: slots, error } = await supabase
    .from('TeeTimeSlot')
    .select(`*, Booking(${HOLD_COLUMNS})`)
    .eq('date', date)
    .order('startTime')

  if (error) return json({ error: error.message }, 500)

  // Unpaid online bookings past their hold don't count; release them (cancel the payment) in the background
  releaseInBackground(context, supabase, slotsWithExpiredHolds(slots, 'Booking'))

  const now = new Date()
  const result = slots
    .filter(slot => !slot.memberOnly || isMember)
    .map(slot => {
      const booked = bookedPlayers(slot.Booking, now)
      const { Booking: _, ...slotData } = slot
      const available = Math.max(0, slot.maxPlayers - booked)
    return { ...slotData, bookedPlayers: booked, available, full: available === 0 }
    })

  return json(result)
}

async function summary(context, from, to) {
  const { request, env } = context
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const dbUser = await getOptionalUser(request, supabase)
  const today = localDate()
  const isMember = dbUser?.role === 'ADMIN' || isActiveMember(dbUser, today)

  let slots
  try {
    // ~58 slots a day: a month is over PostgREST's 1,000-row page
    slots = await fetchAll(() => {
      let q = supabase
        .from('TeeTimeSlot')
        .select(`id, date, startTime, maxPlayers, memberOnly, Booking(${HOLD_COLUMNS})`)
        .gte('date', from)
        .lte('date', to)
        .order('date')
        .order('startTime')
      if (!isMember) q = q.eq('memberOnly', false)
      return q
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }

  releaseInBackground(context, supabase, slotsWithExpiredHolds(slots, 'Booking'))

  const now = new Date()
  const days = new Map()
  for (const slot of slots) {
    const day = String(slot.date).slice(0, 10)
    if (!days.has(day)) days.set(day, { date: day, open: 0, spots: 0 })
    if (day < today || (day === today && localDateTimeToUtc(day, slot.startTime) <= now)) continue
    const available = Math.max(0, slot.maxPlayers - bookedPlayers(slot.Booking, now))
    if (available > 0) {
      const d = days.get(day)
      d.open += 1
      d.spots += available
    }
  }
  return json([...days.values()])
}
