import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { isValidYmd, localDate, toUtcIso } from '../../../../src/lib/timeclock.js'
import { isActiveMember } from '../../../../src/lib/membership.js'
import { holdsSpot, isExpiredHold } from '../../../../src/lib/teesheet.js'
import { releaseInBackground, slotsWithExpiredHolds } from '../../bookings/_holds.js'

export const TEESHEET_BOOKING_COLUMNS = 'id, players, status, source, guestName, guestEmail, checkedInAt, createdAt, totalCents, stripePaymentId'

// GET /api/staff/teesheet?date=YYYY-MM-DD (default today, course time)
// The day's tee times with their bookings, for the pro shop. Each booking has the golfer, how it was
// booked (ONLINE / POS / PHONE), whether it's paid (CONFIRMED), check-in time, and the receipts it was
// rung up on. Cancelled and refunded bookings are included (the page shows them faded) but don't
// count toward a slot's booked players; nor do unpaid online bookings past their 30-minute hold
// (`holdExpired`), which are released in the background. Each booking has `holdsSpot`.
export async function onRequestGet(context) {
  const { request, env } = context
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const date = new URL(request.url).searchParams.get('date') || localDate()
  if (!isValidYmd(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400)

  const { data, error } = await supabase
    .from('TeeTimeSlot')
    .select('id, date, startTime, maxPlayers, memberOnly, ' +
      `bookings:Booking(${TEESHEET_BOOKING_COLUMNS}, ` +
      'user:User(id, name, email, role, memberUntil, membershipTier), saleItems:SaleItem(sale:Sale!SaleItem_saleId_fkey(id, number)))')
    .eq('date', date)
    .order('startTime', { ascending: true })
  if (error) return json({ error: error.message }, 500)

  releaseInBackground(context, supabase, slotsWithExpiredHolds(data))

  const today = localDate()
  const slots = (data || []).map(slot => {
    const bookings = (slot.bookings || [])
      .map(b => serializeBooking(b, today))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const bookedPlayers = bookings.filter(b => b.holdsSpot).reduce((sum, b) => sum + b.players, 0)
    return { ...slot, bookings, bookedPlayers, available: Math.max(0, slot.maxPlayers - bookedPlayers) }
  })

  return json({ date, today, slots })
}

export function serializeBooking({ saleItems, user, stripePaymentId, ...b }, today) {
  const receipts = [...new Map((saleItems || []).filter(i => i.sale).map(i => [i.sale.id, i.sale])).values()]
  const now = new Date()
  return {
    ...b,
    holdsSpot: holdsSpot({ ...b, stripePaymentId }, now),
    holdExpired: isExpiredHold({ ...b, stripePaymentId }, now),
    checkedInAt: toUtcIso(b.checkedInAt),
    createdAt: toUtcIso(b.createdAt),
    name: user ? (user.name || user.email) : (b.guestName || 'Guest'),
    email: user?.email ?? b.guestEmail ?? null,
    // membershipTier: the register's member Pro Shop discount rate
    customer: user
      ? { id: user.id, name: user.name, email: user.email, role: user.role, membershipTier: user.membershipTier ?? null, isMember: isActiveMember(user, today) }
      : null,
    receipts: receipts.sort((x, y) => x.number - y.number),
  }
}
