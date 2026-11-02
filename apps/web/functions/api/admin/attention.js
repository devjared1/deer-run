import { requireAdmin, json } from './_auth.js'
import { fetchAll } from './_db.js'
import { ENTRY_SELECT, serializeEntry } from '../staff/_timesheet.js'
import { addDays, localDate, localDateTimeToUtc, toUtcIso } from '../../../src/lib/timeclock.js'

// A card charge whose sale still isn't saved after this long needs a person (the register and webhook retry first)
const STUCK_CARD_MINUTES = 10
// Someone scheduled this long ago who hasn't clocked in
const MISSED_CLOCK_IN_MINUTES = 10

// GET /api/admin/attention — the dashboard's "Needs attention" list: things a manager has to act on. Each check runs
// on its own, so one failing doesn't hide the rest.
// → { items: [{ key, count, ...details }], errors: [{ key, error }] }, only the checks with something to do:
//   cardNotSaved      { count, checkouts: [{ id, amountCents, registerName, lastError, createdAt }] }
//   timeOff           { count, firstStart }  (pending requests; the soonest start date)
//   missedClockOut    { count, names }       (open punches older than LONG_OPEN_ENTRY_MINUTES)
//   missedClockIn     { count, people: [{ name, startTime }] }  (shift started 10+ minutes ago, not clocked in today)
//   shiftSwaps        { count }              (shifts a coworker picked up, waiting for approval)
//   drawersLeftOpen   { count, registers }   (open drawer sessions from before today)
//   statementsPastDue { count, totalCents }  (OPEN / AUTOPAY_FAILED statements past their due date)
//   teeTimeGaps       { count, dates }       (days in the member booking window with no tee time slots)
//   outOfStock        { count, names }       (active tracked products with an active variant at 0 or below)
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const today = localDate()
  const now = new Date()
  const startOfToday = localDateTimeToUtc(today, '00:00').toISOString()

  const checks = {
    async cardNotSaved() {
      const before = new Date(now.getTime() - STUCK_CARD_MINUTES * 60000).toISOString()
      const { data, error } = await supabase.from('CardCheckout')
        .select('id, amountCents, lastError, createdAt, register:Register(name)')
        .eq('status', 'SUCCEEDED')
        .lt('updatedAt', before)
        .order('createdAt', { ascending: true })
        .limit(20)
      if (error) throw new Error(error.message)
      return data.length && {
        count: data.length,
        checkouts: data.map(c => ({
          id: c.id, amountCents: c.amountCents, registerName: c.register?.name ?? null, lastError: c.lastError,
          createdAt: toUtcIso(c.createdAt),
        })),
      }
    },

    async timeOff() {
      const { data, count, error } = await supabase.from('TimeOffRequest')
        .select('startDate', { count: 'exact' })
        .eq('status', 'PENDING')
        .order('startDate', { ascending: true })
        .limit(1)
      if (error) throw new Error(error.message)
      return count && { count, firstStart: data[0]?.startDate ?? null }
    },

    async missedClockOut() {
      const { data, error } = await supabase.from('TimeEntry')
        .select(`${ENTRY_SELECT}, employee:Employee(firstName, lastName)`)
        .is('clockOut', null)
        .order('clockIn', { ascending: true })
      if (error) throw new Error(error.message)
      const stale = data.filter(raw => serializeEntry(raw, now).longOpen)
      return stale.length && {
        count: stale.length,
        names: stale.map(e => [e.employee?.firstName, e.employee?.lastName].filter(Boolean).join(' ')),
      }
    },

    // Scheduled to have started MISSED_CLOCK_IN_MINUTES ago (and not ended), but not clocked in today
    async missedClockIn() {
      const nowMs = now.getTime()
      const [{ data: shifts, error }, { data: punches, error: punchError }] = await Promise.all([
        supabase.from('Shift').select('employeeId, startTime, endTime, employee:Employee(firstName, lastName, active)').eq('date', today),
        supabase.from('TimeEntry').select('employeeId').or(`clockIn.gte."${startOfToday}",clockOut.is.null`),
      ])
      if (error || punchError) throw new Error((error || punchError).message)
      const clocked = new Set((punches || []).map(p => p.employeeId))
      const missed = new Map()
      for (const s of shifts || []) {
        if (!s.employee?.active || clocked.has(s.employeeId)) continue
        const start = localDateTimeToUtc(today, s.startTime).getTime()
        // End ≤ start: an overnight shift that ends tomorrow
        const end = s.endTime > s.startTime ? localDateTimeToUtc(today, s.endTime).getTime() : start + 24 * 3600_000
        if (nowMs >= start + MISSED_CLOCK_IN_MINUTES * 60_000 && nowMs < end) {
          missed.set(s.employeeId, { name: `${s.employee.firstName} ${s.employee.lastName}`.trim(), startTime: s.startTime })
        }
      }
      const list = [...missed.values()]
      return list.length && { count: list.length, people: list }
    },

    // Shift swaps a coworker picked up, waiting for a manager
    async shiftSwaps() {
      const { data, error } = await supabase.from('ShiftOffer').select('id, shift:Shift(date, startTime)').eq('status', 'CLAIMED')
      if (error) return error.code === '42P01' ? 0 : Promise.reject(new Error(error.message))
      const upcoming = (data || []).filter(o => o.shift && localDateTimeToUtc(String(o.shift.date).slice(0, 10), o.shift.startTime) > now)
      return upcoming.length && { count: upcoming.length }
    },

    async drawersLeftOpen() {
      const { data, error } = await supabase.from('CashDrawerSession')
        .select('id, openedAt, register:Register(name)')
        .is('closedAt', null)
        .lt('openedAt', startOfToday)
      if (error) throw new Error(error.message)
      return data.length && { count: data.length, registers: data.map(s => s.register?.name).filter(Boolean) }
    },

    async statementsPastDue() {
      const rows = await fetchAll(() => supabase.from('Statement')
        .select('id, closingCents')
        .in('status', ['OPEN', 'AUTOPAY_FAILED'])
        .lt('dueDate', today)
        .gt('closingCents', 0)
        .order('id'))
      return rows.length && { count: rows.length, totalCents: rows.reduce((s, r) => s + r.closingCents, 0) }
    },

    async teeTimeGaps() {
      const { data: settings, error } = await supabase.from('CourseSettings')
        .select('publicBookingDays, memberBookingDays').eq('id', 'singleton').maybeSingle()
      if (error) throw new Error(error.message)
      const days = Math.max(settings?.memberBookingDays ?? 14, settings?.publicBookingDays ?? 7)
      const last = addDays(today, days - 1)
      const slots = await fetchAll(() => supabase.from('TeeTimeSlot')
        .select('id, date').gte('date', today).lte('date', last).order('id'))
      const withSlots = new Set(slots.map(s => s.date))
      const dates = []
      for (let d = today; d <= last; d = addDays(d, 1)) if (!withSlots.has(d)) dates.push(d)
      return dates.length && { count: dates.length, dates }
    },

    async outOfStock() {
      const products = await fetchAll(() => supabase.from('Product')
        .select('id, name, category:ProductCategory!inner(active), variants:ProductVariant(stockQty, active)')
        .eq('active', true)
        .eq('trackInventory', true)
        .eq('category.active', true)
        .order('id'))
      const out = products.filter(p => p.variants.some(v => v.active && v.stockQty <= 0))
      return out.length && { count: out.length, names: out.map(p => p.name).sort((a, b) => a.localeCompare(b)) }
    },
  }

  const keys = Object.keys(checks)
  const settled = await Promise.allSettled(keys.map(k => checks[k]()))
  const items = []
  const errors = []
  settled.forEach((r, i) => {
    if (r.status === 'rejected') errors.push({ key: keys[i], error: r.reason?.message || 'Check failed' })
    else if (r.value) items.push({ key: keys[i], ...r.value })
  })
  return json({ items, errors })
}
