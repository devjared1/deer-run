import { createClient } from '@supabase/supabase-js'
import { isActiveMember } from '../../src/lib/membership.js'
import { localDate } from '../../src/lib/timeclock.js'
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

export async function onRequestGet(context) {
  const { request, env } = context
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') // expected: YYYY-MM-DD

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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
