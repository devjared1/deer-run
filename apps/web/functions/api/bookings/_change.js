import { makeStripe, stripeMessage } from '../staff/_stripe.js'
import { loadRates } from '../_rates.js'
import { bookingPrice } from '../../../src/lib/rates.js'
import { bookedPlayers, HOLD_COLUMNS } from '../../../src/lib/teesheet.js'
import { isActiveMember } from '../../../src/lib/membership.js'
import { addDays, localDate, localDateTimeToUtc, toUtcIso } from '../../../src/lib/timeclock.js'
import { formatCents } from '../../../src/lib/money.js'
import { sendBookingEmail, slotWhen } from './_email.js'
import { notifyWaitlist } from './_waitlist.js'
import { manageBookingUrl, siteOrigin } from '../_links.js'

// Golfers changing their own online booking (My Account): another tee time and/or a different number of players.
// The difference is worked out at today's rates (new price − old price, both now) and added to what the booking cost,
// so a rate change since booking doesn't count against the golfer. Then:
//   paid in full online  → more: the golfer pays the difference online first (PaymentIntent, metadata.bookingChangeId),
//                          and the change is applied when it succeeds (the page or the webhook, whichever is first);
//                          less: the change is applied and the difference refunded to the card
//   pay at course        → no money moves online: the difference goes on (or comes off) the balance due at the register
// Every change is a BookingChange row (audit, and the claim that keeps the page and the webhook from applying it twice).

export const CHANGE_CUTOFF_HOURS = 24 // same as cancelling
const MIN_CHARGE_CENTS = 50 // Stripe's smallest card charge; a smaller difference is waived

export const CHANGE_BOOKING_SELECT =
  '*, user:User(id, email, role, memberUntil), slot:TeeTimeSlot(id, date, startTime, maxPlayers, memberOnly)'

const fail = (status, error, code) => ({ status, error, code })

/** Why the golfer can't change this booking online (a message), or null. Doesn't check register sales (async). */
export function changeBlocker(booking, now = new Date()) {
  if (booking.status !== 'CONFIRMED') {
    return booking.status === 'PENDING' ? 'Finish paying for this booking first.' : `This booking is ${booking.status.toLowerCase()}.`
  }
  if (booking.source && booking.source !== 'ONLINE') return 'This tee time was booked at the pro shop. Call us to change it.'
  if (booking.checkedInAt) return 'This group has already checked in.'
  const teeAt = localDateTimeToUtc(String(booking.slot.date).slice(0, 10), booking.slot.startTime)
  if (teeAt.getTime() - now.getTime() <= CHANGE_CUTOFF_HOURS * 3600_000) {
    return `Changes can be made up to ${CHANGE_CUTOFF_HOURS} hours before the tee time. Call the pro shop instead.`
  }
  return null
}

/**
 * Works out a change without making it. → a quote
 *   { slot, players, fromTotalCents, toTotalCents, differenceCents, chargeCents, refundCents, balanceDueCents,
 *     balanceChangeCents, payAtCourse }
 * or { status, error, code? } when it can't be made.
 */
