import { unitPriceCents, priceLine, saleTotals, variantDescription } from '../../../../src/lib/pricing.js'
import { teeTimeLabel } from '../../../../src/lib/teesheet.js'

// Tenders the register accepts
export const ACCEPTED_METHODS = ['CASH', 'CARD_TERMINAL', 'HOUSE_ACCOUNT']

const MAX_LINES = 100
const MAX_QUANTITY = 999
const MAX_CUSTOM_CENTS = 1_000_000 // $10,000

const isWholeNumber = (n, min, max) => Number.isInteger(n) && n >= min && n <= max

export const BOOKING_SOURCES = ['POS', 'PHONE']
const MAX_BOOKING_NAME = 80

/**
 * Prices a sale on the server from the request and the current catalog. Pure: no database access.
 *   items:          [{ variantId, quantity, discountCents }
 *                   | { custom: { description, priceCents }, quantity, discountCents }
 *                   | { booking: { bookingId } }                         prepaid greens fee for a checked-in booking ($0)
 *                   | { newBooking: { teeTimeSlotId, players, name, source: 'POS' | 'PHONE' } }   walk-in/phone ($0 line;
 *                     the greens fees are rung up as normal products on the same sale)]
 *   variantsById:   variant rows with product and category embedded
 *   bookingsById:   existing bookings for `booking` lines: { id, status, source, players, slot: { date, startTime } }
 *   slotsById:      tee time slots for `newBooking` lines: { id, date, startTime, maxPlayers, memberOnly, bookedPlayers }
 *   hasCustomer:    a customer account is attached (a walk-in without one needs a name)
 *   today:          course-local date (no bookings in the past)
 *   isMember:       member pricing applies
 *   taxBps:         course sales tax rate
 *   payments:       [{ method: 'CASH', tenderedCents } | { method: 'CARD_TERMINAL', amountCents }]
 *                   or [{ method: 'HOUSE_ACCOUNT' }] alone (the whole sale goes on the member's account)
 *                   A card pays an exact amount (at most one card per sale); cash covers the rest and is the
 *                   only tender that can be over-tendered (the difference is change)
 *   expectedTotalCents: the total the register showed; must match so the customer pays what they saw
 * Returns { lines, totals, payments, changeCents, newBooking } or { error, status }. Lines for tee times carry
 * `bookingId` (existing booking) or `newBooking: true`; `newBooking` is the validated booking to create.
 */
export function buildSale({
  items, variantsById, isMember, taxBps, payments, expectedTotalCents,
  bookingsById = {}, slotsById = {}, hasCustomer = false, today = null,
}) {
  if (!Array.isArray(items) || !items.length) return { error: 'The cart is empty', status: 400 }
  if (items.length > MAX_LINES) return { error: `A sale can have at most ${MAX_LINES} lines`, status: 400 }

  const lines = []
  let newBooking = null
  for (const [i, item] of items.entries()) {
    const label = `Line ${i + 1}`

    // Tee time lines are always one $0 line with no discount
    if (item.booking || item.newBooking) {
      const built = item.booking
        ? bookingLine(item.booking, bookingsById, label)
        : newBookingLine(item.newBooking, { slotsById, isMember, hasCustomer, today, label })
      if (built.error) return built
      if (built.newBooking) {
        if (newBooking) return { error: 'Book one tee time per sale', status: 400 }
        newBooking = built.newBooking
      }
      lines.push(built.line)
      continue
    }

    const quantity = Number(item.quantity)
    if (!isWholeNumber(quantity, 1, MAX_QUANTITY)) return { error: `${label}: quantity must be 1–${MAX_QUANTITY}`, status: 400 }

    let line
    if (item.custom) {
      const description = String(item.custom.description ?? '').trim().slice(0, 100)
      const price = Number(item.custom.priceCents)
      if (!description) return { error: `${label}: a custom item needs a description`, status: 400 }
      if (!isWholeNumber(price, 1, MAX_CUSTOM_CENTS)) return { error: `${label}: custom price must be $0.01–$10,000`, status: 400 }
      line = { variantId: null, trackInventory: false, description, categoryName: null, unitPriceCents: price, taxRateBps: taxBps }
    } else {
      const variant = variantsById[item.variantId]
      if (!variant || !variant.active || !variant.product?.active || !variant.product.category?.active) {
        return { error: `${label}: this item is no longer for sale. Remove it and try again.`, status: 409 }
      }
      const { product } = variant
      line = {
        variantId: variant.id,
        trackInventory: product.trackInventory,
        description: variantDescription(product.name, variant),
        categoryName: product.category.name,
        unitPriceCents: unitPriceCents(product, variant, isMember),
        taxRateBps: product.category.taxExempt ? 0 : taxBps,
      }
    }

    const discountCents = Number(item.discountCents ?? 0)
    if (!isWholeNumber(discountCents, 0, line.unitPriceCents * quantity)) {
      return { error: `${label}: discount can't be more than the line amount`, status: 400 }
    }

    lines.push({ ...line, quantity, discountCents, ...priceLine({ ...line, quantity, discountCents }) })
  }

  const totals = saleTotals(lines)
  if (expectedTotalCents !== undefined && Number(expectedTotalCents) !== totals.totalCents) {
    return { error: 'Prices changed since this cart was started. Review the total and try again.', status: 409, totals }
  }

  // Apply tenders in order; only cash can be over-tendered (the difference is change)
  if (totals.totalCents === 0) return { lines, totals, payments: [], changeCents: 0, newBooking }
  if (!Array.isArray(payments) || !payments.length) return { error: 'Add a payment', status: 400 }

  for (const p of payments) {
    if (!ACCEPTED_METHODS.includes(p?.method)) return { error: `${p?.method} payments aren't available yet`, status: 400 }
  }
  // House account: the whole sale goes on the account, on its own (the account and its limit are checked by the
  // API and again inside create_sale)
  if (payments.some(p => p.method === 'HOUSE_ACCOUNT')) {
    if (payments.length > 1) return { error: 'Charge the whole sale to the account, or pay another way', status: 400 }
    return { lines, totals, payments: [{ method: 'HOUSE_ACCOUNT', amountCents: totals.totalCents, tenderedCents: null }], changeCents: 0, newBooking }
  }

  const cards = payments.filter(p => p.method === 'CARD_TERMINAL')
  const cash = payments.filter(p => p.method === 'CASH')
  if (cards.length > 1) return { error: 'Use one card per sale', status: 400 }
  if (cash.length > 1) return { error: 'Enter the cash received as one amount', status: 400 }

  const applied = []
  let remaining = totals.totalCents
  if (cards.length) {
    const amount = Number(cards[0].amountCents)
    if (!isWholeNumber(amount, 50, totals.totalCents)) {
      // Stripe's minimum card charge is $0.50
      return { error: 'The card amount must be at least $0.50 and no more than the total', status: 400 }
    }
    applied.push({ method: 'CARD_TERMINAL', amountCents: amount, tenderedCents: null })
    remaining -= amount
  }

  let changeCents = 0
  if (cash.length) {
    const tendered = Number(cash[0].tenderedCents)
    if (!isWholeNumber(tendered, 1, 10_000_000)) return { error: 'Payment amount is not valid', status: 400 }
    if (remaining === 0) return { error: 'More payments than needed', status: 400 }
    if (tendered < remaining) return { error: 'The payment is less than the total', status: 400 }
    applied.unshift({ method: 'CASH', amountCents: remaining, tenderedCents: tendered })
    changeCents = tendered - remaining
    remaining = 0
  }
  if (remaining > 0) return { error: 'The payment is less than the total', status: 400 }

  return { lines, totals, payments: applied, changeCents, newBooking }
}

