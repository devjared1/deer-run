import { requireAdmin, json } from './_auth.js'
import { toUtcIso } from '../../../src/lib/timeclock.js'

const PER_GROUP = 5

// GET /api/admin/search?q= — the admin search box (Ctrl+K): a few of each, best first.
// → { customers: [{ id, name, email, role }], sales: [{ id, number, totalCents, createdAt, customerName }],
//     bookings: [{ id, reference, name, userId, status, players, slot: { date, startTime } }],
//     employees: [{ id, firstName, lastName, position, active }] }
// Customers and employees match on name / email; sales on the receipt number ("1042" or "#1042"); bookings on the
// guest's name / email or the booking reference from the confirmation page (the first 8 characters of its id).
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  // PostgREST filter syntax uses , ( ) and * / % as wildcards: keep them out of the text
  const q = (new URL(request.url).searchParams.get('q') || '').replace(/[,()*%\\]/g, ' ').trim()
  if (q.length < 2) return json({ customers: [], sales: [], bookings: [], employees: [] })

  const like = `*${q}*`
  const receipt = /^#?\d{1,9}$/.test(q) ? Number(q.replace('#', '')) : null
  const reference = /^[0-9a-f]{6,8}$/i.test(q) ? q.toLowerCase() : null

  const empty = Promise.resolve({ data: [] })
  const [customers, sales, bookings, employees] = await Promise.all([
    supabase.from('User').select('id, name, email, role')
      .or(`name.ilike.${like},email.ilike.${like}`).order('name').limit(PER_GROUP),
    receipt === null ? empty : supabase.from('Sale')
      .select('id, number, totalCents, createdAt, customer:User(name, email)').eq('number', receipt).limit(1),
    supabase.from('Booking')
      .select('id, guestName, guestEmail, userId, status, players, slot:TeeTimeSlot(date, startTime), user:User(name, email)')
      .or([`guestName.ilike.${like}`, `guestEmail.ilike.${like}`, ...(reference ? [`id.ilike.${reference}*`] : [])].join(','))
      .order('createdAt', { ascending: false }).limit(PER_GROUP),
    supabase.from('Employee').select('id, firstName, lastName, position, active')
      .or(`firstName.ilike.${like},lastName.ilike.${like},email.ilike.${like}`).order('firstName').limit(PER_GROUP),
  ])
  const failed = [customers, sales, bookings, employees].find(r => r.error)
  if (failed) return json({ error: failed.error.message }, 500)

  return json({
    customers: customers.data,
    sales: sales.data.map(s => ({
      id: s.id, number: s.number, totalCents: s.totalCents, createdAt: toUtcIso(s.createdAt),
      customerName: s.customer?.name || s.customer?.email || null,
    })),
    bookings: bookings.data.map(b => ({
      id: b.id,
      reference: b.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
      name: b.user?.name || b.guestName || b.user?.email || b.guestEmail || 'Guest',
      userId: b.userId, status: b.status, players: b.players,
      slot: b.slot ? { date: String(b.slot.date).slice(0, 10), startTime: b.slot.startTime } : null,
    })),
    employees: employees.data,
  })
}
