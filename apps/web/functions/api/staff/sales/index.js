import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { buildSale } from './_build.js'
import { loadSale, emailReceipt } from './_sale.js'
import { consumeApproval } from '../_approvals.js'
import { localDate, isValidYmd, startOfLocalDay, addDays, toUtcIso } from '../../../../src/lib/timeclock.js'
import { isActiveMember, extendMembership } from '../../../../src/lib/membership.js'
import { openSession, DRAWER_REQUIRED_MESSAGE } from '../_drawer.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/staff/sales?date=YYYY-MM-DD&registerId=&number=
// Sales for a course-local day (default today), newest first. `number` finds one receipt on any day.
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || localDate()
  const number = searchParams.get('number')
  if (!isValidYmd(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400)

  let query = supabase
    .from('Sale')
    .select('id, number, status, totalCents, refundedCents, createdAt, register:Register!Sale_registerId_fkey(name), ' +
      'cashier:Employee!Sale_cashierId_fkey(firstName, lastName), customer:User(name, email)')
    .order('createdAt', { ascending: false })
    .limit(200)

  if (number) {
    if (!/^\d+$/.test(number)) return json({ error: 'Receipt number must be digits' }, 400)
    query = query.eq('number', Number(number))
  } else {
    query = query
      .gte('createdAt', startOfLocalDay(date).toISOString())
      .lt('createdAt', startOfLocalDay(addDays(date, 1)).toISOString())
    if (searchParams.get('registerId')) query = query.eq('registerId', searchParams.get('registerId'))
  }

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)

  return json((data || []).map(s => ({ ...s, createdAt: toUtcIso(s.createdAt) })))
}

