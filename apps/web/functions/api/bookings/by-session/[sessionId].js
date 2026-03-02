import { createClient } from '@supabase/supabase-js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestGet({ env, params }) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: booking, error } = await supabase
    .from('Booking')
    .select('*, teeTimeSlot:TeeTimeSlot(date, startTime)')
    .eq('stripeSessionId', params.sessionId)
    .maybeSingle()

  if (error || !booking) return json({ error: 'Booking not found' }, 404)

  return json(booking)
}
