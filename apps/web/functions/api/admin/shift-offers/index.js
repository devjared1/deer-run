import { requireAdmin, json } from '../_auth.js'
import { localDate } from '../../../../src/lib/timeclock.js'
import { ACTIVE, OFFER_SELECT, serializeOffers, shiftStarted } from '../../staff/_shiftOffers.js'

// GET  /api/admin/shift-offers → { offers } every active (OPEN / CLAIMED) offer for an upcoming shift, picked up ones
//      first (they need a decision)
// POST /api/admin/shift-offers { shiftId, note? } → 201 { offer }  post an upcoming shift as an open shift: anyone can
//      pick it up, then a manager approves as usual
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase.from('ShiftOffer').select(OFFER_SELECT).in('status', ACTIVE)
    .order('createdAt', { ascending: true })
  if (error) return error.code === '42P01' ? json({ offers: [], unavailable: true }) : json({ error: error.message }, 500)

  const today = localDate()
  const upcoming = (data || []).filter(o => o.shift && String(o.shift.date).slice(0, 10) >= today && !shiftStarted(o.shift))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'CLAIMED' ? -1 : 1))
  return json({ offers: await serializeOffers(supabase, upcoming) })
}

export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) || null : null

  const { data: shift, error } = await supabase.from('Shift').select('id, employeeId, date, startTime, endTime')
    .eq('id', body?.shiftId ?? '').maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!shift) return json({ error: 'Shift not found' }, 404)
  if (shiftStarted(shift)) return json({ error: 'This shift has already started.' }, 409)

  const { data: offer, error: insertError } = await supabase.from('ShiftOffer')
    .insert({ id: crypto.randomUUID(), shiftId: shift.id, offeredById: shift.employeeId, postedById: dbUser.id, note })
    .select(OFFER_SELECT).single()
  if (insertError?.code === '23505') return json({ error: 'This shift is already up for grabs.' }, 409)
  if (insertError) return json({ error: insertError.message }, 500)
  const [serialized] = await serializeOffers(supabase, [offer])
  return json({ offer: serialized }, 201)
}
