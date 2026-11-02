import { json, makeSupabase } from '../admin/_auth.js'
import { addDays, isValidYmd, localDate } from '../../../src/lib/timeclock.js'

const MAX_ACTIVE_PER_EMAIL = 5
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/waitlist — { date, players, name?, email? } "Tell me if a time opens up" for a full day (booking Time
// step). Signed-in golfers' name and email come from their account; guests give both. The same email on the same day
// updates its entry. → 201 { id, date, players, email }. The golfer is emailed once if room opens up (_waitlist.js).
export async function onRequestPost({ request, env }) {
  const supabase = makeSupabase(env)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const user = await optionalUser(request, supabase)
  const date = body?.date
  const players = Number(body?.players)
  const email = String(user?.email ?? body?.email ?? '').trim().toLowerCase()
  const name = String(user?.name ?? body?.name ?? '').trim().slice(0, 100)

  const today = localDate()
  const { data: settings } = await supabase.from('CourseSettings').select('memberBookingDays').eq('id', 'singleton').maybeSingle()
  const last = addDays(today, settings?.memberBookingDays ?? 14)
  if (!isValidYmd(date) || date < today || date > last) return json({ error: 'Pick a day in the booking window' }, 400)
  if (!Number.isInteger(players) || players < 1 || players > 4) return json({ error: 'players must be 1–4' }, 400)
  if (!EMAIL.test(email)) return json({ error: 'Enter a valid email address' }, 400)
  if (!name) return json({ error: 'Enter your name' }, 400)

  const { data: active, error } = await supabase.from('WaitlistEntry').select('id, date')
    .eq('email', email).is('notifiedAt', null).is('cancelledAt', null).gte('date', today)
  if (error) return json({ error: error.message }, 500)

  const same = active.find(e => String(e.date).slice(0, 10) === date)
  if (same) {
    const { error: updateError } = await supabase.from('WaitlistEntry').update({ players, name }).eq('id', same.id)
    if (updateError) return json({ error: updateError.message }, 500)
    return json({ id: same.id, date, players, email }, 200)
  }
  if (active.length >= MAX_ACTIVE_PER_EMAIL) {
    return json({ error: `You're already on the waitlist for ${MAX_ACTIVE_PER_EMAIL} days. Call the pro shop for more.` }, 409)
  }

  const id = crypto.randomUUID()
  const { error: insertError } = await supabase.from('WaitlistEntry')
    .insert({ id, date, players, name, email, userId: user?.id ?? null })
  if (insertError) return json({ error: insertError.message }, 500)
  return json({ id, date, players, email }, 201)
}

async function optionalUser(request, supabase) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7))
  if (error || !user) return null
  const { data } = await supabase.from('User').select('id, email, name').eq('supabaseId', user.id).maybeSingle()
  return data ?? null
}
