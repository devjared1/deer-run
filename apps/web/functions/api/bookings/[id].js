import { createClient } from '@supabase/supabase-js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestDelete({ request, env, params }) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401)
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7))
  if (authError || !user) return json({ error: 'Invalid token' }, 401)

  const { data: dbUser } = await supabase
    .from('User')
    .select('id')
    .eq('supabaseId', user.id)
    .maybeSingle()

  if (!dbUser) return json({ error: 'User not found' }, 404)

  const { data: booking, error: fetchError } = await supabase
    .from('Booking')
    .select('*, teeTimeSlot:TeeTimeSlot(date, startTime)')
    .eq('id', params.id)
    .eq('userId', dbUser.id)
    .maybeSingle()

  if (fetchError || !booking) return json({ error: 'Booking not found' }, 404)

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    return json({ error: 'Booking cannot be cancelled' }, 400)
  }

  const slotDate = new Date(booking.teeTimeSlot.date)
  const msUntil = slotDate.getTime() - Date.now()
  if (msUntil <= 24 * 60 * 60 * 1000) {
    return json({ error: 'Bookings must be cancelled at least 24 hours in advance' }, 400)
  }

  const { error: updateError } = await supabase
    .from('Booking')
    .update({ status: 'CANCELLED' })
    .eq('id', params.id)

  if (updateError) return json({ error: updateError.message }, 500)

  return json({ success: true })
}