export async function quoteChange(supabase, booking, { teeTimeSlotId, players }, now = new Date()) {
  const blocked = changeBlocker(booking, now)
  if (blocked) return fail(409, blocked, 'NOT_CHANGEABLE')
  const playerCount = Number(players)
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 4) return fail(400, 'players must be 1–4')
  if (typeof teeTimeSlotId !== 'string' || !teeTimeSlotId) return fail(400, 'teeTimeSlotId is required')
  if (teeTimeSlotId === booking.slot.id && playerCount === booking.players) return fail(400, 'Nothing changed')

  const { data: sold, error: saleError } = await supabase.from('SaleItem').select('id').eq('bookingId', booking.id).limit(1)
  if (saleError) return fail(500, saleError.message)
  if (sold.length) return fail(409, 'This tee time has been paid at the pro shop. Call us to change it.', 'NOT_CHANGEABLE')

  const [{ data: slot, error: slotError }, { data: settings, error: settingsError }, rateInfo] = await Promise.all([
    supabase.from('TeeTimeSlot').select(`id, date, startTime, maxPlayers, memberOnly, bookings:Booking(id, ${HOLD_COLUMNS})`)
      .eq('id', teeTimeSlotId).maybeSingle(),
    supabase.from('CourseSettings').select('publicBookingDays, memberBookingDays').eq('id', 'singleton').maybeSingle(),
    loadRates(supabase),
  ])
  if (slotError || settingsError) return fail(500, (slotError || settingsError).message)
  if (!slot) return fail(404, 'That tee time doesn\'t exist')

  const today = localDate(now)
  const ymd = String(slot.date).slice(0, 10)
  if (localDateTimeToUtc(ymd, slot.startTime) <= now) return fail(409, 'That tee time has already gone by.')
  const member = booking.user?.role === 'ADMIN' || isActiveMember(booking.user, today)
  if (slot.memberOnly && !member) return fail(409, 'That tee time is for members only.')
  const windowDays = member ? (settings?.memberBookingDays ?? 14) : (settings?.publicBookingDays ?? 7)
  if (ymd > addDays(today, windowDays)) return fail(409, `Tee times can be booked up to ${windowDays} days ahead.`)

  const others = (slot.bookings || []).filter(b => b.id !== booking.id)
  const room = Math.max(0, slot.maxPlayers - bookedPlayers(others, now))
  if (room < playerCount) {
    return fail(409, room ? `Only ${room} spot${room === 1 ? '' : 's'} left at that time.` : 'That tee time is full.', 'NO_ROOM')
  }

  // The difference at today's rates, on top of what the booking cost
  const { rates, holidayDates } = rateInfo
  const price = (date, count) => bookingPrice({
    rates, holidayDates, ymd: date, holes: booking.roundHoles ?? 18, players: count, cart: !!booking.cartIncluded,
  }).totalCents
  let difference = price(ymd, playerCount) - price(String(booking.slot.date).slice(0, 10), booking.players)
  if (difference > 0 && difference < MIN_CHARGE_CENTS && booking.holdFeeCents == null) difference = 0
  const toTotal = Math.max(0, booking.totalCents + difference)
  difference = toTotal - booking.totalCents

  const payAtCourse = booking.holdFeeCents != null
  const balanceDue = payAtCourse ? Math.max(0, booking.balanceDueCents + difference) : 0
  const { bookings: _, ...slotData } = slot
  return {
    slot: { ...slotData, date: ymd },
    players: playerCount,
    fromTotalCents: booking.totalCents,
    toTotalCents: toTotal,
    differenceCents: difference,
    chargeCents: !payAtCourse && difference > 0 ? difference : 0,
    refundCents: !payAtCourse && difference < 0 ? -difference : 0,
    balanceDueCents: balanceDue,
    balanceChangeCents: payAtCourse ? balanceDue - booking.balanceDueCents : 0,
    payAtCourse,
  }
}

