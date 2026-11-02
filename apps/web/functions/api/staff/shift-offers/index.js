import { json } from '../../admin/_auth.js'
import { requireStaff } from '../_auth.js'
import { localDate, toUtcIso } from '../../../../src/lib/timeclock.js'
import { ACTIVE, OFFER_SELECT, serializeOffers, shiftStarted } from '../_shiftOffers.js'

// GET /api/staff/shift-offers → { open: [offers anyone can pick up (not mine)], mine: [offers I made or picked up,
//   active ones and the last 30 days of decisions] } (see _shiftOffers.js serializeOffers)
// POST /api/staff/shift-offers { shiftId, note? } → 201 { offer }  offer my own upcoming shift to the team
export async function onRequestGet({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  const today = localDate()
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const [{ data: open, error }, { data: mine, error: mineError }] = await Promise.all([
    supabase.from('ShiftOffer').select(OFFER_SELECT).eq('status', 'OPEN').neq('offeredById', employee.id)
      .order('createdAt', { ascending: true }),
    supabase.from('ShiftOffer').select(OFFER_SELECT)
      .or(`offeredById.eq.${employee.id},claimedById.eq.${employee.id}`)
      .order('createdAt', { ascending: false }).limit(100),
  ])
  // Before migration 16 there are no offers
  if (error || mineError) {
    const e = error || mineError
    return e.code === '42P01' ? json({ open: [], mine: [], unavailable: true }) : json({ error: e.message }, 500)
  }

  const upcoming = o => o.shift && String(o.shift.date).slice(0, 10) >= today && !shiftStarted(o.shift)
  return json({
    open: await serializeOffers(supabase, (open || []).filter(upcoming)),
    // Active ones for shifts still to come, and decisions from the last 30 days
    mine: await serializeOffers(supabase, (mine || []).filter(o => (ACTIVE.includes(o.status)
      ? upcoming(o)
      : toUtcIso(o.reviewedAt ?? o.createdAt) >= since))),
  })
}

export async function onRequestPost({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

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
  if (!shift || shift.employeeId !== employee.id) return json({ error: 'Shift not found' }, 404)
  if (shiftStarted(shift)) return json({ error: 'This shift has already started.' }, 409)

  const { data: offer, error: insertError } = await supabase.from('ShiftOffer')
    .insert({ id: crypto.randomUUID(), shiftId: shift.id, offeredById: employee.id, note })
    .select(OFFER_SELECT).single()
  // 23505: the one-active-offer-per-shift index
  if (insertError?.code === '23505') return json({ error: 'This shift is already offered.' }, 409)
  if (insertError) return json({ error: insertError.message }, 500)
  const [serialized] = await serializeOffers(supabase, [offer])
  return json({ offer: serialized }, 201)
}
