import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { buildSale } from './_build.js'
import { saveSale, loadSlots, createBooking, membershipPurchase } from './_save.js'
import { startCardCheckout } from '../_cardCheckout.js'
import { consumeApproval } from '../_approvals.js'
import { localDate, isValidYmd, startOfLocalDay, addDays, toUtcIso } from '../../../../src/lib/timeclock.js'
import { isActiveMember } from '../../../../src/lib/membership.js'
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
// Cash only: saves now → 201 { sale, emailError, warnings } (warnings: follow-ups that failed after it saved).
// With a card payment: charges the card on the register's reader first → 202 { cardCheckout }; the register
// then polls GET /api/staff/card-checkouts/:id, which returns the sale once Stripe confirms.
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
    .select('id, name, active, stripeReaderId')
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

  const card = built.payments.find(p => p.method === 'CARD_TERMINAL')
  if (card && !register.stripeReaderId) {
    return json({ error: 'This register has no card reader. An admin can pair one in Admin → Registers.' }, 409)
  }

  // Only managers can discount: a discounted sale must carry an unused DISCOUNT approval
  let approval = null
  if (built.lines.some(l => l.discountCents > 0)) {
    approval = await consumeApproval(supabase, body.approvalId, { action: 'DISCOUNT', cashierId: employee.id })
    if (!approval) {
      return json({ error: 'Discounts need a manager\'s approval, and it may have expired. Approve the discount again.', code: 'APPROVAL_REQUIRED' }, 403)
    }
  }

  // A walk-in/phone booking is created before the sale (re-checking space): paid right away for cash, held as
  // PENDING while a card is on the reader. It's removed again if the sale fails or the card is cancelled.
  let createdBookingId = null
  if (built.newBooking) {
    const created = await createBooking(supabase, built.newBooking, customer, card ? 'PENDING' : 'CONFIRMED')
    if (created.error) return json({ error: created.error }, created.status)
    createdBookingId = created.id
  }

  const prepared = {
    sale: {
      registerId: register.id,
      cashierId: employee.id,
      customerId: customer?.id ?? null,
      userId: dbUser.id,
      isMemberPricing: isMember,
      ...built.totals,
      changeCents: built.changeCents,
      receiptEmail,
    },
    items: built.lines.map(({ newBooking, ...line }) => (newBooking ? { ...line, bookingId: createdBookingId } : line)),
    payments: built.payments,
    customerId: customer?.id ?? null,
    membership,
    approvalId: approval?.id ?? null,
    receiptEmail,
    createdBookingId,
  }

  // Card (or split): charge the card on the reader first; the sale saves when Stripe confirms (202)
  if (card) {
    return startCardCheckout(supabase, env, {
      ...prepared,
      registerId: register.id,
      registerName: register.name,
      cashierId: employee.id,
      readerId: register.stripeReaderId,
      cardCents: card.amountCents,
    })
  }

  const saved = await saveSale(supabase, env, prepared)
  if (saved.error) {
    if (createdBookingId) await supabase.from('Booking').delete().eq('id', createdBookingId)
    return json({ error: saved.error }, 500)
  }
  return json(saved, 201)
}
