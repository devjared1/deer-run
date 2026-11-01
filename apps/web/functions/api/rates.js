import { createClient } from '@supabase/supabase-js'
import { loadRates } from './_rates.js'

// GET /api/rates → { rates: { WEEKDAY_9, WEEKDAY_18, WEEKEND_9, WEEKEND_18, CART } (cents), holidayDates: ['YYYY-MM-DD'],
//   payAtCourseFeeCents (hold fee per online booking that pays the rest at the course; 0 = only pay in full) }
// Public: the Rates page and the booking flow show these; the server recomputes the price when booking.
export async function onRequestGet({ env }) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const { rates, holidayDates, payAtCourseFeeCents } = await loadRates(supabase)
  return Response.json({ rates, holidayDates, payAtCourseFeeCents }, { headers: { 'Cache-Control': 'public, max-age=60' } })
}
