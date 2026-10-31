import { isValidYmd, isValidHhmm, daysBetween, dayOfWeek, localDate } from '../../../../src/lib/timeclock.js'
import { MAX_RANGE_DAYS, SCHEDULE_VIEWS, schedulePeriod } from '../../../../src/lib/schedule.js'
import { POSITIONS } from '../employees/_validate.js'
import { loadPayPeriod } from '../../staff/_timesheet.js'

export const SHIFT_COLUMNS = 'id, employeeId, date, startTime, endTime, position, notes, createdAt'

export const TIME_OFF_COLUMNS = 'id, employeeId, startDate, endDate, type, status'

/** Validates ?from=&to= (inclusive course-local dates). Returns { from, to } or { error }. */
export function parseRange(searchParams) {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!isValidYmd(from) || !isValidYmd(to)) return { error: 'from and to must be YYYY-MM-DD' }
  const days = daysBetween(from, to)
  if (days < 0) return { error: 'to must be on or after from' }
  if (days >= MAX_RANGE_DAYS) return { error: `The range can be at most ${MAX_RANGE_DAYS} days` }
  return { from, to }
}

/**
 * The date range for a schedule request, either explicit (?from=&to=) or a period of a view
 * (?view=week|biweek|month&date=, default today). Weeks start on the pay period anchor's weekday.
 * Returns { from, to, period, weekStartDay } (period is null for explicit ranges) or { error }.
 * For month views, from/to cover the whole calendar grid (padded to full weeks).
 */
export async function resolveScheduleRange(searchParams, supabase) {
  const payPeriod = await loadPayPeriod(supabase)
  const weekStartDay = dayOfWeek(payPeriod.anchor)
  const view = searchParams.get('view')
  if (!view) {
    const range = parseRange(searchParams)
    return range.error ? range : { ...range, period: null, weekStartDay }
  }
  if (!SCHEDULE_VIEWS[view]) return { error: 'view must be week, biweek or month' }
  const date = searchParams.get('date') || localDate()
  if (!isValidYmd(date)) return { error: 'date must be YYYY-MM-DD' }
  const period = schedulePeriod(view, date, { weekStartDay, anchor: payPeriod.anchor })
  return { from: period.gridStart, to: period.gridEnd, period, weekStartDay }
}

/**
 * Validates a shift payload. With partial = true (updates), only fields present are checked.
 * Returns { data } or { error }.
 */
export function parseShift(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' }
  const data = {}
  const has = key => body[key] !== undefined

  if (!partial || has('employeeId')) {
    if (typeof body.employeeId !== 'string' || !body.employeeId) return { error: 'Choose an employee' }
    data.employeeId = body.employeeId
  }
  if (!partial || has('date')) {
    if (!isValidYmd(body.date)) return { error: 'date must be YYYY-MM-DD' }
    data.date = body.date
  }
  for (const [key, label] of [['startTime', 'Start'], ['endTime', 'End']]) {
    if (!partial || has(key)) {
      if (!isValidHhmm(body[key])) return { error: `${label} must be a time (HH:MM)` }
      data[key] = body[key]
    }
  }
  if (data.startTime && data.startTime === data.endTime) return { error: "A shift can't start and end at the same time" }
  if (has('position')) {
    if (body.position !== null && body.position !== '' && !POSITIONS.includes(body.position)) {
      return { error: 'Unknown position' }
    }
    data.position = body.position || null
  }
  if (has('notes')) {
    if (body.notes !== null && typeof body.notes !== 'string') return { error: 'notes must be text' }
    const notes = body.notes?.trim()
    if (notes && notes.length > 500) return { error: 'Notes can be at most 500 characters' }
    data.notes = notes || null
  }
  return { data }
}

/** Fetches shifts dated within [from, to], optionally for one employee. */
export async function fetchShifts(supabase, from, to, employeeId = null) {
  let query = supabase
    .from('Shift')
    .select(SHIFT_COLUMNS)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('startTime', { ascending: true })
  if (employeeId) query = query.eq('employeeId', employeeId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

/** Time off requests (approved and pending) that overlap [from, to], optionally for one employee. */
export async function fetchTimeOff(supabase, from, to, { employeeId = null, statuses = ['APPROVED', 'PENDING'] } = {}) {
  let query = supabase
    .from('TimeOffRequest')
    .select(TIME_OFF_COLUMNS)
    .lte('startDate', to)
    .gte('endDate', from)
    .in('status', statuses)
    .order('startDate', { ascending: true })
  if (employeeId) query = query.eq('employeeId', employeeId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}
