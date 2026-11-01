import { requireAdmin, json } from './_auth.js'
import { fetchAll } from './_db.js'
import { addDays, localDate, toUtcIso } from '../../../src/lib/timeclock.js'

// GET /api/admin/dashboard →
// { today: { date, bookings, players }, lastWeek: { date, bookings, players } (same weekday a week ago),
//   week: { revenueCents, confirmedBookings, previousRevenueCents, previousConfirmedBookings },
//   series: [{ date, bookings, players, revenueCents }] (the last 7 course-local days, oldest first: bookings/players
//   by tee date, revenue by the day a confirmed booking was made),
//   totalUsers, pendingBookings, upcomingEvents, recentBookings }
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  // Course-local dates (toISOString() is UTC, which is already tomorrow after 7 pm Central)
  const today = localDate()
  const lastWeekDay = addDays(today, -7)
  const seriesStart = addDays(today, -6)
  const now = Date.now()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

  let teeBookings, madeBookings
  try {
    ;[teeBookings, madeBookings] = await Promise.all([
      // Bookings by tee date: a week ago through today (today, the same day last week and the 7-day series)
      fetchAll(() => supabase.from('Booking')
        .select('id, players, status, TeeTimeSlot!inner(date)')
        .gte('TeeTimeSlot.date', lastWeekDay)
        .lte('TeeTimeSlot.date', today)
        .in('status', ['PENDING', 'CONFIRMED'])
        .order('id')),
      // Confirmed bookings made in the last 14 days (this week's and last week's revenue)
      fetchAll(() => supabase.from('Booking')
        .select('id, totalCents, createdAt')
        .gte('createdAt', twoWeeksAgo)
        .eq('status', 'CONFIRMED')
        .order('id')),
    ])
  } catch (e) {
    return json({ error: e.message }, 500)
  }

  const [
    { data: upcomingEvents },
    { data: recentBookings },
    { count: userCount },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.from('TournamentEvent')
      .select('id, name, eventDate, featured')
      .eq('past', false)
      .order('eventDate')
      .limit(5),
    supabase.from('Booking')
      .select('id, players, totalCents, status, guestName, createdAt, TeeTimeSlot(date, startTime), User(name, email)')
      .order('createdAt', { ascending: false })
      .limit(10),
    supabase.from('User').select('id', { count: 'exact', head: true }),
    supabase.from('Booking').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
  ])

  const byTeeDate = date => {
    const list = teeBookings.filter(b => b.TeeTimeSlot?.date === date)
    return { bookings: list.length, players: list.reduce((s, b) => s + b.players, 0) }
  }

  const weekAgoMs = Date.parse(weekAgo)
  const madeAt = b => Date.parse(toUtcIso(b.createdAt))
  const thisWeek = madeBookings.filter(b => madeAt(b) >= weekAgoMs)
  const prevWeek = madeBookings.filter(b => madeAt(b) < weekAgoMs)
  const sum = list => list.reduce((s, b) => s + b.totalCents, 0)

  const revenueByDay = {}
  for (const b of madeBookings) {
    const day = localDate(new Date(toUtcIso(b.createdAt)))
    revenueByDay[day] = (revenueByDay[day] || 0) + b.totalCents
  }
  const series = []
  for (let d = seriesStart; d <= today; d = addDays(d, 1)) {
    series.push({ date: d, ...byTeeDate(d), revenueCents: revenueByDay[d] || 0 })
  }

  return json({
    today: { date: today, ...byTeeDate(today) },
    lastWeek: { date: lastWeekDay, ...byTeeDate(lastWeekDay) },
    week: {
      revenueCents: sum(thisWeek),
      confirmedBookings: thisWeek.length,
      previousRevenueCents: sum(prevWeek),
      previousConfirmedBookings: prevWeek.length,
    },
    series,
    totalUsers: userCount ?? 0,
    pendingBookings: pendingCount ?? 0,
    upcomingEvents: upcomingEvents || [],
    recentBookings: recentBookings || [],
  })
}