/** Inserts the BookingChange for a quote. → the row, or throws. */
export async function recordChange(supabase, booking, quote, { userId, status }) {
  const row = {
    id: crypto.randomUUID(),
    bookingId: booking.id,
    userId: userId ?? null,
    fromSlotId: booking.slot.id,
    toSlotId: quote.slot.id,
    fromPlayers: booking.players,
    toPlayers: quote.players,
    fromTotalCents: quote.fromTotalCents,
    toTotalCents: quote.toTotalCents,
    chargeCents: quote.chargeCents,
    refundCents: quote.refundCents,
    balanceChangeCents: quote.balanceChangeCents,
    status,
  }
  const { data, error } = await supabase.from('BookingChange').insert(row).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Applies a BookingChange: claims it (status in `fromStatuses` → APPLYING), checks the booking is still as it was and
 * the new time still has room, moves the booking, refunds a lower price to the card, marks it APPLIED and emails the
 * golfer. If it can't be applied it's FAILED, a difference already paid is refunded, and the golfer is emailed.
 * → { change, applied: boolean, warning? }. Someone else already handling it → { change, applied: false, busy: true }.
 */
export async function applyChange(supabase, env, changeId, { fromStatuses = ['PENDING_PAYMENT'] } = {}) {
  const { data: claimed, error: claimError } = await supabase.from('BookingChange').update({ status: 'APPLYING' })
    .eq('id', changeId).in('status', fromStatuses).select('*')
  if (claimError) throw new Error(claimError.message)
  if (!claimed?.length) {
    const { data: current } = await supabase.from('BookingChange').select('*').eq('id', changeId).maybeSingle()
    return { change: current, applied: current?.status === 'APPLIED', busy: true }
  }
  const change = claimed[0]

  const { data: booking, error } = await supabase.from('Booking').select(CHANGE_BOOKING_SELECT).eq('id', change.bookingId).maybeSingle()
  if (error) throw new Error(error.message)
  const { data: slot, error: slotError } = await supabase.from('TeeTimeSlot')
    .select(`id, date, startTime, maxPlayers, bookings:Booking(id, ${HOLD_COLUMNS})`).eq('id', change.toSlotId).maybeSingle()
  if (slotError) throw new Error(slotError.message)

  const now = new Date()
  let reason = null
  if (!booking || booking.status !== 'CONFIRMED') reason = 'the booking is no longer active'
  else if (booking.slot.id !== change.fromSlotId || booking.players !== change.fromPlayers) reason = 'the booking changed in the meantime'
  else if (booking.checkedInAt) reason = 'the group has checked in'
  else if (!slot) reason = 'the new tee time no longer exists'
  else if (localDateTimeToUtc(String(slot.date).slice(0, 10), slot.startTime) <= now) reason = 'the new tee time has gone by'
  else {
    const others = (slot.bookings || []).filter(b => b.id !== booking.id)
    if (slot.maxPlayers - bookedPlayers(others, now) < change.toPlayers) reason = 'the new tee time filled up'
  }
  if (reason) return failChange(supabase, env, change, booking, slot, reason)

  const update = { teeTimeSlotId: change.toSlotId, players: change.toPlayers, totalCents: change.toTotalCents }
  if (booking.holdFeeCents != null) update.balanceDueCents = Math.max(0, booking.balanceDueCents + change.balanceChangeCents)
  const { data: moved, error: moveError } = await supabase.from('Booking').update(update)
    .eq('id', booking.id).eq('status', 'CONFIRMED').eq('teeTimeSlotId', change.fromSlotId).eq('players', change.fromPlayers)
    .is('checkedInAt', null).select('id')
  if (moveError) throw new Error(moveError.message)
  if (!moved?.length) return failChange(supabase, env, change, booking, slot, 'the booking changed in the meantime')

  // A lower price goes back to the card. The booking has already moved, so a refund that fails is flagged to the pro
  // shop to do by hand rather than undoing the move.
  let refunded = 0
  let warning = null
  if (change.refundCents > 0) {
    try {
      refunded = await refundToCard(supabase, env, booking, change.refundCents, `booking-change-${change.id}`)
      if (refunded < change.refundCents) throw new Error(`only ${formatCents(refunded)} of the payment was left to refund`)
    } catch (e) {
      warning = `Your tee time changed, but the ${formatCents(change.refundCents - refunded)} refund didn't go through. ` +
        'The pro shop has been told and will refund it.'
      await sendBookingEmail(env, env.CONTACT_EMAIL_TO, 'Booking change refund needs attention', [
        `A golfer changed their tee time online and is owed a ${formatCents(change.refundCents)} refund, but only ` +
          `${formatCents(refunded)} could be refunded automatically: ${stripeMessage(e)}.`,
        '',
        `Booking: ${booking.id}`,
        `Golfer: ${golferName(booking)} (${golferEmail(booking) ?? 'no email'})`,
        `Now: ${slotWhen(slot)}, ${change.toPlayers} player${change.toPlayers === 1 ? '' : 's'}`,
        '',
        'Refund the rest in the Stripe dashboard.',
      ])
    }
  }

  const { data: done, error: doneError } = await supabase.from('BookingChange')
    .update({ status: 'APPLIED', appliedAt: now.toISOString(), refundCents: refunded, failureReason: warning })
    .eq('id', change.id).select('*').single()
  if (doneError) throw new Error(doneError.message)

  const money = []
  if (change.chargeCents) money.push(`Paid for the change: ${formatCents(change.chargeCents)}`)
  if (refunded) money.push(`Refunded to your card: ${formatCents(refunded)} (it can take 5–10 business days to appear)`)
  if (booking.holdFeeCents != null) money.push(`Due at the course: ${formatCents(update.balanceDueCents)}, at the pro shop when you check in`)
  await sendBookingEmail(env, golferEmail(booking), 'Tee Time Changed — Deer Run Golf Course', [
    'Your tee time at Deer Run Golf Course has been changed.',
    '',
    `New time: ${slotWhen(slot)}`,
    `Players: ${change.toPlayers}`,
    `Was: ${slotWhen(booking.slot)}, ${change.fromPlayers} player${change.fromPlayers === 1 ? '' : 's'}`,
    ...(money.length ? ['', ...money] : []),
    ...(warning ? ['', warning] : []),
    '',
    `Change or cancel (up to 24 hours before): ${await manageBookingUrl(env, siteOrigin(env), booking.id)}`,
  ])

  // Spots freed at the old time (moved away, or fewer players): tell that day's waitlist
  if (change.fromSlotId !== change.toSlotId || change.toPlayers < change.fromPlayers) {
    await notifyWaitlist(supabase, env, String(booking.slot.date).slice(0, 10))
      .catch(e => console.error('Waitlist after a booking change:', e.message))
  }
  return { change: done, applied: true, warning }
}

async function failChange(supabase, env, change, booking, slot, reason) {
  let refunded = 0
  let refundError = null
  if (change.chargeCents > 0 && change.stripePaymentIntentId) {
    try {
      const stripe = makeStripe(env)
      if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set')
      await stripe.refunds.create({ payment_intent: change.stripePaymentIntentId }, { idempotencyKey: `booking-change-failed-${change.id}` })
      refunded = change.chargeCents
    } catch (e) {
      if (e?.code === 'charge_already_refunded') refunded = change.chargeCents
      else refundError = stripeMessage(e)
    }
  }
  const failureReason = refundError ? `${reason}; refund failed: ${refundError}` : reason
  const { data: failed, error } = await supabase.from('BookingChange')
    .update({ status: 'FAILED', failureReason, refundCents: refunded }).eq('id', change.id).select('*').single()
  if (error) throw new Error(error.message)

  if (booking) {
    const when = slot ? slotWhen(slot) : 'the new time'
    await sendBookingEmail(env, golferEmail(booking), 'Tee Time Change Not Made — Deer Run Golf Course', [
      `We couldn't change your tee time to ${when}: ${reason}.`,
      `Your booking is unchanged: ${slotWhen(booking.slot)}, ${booking.players} player${booking.players === 1 ? '' : 's'}.`,
      ...(refunded ? ['', `We've refunded the ${formatCents(refunded)} you paid for the change. It can take 5–10 business days to appear.`] : []),
      ...(refundError ? ['', `The ${formatCents(change.chargeCents)} you paid for the change will be refunded by the pro shop.`] : []),
    ])
    if (refundError) {
      await sendBookingEmail(env, env.CONTACT_EMAIL_TO, 'Booking change refund needs attention', [
        `A tee time change couldn't be made (${reason}) and the ${formatCents(change.chargeCents)} the golfer paid for it ` +
          `couldn't be refunded automatically: ${refundError}.`,
        '',
        `Booking: ${booking.id}`,
        `Golfer: ${golferName(booking)} (${golferEmail(booking) ?? 'no email'})`,
        `Stripe payment: ${change.stripePaymentIntentId}`,
      ])
    }
  }
  return { change: failed, applied: false, reason }
}

/**
 * Refunds `amountCents` of a booking's online payments to the card: the latest change payments first, then the
 * original booking payment, each up to what's left of it in Stripe. → cents refunded.
 */
async function refundToCard(supabase, env, booking, amountCents, idempotencyBase) {
  const stripe = makeStripe(env)
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not set')
  const { data: paidChanges, error } = await supabase.from('BookingChange').select('stripePaymentIntentId')
    .eq('bookingId', booking.id).eq('status', 'APPLIED').gt('chargeCents', 0).not('stripePaymentIntentId', 'is', null)
    .order('createdAt', { ascending: false })
  if (error) throw new Error(error.message)
  const intents = [...(paidChanges || []).map(c => c.stripePaymentIntentId), booking.stripePaymentId].filter(Boolean)

  let refunded = 0
  for (const id of intents) {
    const need = amountCents - refunded
    if (need <= 0) break
    const intent = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] })
    if (intent.status !== 'succeeded') continue
    const left = (intent.amount_received ?? 0) - (intent.latest_charge?.amount_refunded ?? 0)
    const take = Math.min(left, need)
    if (take <= 0) continue
    await stripe.refunds.create({ payment_intent: id, amount: take }, { idempotencyKey: `${idempotencyBase}-${id}` })
    refunded += take
  }
  return refunded
}

function golferEmail(booking) {
  return booking.user?.email ?? booking.guestEmail ?? null
}

function golferName(booking) {
  return booking.guestName || booking.user?.email || 'unknown'
}

/** The change as the page sees it. */
export function serializeChange(c) {
  if (!c) return null
  return {
    id: c.id, status: c.status, toSlotId: c.toSlotId, toPlayers: c.toPlayers, toTotalCents: c.toTotalCents,
    chargeCents: c.chargeCents, refundCents: c.refundCents, balanceChangeCents: c.balanceChangeCents,
    failureReason: c.failureReason, appliedAt: toUtcIso(c.appliedAt),
  }
}
