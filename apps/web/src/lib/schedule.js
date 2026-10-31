// Schedule math shared by the Vue app and the Pages Functions (imported there by relative path),
// so this file must not use '@/' imports or browser-only APIs.
//
// Shifts are stored as a course-local DATE plus "HH:MM" start/end strings (same as TeeTimeSlot).
// An end time at or before the start time means the shift runs past midnight into the next day.

import { addDays, daysBetween, weekStart, isValidYmd } from './timeclock.js'

export const SCHEDULE_VIEWS = {
  week:   { label: 'Week',    days: 7 },
  biweek: { label: '2 Weeks', days: 14 },
  month:  { label: 'Month',   days: null },
}

// Longest range the shift APIs return at once (a month view padded to whole weeks fits)
export const MAX_RANGE_DAYS = 62

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Length of a shift in minutes (overnight shifts wrap past midnight). */
export function shiftMinutes(shift) {
  const start = toMinutes(shift.startTime)
  let end = toMinutes(shift.endTime)
  if (end <= start) end += 24 * 60
  return end - start
}

/** [start, end) of a shift in minutes since midnight of `baseDate`. */
function shiftInterval(shift, baseDate) {
  const start = daysBetween(baseDate, shift.date) * 24 * 60 + toMinutes(shift.startTime)
  return [start, start + shiftMinutes(shift)]
}

/** True if two shifts (of the same employee) overlap in time. */
export function shiftsOverlap(a, b) {
  const base = a.date < b.date ? a.date : b.date
  const [as, ae] = shiftInterval(a, base)
  const [bs, be] = shiftInterval(b, base)
  return as < be && bs < ae
}

/** True if a date falls within a time off request's [startDate, endDate]. */
export function timeOffCovers(request, date) {
  return request.startDate <= date && date <= request.endDate
}

/**
 * Warnings for each shift, keyed by shift id: overlaps with the same employee's other shifts,
 * shifts on approved time off (or a pending request), and shifts for inactive employees.
 * `employees` and `timeOff` only need to include the employees and dates involved.
 */
export function scheduleWarnings(shifts, employees, timeOff = []) {
  const employeeById = new Map(employees.map(e => [e.id, e]))
  const byEmployee = new Map()
  for (const s of shifts) {
    if (!byEmployee.has(s.employeeId)) byEmployee.set(s.employeeId, [])
    byEmployee.get(s.employeeId).push(s)
  }

  const warnings = {}
  const add = (id, message) => { (warnings[id] ||= []).push(message) }

  for (const [employeeId, list] of byEmployee) {
    const employee = employeeById.get(employeeId)
    const requests = timeOff.filter(r => r.employeeId === employeeId)

    for (const s of list) {
      if (employee && !employee.active) add(s.id, 'Employee is inactive')
      const off = requests.find(r => timeOffCovers(r, s.date))
      if (off?.status === 'APPROVED') add(s.id, 'Employee has approved time off this day')
      else if (off?.status === 'PENDING') add(s.id, 'Employee has a pending time off request this day')
    }

    // Overlaps: compare each pair once; only neighbors within a day can overlap
    const sorted = [...list].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (daysBetween(sorted[i].date, sorted[j].date) > 1) break
        if (shiftsOverlap(sorted[i], sorted[j])) {
          add(sorted[i].id, 'Overlaps another shift')
          add(sorted[j].id, 'Overlaps another shift')
        }
      }
    }
  }

  for (const id of Object.keys(warnings)) warnings[id] = [...new Set(warnings[id])]
  return warnings
}

function firstOfMonth(ymd) {
  return `${ymd.slice(0, 7)}-01`
}

function addMonths(ymd, n) {
  const [y, m] = ymd.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 10)
}

/**
 * The schedule period of a view ('week' | 'biweek' | 'month') containing `date`:
 * { view, start, end, prevStart, nextStart, gridStart, gridEnd }.
 * Weeks start on `weekStartDay` (0 = Sunday). For two-week views, periods are counted in
 * blocks of 14 days from `anchor` (the pay period anchor, so schedules line up with pay periods).
 * gridStart/gridEnd pad a month out to whole weeks for a calendar layout.
 */
export function schedulePeriod(view, date, { weekStartDay = 0, anchor = null } = {}) {
  if (view === 'month') {
    const start = firstOfMonth(date)
    const end = addDays(addMonths(start, 1), -1)
    return {
      view, start, end,
      prevStart: addMonths(start, -1),
      nextStart: addMonths(start, 1),
      gridStart: weekStart(start, weekStartDay),
      gridEnd: addDays(weekStart(end, weekStartDay), 6),
    }
  }

  const length = view === 'biweek' ? 14 : 7
  let start = weekStart(date, weekStartDay)
  if (length === 14) {
    const base = anchor && isValidYmd(anchor) ? weekStart(anchor, weekStartDay) : start
    const offset = ((daysBetween(base, start) % 14) + 14) % 14
    start = addDays(start, -offset)
  }
  const end = addDays(start, length - 1)
  return { view, start, end, prevStart: addDays(start, -length), nextStart: addDays(end, 1), gridStart: start, gridEnd: end }
}

/** Every date from `from` to `to`, inclusive. */
export function datesBetween(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** "07:00" → "7a", "13:30" → "1:30p" (compact, for grids). */
export function shortTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const hour = h % 12 || 12
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`
}

/** "07:00" → "7:00 AM". */
export function longTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
