import { requireAdmin, json, makeSupabase } from './_auth.js'

export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: todayBookings },
    { data: weekBookings },
    { data: upcomingEvents },
    { data: recentBookings },
    { data: userCount },
    { data: pendingCount },
  ] = await Promise.all([
    supabase.from('Booking')
      .select('id, players, totalCents, status, TeeTimeSlot!inner(date)')
      .eq('TeeTimeSlot.date', today)
      .in('status', ['PENDING', 'CONFIRMED']),
    supabase.from('Booking')
      .select('id, totalCents, status')
      .gte('createdAt', weekAgo)
      .eq('status', 'CONFIRMED'),
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

  const todayPlayers = (todayBookings || []).reduce((s, b) => s + b.players, 0)
  const weekRevenueCents = (weekBookings || []).reduce((s, b) => s + b.totalCents, 0)

  return json({
    today: {
      bookings: (todayBookings || []).length,
      players: todayPlayers,
    },
    week: {
      revenueCents: weekRevenueCents,
      confirmedBookings: (weekBookings || []).length,
    },
    totalUsers: userCount,
    pendingBookings: pendingCount,
    upcomingEvents: upcomingEvents || [],
    recentBookings: recentBookings || [],
  })
}
