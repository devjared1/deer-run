import { createClient } from '@supabase/supabase-js'

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

export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') // expected: YYYY-MM-DD

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'date query param required (YYYY-MM-DD)' }, 400)
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const dbUser = await getOptionalUser(request, supabase)
  const isMember = dbUser?.role === 'MEMBER' || dbUser?.role === 'ADMIN'

  const { data: slots, error } = await supabase
    .from('TeeTimeSlot')
    .select('*, Booking(players, status)')
    .eq('date', date)
    .order('startTime')

  if (error) return json({ error: error.message }, 500)

  const result = slots
    .filter(slot => !slot.memberOnly || isMember)
    .map(slot => {
      const booked = (slot.Booking || [])
        .filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED')
        .reduce((sum, b) => sum + b.players, 0)
      const { Booking: _, ...slotData } = slot
      return { ...slotData, bookedPlayers: booked, available: slot.maxPlayers - booked }
    })

  return json(result)
}
