import { json } from '../../admin/_auth.js'
import { requireStaff } from '../_auth.js'
import { claimBlocker, OFFER_SELECT, serializeOffers, shiftStarted } from '../_shiftOffers.js'

// POST /api/staff/shift-offers/:id — { action: 'claim' | 'release' | 'cancel' } → { offer }
//   claim:   pick up an OPEN shift (not mine; I don't already work then or have time off) → CLAIMED, waits for a manager
//   release: let go of a shift I picked up before a manager decided → OPEN again
//   cancel:  withdraw my own offer while it's OPEN or CLAIMED → CANCELLED (the shift stays mine)
export async function onRequestPost({ request, env, params }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: offer, error } = await supabase.from('ShiftOffer').select(OFFER_SELECT).eq('id', params.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!offer?.shift) return json({ error: 'Offer not found' }, 404)

  let update
  let from
  if (body?.action === 'claim') {
    if (offer.status !== 'OPEN') return json({ error: 'Someone else already picked up this shift.' }, 409)
    const blocked = await claimBlocker(supabase, offer.shift, employee).catch(e => e.message)
    if (blocked) return json({ error: blocked }, 409)
    update = { status: 'CLAIMED', claimedById: employee.id, claimedAt: new Date().toISOString() }
    from = 'OPEN'
  } else if (body?.action === 'release') {
    if (offer.status !== 'CLAIMED' || offer.claimedById !== employee.id) return json({ error: 'You haven\'t picked up this shift.' }, 409)
    update = { status: 'OPEN', claimedById: null, claimedAt: null }
    from = 'CLAIMED'
  } else if (body?.action === 'cancel') {
    if (offer.offeredById !== employee.id || offer.postedById) return json({ error: 'Only the person who offered a shift can withdraw it.' }, 403)
    if (!['OPEN', 'CLAIMED'].includes(offer.status)) return json({ error: 'This offer is already closed.' }, 409)
    update = { status: 'CANCELLED' }
    from = offer.status
  } else {
    return json({ error: 'action must be claim, release or cancel' }, 400)
  }
  if (shiftStarted(offer.shift)) return json({ error: 'This shift has already started.' }, 409)

  // Conditional on the status it was, so two coworkers can't both pick it up
  const { data: updated, error: updateError } = await supabase.from('ShiftOffer').update(update)
    .eq('id', offer.id).eq('status', from).select(OFFER_SELECT)
  if (updateError) return json({ error: updateError.message }, 500)
  if (!updated?.length) return json({ error: 'This offer just changed. Refresh and try again.' }, 409)
  const [serialized] = await serializeOffers(supabase, updated)
  return json({ offer: serialized })
}