function zeroLine(fields) {
  const line = { variantId: null, trackInventory: false, unitPriceCents: 0, taxRateBps: 0, quantity: 1, discountCents: 0, ...fields }
  return { ...line, ...priceLine(line) }
}

// A booking that's already paid (online, or earlier at the register), checked in so add-ons go on one ticket
function bookingLine({ bookingId }, bookingsById, label) {
  const booking = bookingsById[bookingId]
  if (!booking) return { error: `${label}: booking not found`, status: 400 }
  if (booking.status !== 'CONFIRMED') return { error: `${label}: this booking isn't paid (${booking.status.toLowerCase()})`, status: 409 }
  const paidWhere = booking.source === 'ONLINE' ? 'paid online' : 'paid'
  const players = `${booking.players} player${booking.players === 1 ? '' : 's'}`
  return {
    line: zeroLine({
      description: `Greens fee ${paidWhere} — ${teeTimeLabel(booking.slot.date, booking.slot.startTime)}, ${players}`,
      categoryName: 'Greens Fees',
      bookingId: booking.id,
    }),
  }
}

// A walk-in or phone booking made at the register: validated here, created when the sale completes
function newBookingLine(nb, { slotsById, isMember, hasCustomer, today, label }) {
  const slot = slotsById[nb?.teeTimeSlotId]
  if (!slot) return { error: `${label}: that tee time doesn't exist`, status: 400 }
  if (today && slot.date < today) return { error: `${label}: that tee time is in the past`, status: 400 }
  if (slot.memberOnly && !isMember) return { error: `${label}: that tee time is for members. Attach a member to the sale.`, status: 409 }
  if (!BOOKING_SOURCES.includes(nb.source)) return { error: `${label}: choose walk-in or phone booking`, status: 400 }
  const available = Math.max(0, slot.maxPlayers - slot.bookedPlayers)
  const players = Number(nb.players)
  if (!isWholeNumber(players, 1, slot.maxPlayers)) return { error: `${label}: players must be 1–${slot.maxPlayers}`, status: 400 }
  if (players > available) {
    return { error: `${label}: only ${available} spot${available === 1 ? '' : 's'} left at that time`, status: 409 }
  }
  const name = String(nb.name ?? '').trim().slice(0, MAX_BOOKING_NAME)
  if (!name && !hasCustomer) return { error: `${label}: enter the golfer's name or attach a customer`, status: 400 }

  const how = nb.source === 'PHONE' ? 'phone booking' : 'walk-in'
  return {
    line: zeroLine({
      description: `Tee time ${teeTimeLabel(slot.date, slot.startTime)} — ${players} player${players === 1 ? '' : 's'} (${how})`,
      categoryName: 'Tee Times',
      newBooking: true,
    }),
    newBooking: { teeTimeSlotId: slot.id, players, name: name || null, source: nb.source },
  }
}
