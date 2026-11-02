import { requireAdmin, json } from '../_auth.js'
import { claimBlocker, emailEmployee, OFFER_SELECT, serializeOffers, shiftLabel, shiftStarted } from '../../staff/_shiftOffers.js'

// PUT /api/admin/shift-offers/:id — { action: 'approve' | 'deny' | 'cancel', note? } → { offer, emailErrors? }
//   approve (CLAIMED): the shift moves to whoever picked it up (if it's still the offerer's and they're still free
//            then), and both are emailed
//   deny    (CLAIMED): it stays with the offerer; both are emailed
//   cancel  (OPEN / CLAIMED): take the offer down (the shift stays where it is)
export async function onRequestPut({ request, env, params }) {
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

  const { data: offer, error } = await supabase.from('ShiftOffer').select(OFFER_SELECT).eq('id', params.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!offer?.shift) return json({ error: 'Offer not found' }, 404)

  const action = body?.action
  if (!['approve', 'deny', 'cancel'].includes(action)) return json({ error: 'action must be approve, deny or cancel' }, 400)
  if (action !== 'cancel' && offer.status !== 'CLAIMED') return json({ error: 'Nobody has picked up this shift yet.' }, 409)
  if (action === 'cancel' && !['OPEN', 'CLAIMED'].includes(offer.status)) return json({ error: 'This offer is already closed.' }, 409)

  const ids = [offer.offeredById, offer.claimedById].filter(Boolean)
  const { data: people } = await supabase.from('Employee').select('*').in('id', ids)
  const offerer = people?.find(p => p.id === offer.offeredById)
  const claimer = people?.find(p => p.id === offer.claimedById)

  if (action === 'approve') {
    if (shiftStarted(offer.shift)) return json({ error: 'This shift has already started.' }, 409)
    const blocked = await claimBlocker(supabase, offer.shift, claimer).catch(e => e.message)
    if (blocked) return json({ error: `${claimer?.firstName ?? 'They'} can't take it now: ${blocked}` }, 409)
    // Only if the shift is still the offerer's (an admin may have moved it meanwhile)
    const { data: moved, error: moveError } = await supabase.from('Shift').update({ employeeId: offer.claimedById })
      .eq('id', offer.shift.id).eq('employeeId', offer.offeredById).select('id')
    if (moveError) return json({ error: moveError.message }, 500)
    if (!moved?.length) return json({ error: 'The shift changed since it was offered. Check the schedule, then take this offer down.' }, 409)
  }

  const status = { approve: 'APPROVED', deny: 'DENIED', cancel: 'CANCELLED' }[action]
  const { data: updated, error: updateError } = await supabase.from('ShiftOffer')
    .update({ status, reviewedById: dbUser.id, reviewedAt: new Date().toISOString(), reviewNote: note })
    .eq('id', offer.id).eq('status', offer.status).select(OFFER_SELECT)
  if (updateError) return json({ error: updateError.message }, 500)
  if (!updated?.length) return json({ error: 'This offer just changed. Refresh and try again.' }, 409)

  const when = shiftLabel(offer.shift)
  const noteLine = note ? ['', `Note from your manager: ${note}`] : []
  const emailErrors = []
  if (action === 'approve') {
    emailErrors.push(
      await emailEmployee(env, claimer, `Shift is yours: ${when}`, [`Your manager approved it: ${when} is now your shift.`, ...noteLine]),
      await emailEmployee(env, offerer, `Shift covered: ${when}`, [`${claimer?.firstName ?? 'A coworker'} is taking your ${when} shift. It's off your schedule.`, ...noteLine]),
    )
  } else if (action === 'deny') {
    emailErrors.push(
      await emailEmployee(env, claimer, `Shift swap not approved: ${when}`, [`Your manager didn't approve you taking the ${when} shift.`, ...noteLine]),
      await emailEmployee(env, offerer, `Shift swap not approved: ${when}`, [`The swap wasn't approved, so the ${when} shift is still yours.`, ...noteLine]),
    )
  }
  const [serialized] = await serializeOffers(supabase, updated)
  const errors = emailErrors.filter(Boolean)
  return json({ offer: serialized, ...(errors.length ? { emailErrors: errors } : {}) })
}
