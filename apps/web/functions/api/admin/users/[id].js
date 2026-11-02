import { requireAdmin, json } from '../_auth.js'
import { isValidYmd, localDate, toUtcIso } from '../../../../src/lib/timeclock.js'
import { MEMBERSHIP_TIERS } from '../products/_validate.js'
import { accountBalance } from '../_houseAccounts.js'
import { fetchAll } from '../_db.js'
import { isExpiredHold } from '../../../../src/lib/teesheet.js'

const RECENT = 50

// GET /api/admin/users/:id — one customer in one place (Admin → Users → a person):
// → { user: { id, email, name, role, memberUntil, membershipTier, createdAt },
//     employee: { id, firstName, lastName, position, active } | null,
//     houseAccount: { id, status, balanceCents, creditLimitCents } | null,
//     bookings: [{ id, status, players, roundHoles, totalCents, holdFeeCents, balanceDueCents, source, checkedInAt,
//       createdAt, holdExpired, slot: { date, startTime } }]  (the latest RECENT, newest tee time first),
//     sales: [{ id, number, status, createdAt, totalCents, refundedCents, register: { name } }]  (the latest RECENT),
//     stats: { roundsPlayed, upcoming, registerNetCents, onlinePaidCents, salesCount } }
// roundsPlayed: paid tee times that have gone by; registerNetCents: sales minus refunds; onlinePaidCents: what was
// paid online for confirmed bookings (only the hold fee for pay at course). Counts cover all history, not just RECENT.
export async function onRequestGet({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data: user, error } = await supabase.from('User')
    .select('id, email, name, role, memberUntil, membershipTier, createdAt').eq('id', params.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!user) return json({ error: 'User not found' }, 404)

  const [bookings, sales, employee, account] = await Promise.all([
    supabase.from('Booking')
      .select('*, slot:TeeTimeSlot(date, startTime)')
      .eq('userId', user.id),
    // A regular can pass PostgREST's 1,000-row page
    fetchAll(() => supabase.from('Sale')
      .select('id, number, status, createdAt, totalCents, refundedCents, register:Register!Sale_registerId_fkey(name)')
      .eq('customerId', user.id)
      .order('createdAt', { ascending: false })
      .order('id'))
      .then(data => ({ data }), e => ({ error: e })),
    supabase.from('Employee').select('id, firstName, lastName, position, active').eq('userId', user.id).maybeSingle(),
    supabase.from('HouseAccount').select('id, status, creditLimitCents').eq('userId', user.id).maybeSingle(),
  ])
  const failed = [bookings, sales, employee, account].find(r => r.error)
  if (failed) return json({ error: failed.error.message }, 500)

  const today = localDate()
  const now = new Date()
  const allBookings = (bookings.data || [])
    .map(b => ({
      id: b.id, status: b.status, players: b.players, roundHoles: b.roundHoles ?? 18, totalCents: b.totalCents,
      holdFeeCents: b.holdFeeCents ?? null, balanceDueCents: b.balanceDueCents ?? 0, source: b.source ?? 'ONLINE',
      checkedInAt: toUtcIso(b.checkedInAt), createdAt: toUtcIso(b.createdAt), holdExpired: isExpiredHold(b, now),
      slot: b.slot ? { date: String(b.slot.date).slice(0, 10), startTime: b.slot.startTime } : null,
    }))
    .sort((a, b) => `${b.slot?.date} ${b.slot?.startTime}`.localeCompare(`${a.slot?.date} ${a.slot?.startTime}`))
  const confirmed = allBookings.filter(b => b.status === 'CONFIRMED')
  const allSales = sales.data || []

  let houseAccount = null
  if (account.data) {
    houseAccount = { ...account.data, balanceCents: await accountBalance(supabase, account.data.id) }
  }

  return json({
    user: { ...user, createdAt: toUtcIso(user.createdAt) },
    employee: employee.data ?? null,
    houseAccount,
    bookings: allBookings.slice(0, RECENT),
    sales: allSales.slice(0, RECENT).map(s => ({ ...s, createdAt: toUtcIso(s.createdAt) })),
    stats: {
      roundsPlayed: confirmed.filter(b => b.slot && b.slot.date < today).length,
      upcoming: confirmed.filter(b => b.slot && b.slot.date >= today).length,
      registerNetCents: allSales.reduce((sum, s) => sum + s.totalCents - (s.refundedCents ?? 0), 0),
      onlinePaidCents: confirmed.filter(b => b.source === 'ONLINE').reduce((sum, b) => sum + (b.holdFeeCents ?? b.totalCents), 0),
      salesCount: allSales.length,
    },
  })
}

// PUT /api/admin/users/:id — { role?, memberUntil?, membershipTier? }
// memberUntil is the last day of membership ("YYYY-MM-DD", or null for no expiry); a member whose date has
// passed drops to GUEST. Admins can't change their own role.
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser: adminUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const update = {}
  if (body.role !== undefined) {
    if (!['GUEST', 'MEMBER', 'ADMIN'].includes(body.role)) return json({ error: 'role must be GUEST, MEMBER, or ADMIN' }, 400)
    if (params.id === adminUser.id && body.role !== adminUser.role) return json({ error: 'Cannot change your own role' }, 400)
    update.role = body.role
  }
  if (body.memberUntil !== undefined) {
    if (body.memberUntil !== null && body.memberUntil !== '' && !isValidYmd(body.memberUntil)) {
      return json({ error: 'Member until must be a date (YYYY-MM-DD)' }, 400)
    }
    update.memberUntil = body.memberUntil || null
    update.renewalReminderKey = null // a new end date gets its own reminders
  }
  if (body.membershipTier !== undefined) {
    const tier = body.membershipTier || null
    if (tier && !MEMBERSHIP_TIERS.includes(tier)) return json({ error: `Tier must be one of ${MEMBERSHIP_TIERS.join(', ')}` }, 400)
    update.membershipTier = tier
  }
  if (!Object.keys(update).length) return json({ error: 'Nothing to update' }, 400)

  const { data, error } = await supabase
    .from('User')
    .update(update)
    .eq('id', params.id)
    .select('id, email, name, role, memberUntil, membershipTier')
    .maybeSingle()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'User not found' }, 404)

  return json(data)
}
