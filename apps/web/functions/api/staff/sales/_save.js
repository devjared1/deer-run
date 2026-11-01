import { loadSale, emailReceipt } from './_sale.js'
import { extendMembership, shortenMembership } from '../../../../src/lib/membership.js'
import { downgradeIfLapsed } from '../../admin/_membership.js'
import { localDate } from '../../../../src/lib/timeclock.js'
import { bookedPlayers, HOLD_COLUMNS } from '../../../../src/lib/teesheet.js'

// Saving a sale and the steps around it, shared by cash sales (POST /api/staff/sales) and card sales
// (saved once the card is charged: _cardCheckout.js).

/**
 * Slots with the players already booked (paid bookings, and pending ones still holding their spots: see
 * holdsSpot in src/lib/teesheet.js). Returns { data } or { error }.
 */
export async function loadSlots(supabase, ids) {
  const { data, error } = await supabase
    .from('TeeTimeSlot')
    .select(`id, date, startTime, maxPlayers, memberOnly, bookings:Booking(source, ${HOLD_COLUMNS})`)
    .in('id', ids)
  if (error) return { error }
  const now = new Date()
  return {
    data: data.map(({ bookings, ...slot }) => ({ ...slot, bookedPlayers: bookedPlayers(bookings, now) })),
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

// Pay at course: a line that collected a booking's balance (`balanceCents`, from buildSale) marks it paid. Only if
// the balance is still what was rung up, so two sales can't both clear it. Returns an error message, or null.
async function settleBalances(supabase, lines) {
  for (const line of lines) {
    if (!line.bookingId || !(line.balanceCents > 0)) continue
    const { data, error } = await supabase.from('Booking').update({ balanceDueCents: 0 })
      .eq('id', line.bookingId).eq('balanceDueCents', line.balanceCents)
      .select('id')
    if (error) return error.message
    if (!data?.length) return 'its balance had already been paid or changed. Check the booking and refund this line if it was paid twice'
  }
  return null
}

/**
 * Pay at course: refunding a tee time balance line (a booking line with a price; prepaid greens fee lines are $0) puts
 * the refunded amount back on the booking's balance, so it's collected again if the group still plays. After
 * refund_sale; `refunded` is the SaleRefund it returned, with items { saleItemId, amountCents }.
 * Returns an error message, or null.
 */
export async function refundBalances(supabase, sale, refunded) {
  const lines = Object.fromEntries(sale.items.map(i => [i.id, i]))
  const back = {}
  for (const r of refunded?.items ?? []) {
    const line = lines[r.saleItemId]
    if (!line?.bookingId || !(line.unitPriceCents > 0)) continue
    back[line.bookingId] = (back[line.bookingId] ?? 0) + (r.amountCents - (r.taxCents ?? 0))
  }
  for (const [bookingId, cents] of Object.entries(back)) {
    const { data: booking, error } = await supabase.from('Booking').select('id, balanceDueCents').eq('id', bookingId).maybeSingle()
    if (error) return error.message
    if (!booking || booking.balanceDueCents === undefined) continue
    const { error: updateError } = await supabase.from('Booking')
      .update({ balanceDueCents: booking.balanceDueCents + cents }).eq('id', bookingId)
    if (updateError) return updateError.message
  }
  return null
}

// A tip added on the card reader (card sales only) goes on the card Payment row next to the sale's share,
// so it never counts as sales revenue or tax. Runs right after create_sale (which doesn't know about tips).
// Returns an error message, or null.
async function recordTips(supabase, saleId, payments) {
  for (const p of payments) {
    if (!(p.tipCents > 0) || !p.stripePaymentIntentId) continue
    const { error } = await supabase.from('Payment').update({ tipCents: p.tipCents })
      .eq('saleId', saleId).eq('stripePaymentIntentId', p.stripePaymentIntentId)
    if (error) return error.message
  }
  return null
}

// Stores each line's member discount (SaleItem.memberDiscountCents) so receipts show it apart from manager
// discounts; create_sale doesn't write that column. Skipped while the column doesn't exist yet (receipts then
// show the two as one discount). Returns an error message, or null.
async function recordMemberDiscounts(supabase, sale, lines) {
  for (const [i, line] of lines.entries()) {
    if (!line.memberDiscountCents) continue
    const item = sale.items[i]
    if (!item || item.description !== line.description) return 'receipt lines are out of order'
    if (!('memberDiscountCents' in item) || item.memberDiscountCents === line.memberDiscountCents) continue
    const { error } = await supabase.from('SaleItem').update({ memberDiscountCents: line.memberDiscountCents }).eq('id', item.id)
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
 * Takes refunded membership months (quantity × the product's membershipMonths) back off the sale's customer, after
 * refund_sale. If the end date is now before today, a member drops to GUEST (admins keep their role) and the
 * "membership ended" email is skipped, since they asked for the refund.
 *   items: the refunded lines, [{ saleItemId, quantity }]
 * Returns null (no membership lines), { memberUntil } or { error }.
 */
export async function refundMembership(supabase, sale, items, today) {
  const lines = Object.fromEntries(sale.items.map(i => [i.id, i]))
  const variantIds = [...new Set(items.map(i => lines[i.saleItemId]?.variantId).filter(Boolean))]
  if (!variantIds.length || !sale.customerId) return null

  const { data: variants, error } = await supabase.from('ProductVariant').select('id, product:Product(membershipMonths)').in('id', variantIds)
  if (error) return { error: error.message }
  const monthsByVariant = Object.fromEntries(variants.map(v => [v.id, v.product?.membershipMonths ?? 0]))
  const months = items.reduce((sum, i) => sum + (monthsByVariant[lines[i.saleItemId]?.variantId] ?? 0) * i.quantity, 0)
  if (!months) return null

  const { data: user, error: userError } = await supabase.from('User').select('id, role, memberUntil').eq('id', sale.customerId).single()
  if (userError) return { error: userError.message }
  if (!user.memberUntil) return { error: 'the customer\'s membership has no end date' }

  const memberUntil = shortenMembership(user.memberUntil, months)
  const lapsed = memberUntil < today
  const { error: updateError } = await supabase
    .from('User')
    // Reminders start over for the new end date (renewalReminderKey is "<memberUntil>:<stage>")
    .update({ memberUntil, renewalReminderKey: lapsed ? `${memberUntil}:expired` : null })
    .eq('id', user.id)
  if (updateError) return { error: updateError.message }
  try {
    await downgradeIfLapsed(supabase, { ...user, memberUntil }, today)
  } catch (e) {
    return { error: e.message }
  }
  return { memberUntil }
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
  if (error) return { error: error.message, code: error.code }

  const warnings = []
  const tipError = await recordTips(supabase, created.id, prepared.payments)
  if (tipError) warnings.push(`The card tip wasn't recorded on this receipt: ${tipError}`)
  if (prepared.approvalId) {
    await supabase.from('ManagerApproval').update({ saleId: created.id }).eq('id', prepared.approvalId)
  }
  let sale = await loadSale(supabase, created.id)
  if (prepared.items.some(l => l.bookingId)) {
    const linkError = await linkBookings(supabase, sale, prepared.items)
    if (linkError) warnings.push(`The tee time wasn't linked to this receipt: ${linkError}`)
    else sale = await loadSale(supabase, created.id)
  }
  if (prepared.items.some(l => l.balanceCents > 0)) {
    const balanceError = await settleBalances(supabase, prepared.items)
    if (balanceError) warnings.push(`The tee time balance wasn't marked paid: ${balanceError}.`)
  }
  if (prepared.items.some(l => l.memberDiscountCents)) {
    const discountError = await recordMemberDiscounts(supabase, sale, prepared.items)
    if (discountError) warnings.push(`The member discount shows as a plain discount on this receipt: ${discountError}`)
    else sale = await loadSale(supabase, created.id)
  }
  if (prepared.membership && prepared.customerId) {
    const memberError = await applyMembership(supabase, prepared.customerId, prepared.membership, localDate())
    if (memberError) warnings.push(`The membership wasn't added to the customer's account: ${memberError}. Update them in Admin → Users.`)
  }
  const emailError = prepared.receiptEmail ? await emailReceipt(env, sale, prepared.receiptEmail) : null
  return { sale, warnings, emailError }
}
