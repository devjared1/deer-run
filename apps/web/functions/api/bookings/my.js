import { createClient } from '@supabase/supabase-js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestGet({ request, env }) {
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

  const { data: bookings, error: dbError } = await supabase
    .from('Booking')
    .select('*, teeTimeSlot:TeeTimeSlot(date, startTime)')
    .eq('userId', dbUser.id)
    .order('createdAt', { ascending: false })

  if (dbError) return json({ error: dbError.message }, 500)

  return json(bookings)
}