// POST /api/staff/sales — complete a sale at the register
// Body: { registerId, customerId?, items: [...], payments: [{ method, tenderedCents }],
//         expectedTotalCents, receiptEmail?, approvalId? }  (see buildSale for item shapes)
// Cash needs the register's drawer open (409 code DRAWER_CLOSED). Membership products need a customer.
// Returns { sale, emailError, warnings } — warnings list follow-up steps that failed after the sale saved.
// Prices, tax and totals are recomputed here from the database; the client's numbers are
// only used to confirm the customer is charged what the register showed.
export async function onRequestPost({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const receiptEmail = body.receiptEmail ? String(body.receiptEmail).trim().toLowerCase() : null
  if (receiptEmail && !EMAIL_PATTERN.test(receiptEmail)) return json({ error: 'Receipt email is not valid' }, 400)

  const { data: register } = await supabase
    .from('Register')
    .select('id, active')
    .eq('id', body.registerId ?? '')
    .maybeSingle()
  if (!register?.active) return json({ error: 'This register is not set up or is inactive. Choose a register.' }, 400)

  const today = localDate()
  let customer = null
  if (body.customerId) {
    const { data } = await supabase.from('User').select('id, role, memberUntil').eq('id', body.customerId).maybeSingle()
    if (!data) return json({ error: 'Customer not found' }, 400)
    customer = data
  }
  // A lapsed membership doesn't get member pricing (the nightly job also moves them to GUEST)
  const isMember = isActiveMember(customer, today)

  const items = Array.isArray(body.items) ? body.items : []
  const variantIds = [...new Set(items.map(i => i?.variantId).filter(Boolean))]
  const bookingIds = [...new Set(items.map(i => i?.booking?.bookingId).filter(Boolean))]
  const slotIds = [...new Set(items.map(i => i?.newBooking?.teeTimeSlotId).filter(Boolean))]
  const [{ data: settings }, { data: variants, error: variantError }, bookingsRes, slotsRes] = await Promise.all([
    supabase.from('CourseSettings').select('salesTaxBps').eq('id', 'singleton').maybeSingle(),
    variantIds.length
      ? supabase
        .from('ProductVariant')
        .select('id, size, color, priceCents, memberPriceCents, active, ' +
          'product:Product(id, name, priceCents, memberPriceCents, trackInventory, active, membershipMonths, membershipTier, ' +
          'category:ProductCategory(name, taxExempt, active))')
        .in('id', variantIds)
      : Promise.resolve({ data: [] }),
    bookingIds.length
      ? supabase.from('Booking').select('id, status, source, players, slot:TeeTimeSlot(date, startTime)').in('id', bookingIds)
      : Promise.resolve({ data: [] }),
    slotIds.length ? loadSlots(supabase, slotIds) : Promise.resolve({ data: [] }),
  ])
  const loadError = variantError || bookingsRes.error || slotsRes.error
  if (loadError) return json({ error: loadError.message }, 500)

  const variantsById = Object.fromEntries((variants || []).map(v => [v.id, v]))
  const built = buildSale({
    items,
    variantsById,
    isMember,
    taxBps: settings?.salesTaxBps ?? 0,
    payments: body.payments,
    expectedTotalCents: body.expectedTotalCents,
    bookingsById: Object.fromEntries((bookingsRes.data || []).map(b => [b.id, b])),
    slotsById: Object.fromEntries((slotsRes.data || []).map(s => [s.id, s])),
    hasCustomer: !!customer,
    today,
  })
  if (built.error) return json({ error: built.error, totals: built.totals }, built.status)

  // Memberships: the months bought (quantity × months per product) go on the attached customer
  const membership = membershipPurchase(items, variantsById)
  if (membership && !customer) {
    return json({ error: 'Attach the customer before selling a membership, so it goes on their account.' }, 400)
  }

  // Cash goes in the drawer, so the register's drawer must be open (counted) to take it
  if (built.payments.some(p => p.method === 'CASH')) {
    const session = await openSession(supabase, register.id)
    if (!session) return json({ error: DRAWER_REQUIRED_MESSAGE, code: 'DRAWER_CLOSED' }, 409)
  }

  // Only managers can discount: a discounted sale must carry an unused DISCOUNT approval
  let approval = null
  if (built.lines.some(l => l.discountCents > 0)) {
    approval = await consumeApproval(supabase, body.approvalId, { action: 'DISCOUNT', cashierId: employee.id })
    if (!approval) {
      return json({ error: 'Discounts need a manager\'s approval, and it may have expired. Approve the discount again.', code: 'APPROVAL_REQUIRED' }, 403)
    }
  }

  // A walk-in/phone booking is created just before the sale (re-checking space) and removed if the sale fails
  let createdBookingId = null
  if (built.newBooking) {
    const created = await createBooking(supabase, built.newBooking, customer)
    if (created.error) return json({ error: created.error }, created.status)
    createdBookingId = created.id
  }
  const lines = built.lines.map(({ newBooking, ...line }) => (newBooking ? { ...line, bookingId: createdBookingId } : line))

  const { data: created, error } = await supabase.rpc('create_sale', {
    p_sale: {
      registerId: register.id,
      cashierId: employee.id,
      customerId: customer?.id ?? null,
      userId: dbUser.id,
      isMemberPricing: isMember,
      ...built.totals,
      changeCents: built.changeCents,
      receiptEmail,
    },
    p_items: lines,
    p_payments: built.payments,
  })
  if (error) {
    if (createdBookingId) await supabase.from('Booking').delete().eq('id', createdBookingId)
    return json({ error: error.message }, 500)
  }

  if (approval) await supabase.from('ManagerApproval').update({ saleId: created.id }).eq('id', approval.id)

  // The sale is saved; the steps below link and update records and report problems without failing the sale
  const warnings = []
  let sale = await loadSale(supabase, created.id)
  const linkError = await linkBookings(supabase, sale, lines)
  if (linkError) warnings.push(`The tee time wasn't linked to this receipt: ${linkError}`)
  if (membership) {
    const memberError = await applyMembership(supabase, customer.id, membership, today)
    if (memberError) warnings.push(`The membership wasn't added to the customer's account: ${memberError}. Update them in Admin → Users.`)
  }
  if (linkError === null && lines.some(l => l.bookingId)) sale = await loadSale(supabase, created.id)

  const emailError = receiptEmail ? await emailReceipt(env, sale, receiptEmail) : null

  return json({ sale, emailError, warnings }, 201)
}

// Slots with the players already booked (pending and paid bookings hold spots)
async function loadSlots(supabase, ids) {
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
 * Creates a paid (CONFIRMED) walk-in/phone booking. Space is checked again right before the insert;
 * the online booking flow works the same way, so two bookings in the same instant could still overfill a slot.
 * totalCents is 0: the greens fees are on the sale, and counting them here too would double the revenue.
 */
async function createBooking(supabase, nb, customer) {
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
    status: 'CONFIRMED',
    source: nb.source,
  })
  if (insertError) return { error: insertError.message, status: 500 }
  return { id }
}

// Sets SaleItem.bookingId on the receipt lines for tee times (create_sale saves lines in order).
// Returns an error message, null when it linked lines, or undefined when there was nothing to link.
async function linkBookings(supabase, sale, lines) {
  if (!lines.some(l => l.bookingId)) return undefined
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

// Makes the customer a member through their new end date. Admins keep their role.
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
