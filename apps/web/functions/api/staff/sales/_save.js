import { loadSale, emailReceipt } from './_sale.js'
import { extendMembership } from '../../../../src/lib/membership.js'
import { localDate } from '../../../../src/lib/timeclock.js'

// Saving a sale and the steps around it, shared by cash sales (POST /api/staff/sales) and card sales
// (saved once the card is charged: _cardCheckout.js).

/** Slots with the players already booked (pending and paid bookings hold spots). Returns { data } or { error }. */
export async function loadSlots(supabase, ids) {
  const { data, error } = await supabase
    .from('TeeTimeSlot')
    .select('id, date, startTime, maxPlayers, memberOnly, bookings:Booking(players, status)')
    .in('id', ids)
  if (error) return { error }
  return {
    data: data.map(({ bookings, ...slot }) => ({
      ...slot,
      bookedPlayers: (bookings || []).filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED').reduce((sum, b) => sum + b.players, 0),
    })),
  }
}

/**
 * Creates a walk-in/phone booking. Space is checked again right before the insert; the online booking flow
 * works the same way, so two bookings in the same instant could still overfill a slot. Card sales create it
 * PENDING (holding the spot while the card is on the reader) and confirm it when the sale saves.
 * totalCents is 0: the greens fees are on the sale, and counting them here too would double the revenue.
 * Returns { id } or { error, status }.
 */
export async function createBooking(supabase, nb, customer, status = 'CONFIRMED') {
  const { data: [slot] = [], error } = await loadSlots(supabase, [nb.teeTimeSlotId])
  if (error) return { error: error.message, status: 500 }
  if (!slot || slot.maxPlayers - slot.bookedPlayers < nb.players) {
    return { error: 'That tee time just filled up. Pick another time.', status: 409 }
  }
  const id = crypto.randomUUID()
  const { error: insertError } = await supabase.from('Booking').insert({
    id,
    teeTimeSlotId: nb.teeTimeSlotId,
    userId: customer?.id ?? null,
    guestName: nb.name,
    guestEmail: null,
    players: nb.players,
    totalCents: 0,
    status,
    source: nb.source,
  })
  if (insertError) return { error: insertError.message, status: 500 }
  return { id }
}

// Makes sure tee time lines carry SaleItem.bookingId. create_sale stores it since migration 7; before that
// (or if it didn't), set it here. create_sale saves lines in order (sortOrder 0, 1, 2…).
// Returns an error message, or null.
async function linkBookings(supabase, sale, lines) {
  for (const [i, line] of lines.entries()) {
    if (!line.bookingId) continue
    const item = sale.items[i]
    if (!item || item.description !== line.description) return 'receipt lines are out of order'
    if (item.bookingId === line.bookingId) continue
    const { error } = await supabase.from('SaleItem').update({ bookingId: line.bookingId }).eq('id', item.id)
    if (error) return error.message
  }
  return null
}

/** { months, tier } bought in this sale, or null. Several membership lines add up; the last tier named wins. */
export function membershipPurchase(items, variantsById) {
  let months = 0
  let tier = null
  for (const item of items) {
    const product = item?.variantId ? variantsById[item.variantId]?.product : null
    if (!product?.membershipMonths) continue
    months += product.membershipMonths * Number(item.quantity)
    tier = product.membershipTier || tier
  }
  return months > 0 ? { months, tier } : null
}

// Makes the customer a member through their new end date. Admins keep their role. Returns an error message or null.
async function applyMembership(supabase, userId, { months, tier }, today) {
  const { data: user, error } = await supabase.from('User').select('id, role, memberUntil').eq('id', userId).single()
  if (error) return error.message
  // A member with no end date (added by hand) starts counting from today
  const current = user.role === 'MEMBER' || user.role === 'ADMIN' ? user.memberUntil : null
  const update = {
    memberUntil: extendMembership(current, months, today),
    renewalReminderKey: null,
    ...(tier ? { membershipTier: tier } : {}),
    ...(user.role === 'ADMIN' ? {} : { role: 'MEMBER' }),
  }
  const { error: updateError } = await supabase.from('User').update(update).eq('id', userId)
  return updateError ? updateError.message : null
}

/**
 * Saves a priced sale with create_sale and runs the follow-ups. Everything after create_sale reports a
 * warning instead of failing, because the sale (and the money) is already in.
 *   prepared: { sale (p_sale), items (p_items, with bookingId on tee time lines), payments (p_payments),
 *               customerId, membership, approvalId, receiptEmail }
 * Returns { sale, warnings, emailError } or { error }.
 */
export async function saveSale(supabase, env, prepared) {
  const { data: created, error } = await supabase.rpc('create_sale', {
    p_sale: prepared.sale,
    p_items: prepared.items,
    p_payments: prepared.payments,
  })
  if (error) return { error: error.message }

  const warnings = []
  if (prepared.approvalId) {
    await supabase.from('ManagerApproval').update({ saleId: created.id }).eq('id', prepared.approvalId)
  }
  let sale = await loadSale(supabase, created.id)
  if (prepared.items.some(l => l.bookingId)) {
    const linkError = await linkBookings(supabase, sale, prepared.items)
    if (linkError) warnings.push(`The tee time wasn't linked to this receipt: ${linkError}`)
    else sale = await loadSale(supabase, created.id)
  }
  if (prepared.membership && prepared.customerId) {
    const memberError = await applyMembership(supabase, prepared.customerId, prepared.membership, localDate())
    if (memberError) warnings.push(`The membership wasn't added to the customer's account: ${memberError}. Update them in Admin → Users.`)
  }
  const emailError = prepared.receiptEmail ? await emailReceipt(env, sale, prepared.receiptEmail) : null
  return { sale, warnings, emailError }
}
