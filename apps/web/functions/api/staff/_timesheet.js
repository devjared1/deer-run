import {
  DEFAULT_PAY_PERIOD, toUtcIso, workedMinutes, breakMinutes, splitOvertime, isLongOpen,
  localDate, startOfLocalDay, addDays, weekStart, dayOfWeek, payPeriodContaining,
} from '../../../src/lib/timeclock.js'

// TimeEntry with its breaks, for supabase .select()
export const ENTRY_SELECT = 'id, employeeId, clockIn, clockOut, note, editedById, editedAt, breaks:TimeBreak(id, startedAt, endedAt)'

/** Normalizes timestamps to UTC ISO strings, sorts breaks, and adds computed minutes and flags. */
export function serializeEntry(entry, now = new Date()) {
  const breaks = (entry.breaks || [])
    .map(b => ({ ...b, startedAt: toUtcIso(b.startedAt), endedAt: toUtcIso(b.endedAt) }))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const normalized = {
    ...entry,
    clockIn: toUtcIso(entry.clockIn),
    clockOut: toUtcIso(entry.clockOut),
    editedAt: toUtcIso(entry.editedAt),
    breaks,
  }
  return {
    ...normalized,
    date: localDate(normalized.clockIn),
    breakMinutes: breakMinutes(normalized, now),
    workedMinutes: workedMinutes(normalized, now),
    longOpen: isLongOpen(normalized, now),
  }
}

/** Pay period settings from CourseSettings, falling back to the default. */
export async function loadPayPeriod(supabase) {
  const { data } = await supabase
    .from('CourseSettings')
    .select('payPeriodDays, payPeriodAnchor')
    .eq('id', 'singleton')
    .maybeSingle()
  if (!data?.payPeriodAnchor || !data?.payPeriodDays) return DEFAULT_PAY_PERIOD
  return { anchor: data.payPeriodAnchor, lengthDays: data.payPeriodDays }
}

/**
 * Resolves the pay period containing `date` (default: today, course time), plus the start
 * dates of the previous and next periods for navigation.
 */
export function resolvePeriod(date, payPeriod) {
  const period = payPeriodContaining(date || localDate(), payPeriod)
  return {
    ...period,
    lengthDays: payPeriod.lengthDays,
    weekStartDay: dayOfWeek(payPeriod.anchor),
    prevStart: addDays(period.start, -payPeriod.lengthDays),
    nextStart: addDays(period.end, 1),
  }
}

/** Fetches entries clocked in during [from, to] (course-local dates), optionally for one employee. */
export async function fetchEntries(supabase, from, to, employeeId = null) {
  let query = supabase
    .from('TimeEntry')
    .select(ENTRY_SELECT)
    .gte('clockIn', startOfLocalDay(from).toISOString())
    .lt('clockIn', startOfLocalDay(addDays(to, 1)).toISOString())
    .order('clockIn', { ascending: true })
  if (employeeId) query = query.eq('employeeId', employeeId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Groups serialized entries into days and workweeks with regular/overtime totals.
 * Entries count toward the day they were clocked in.
 */
export function buildTimesheet(entries, from, to, weekStartDay) {
  const days = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dayEntries = entries.filter(e => e.date === d)
    days.push({
      date: d,
      entries: dayEntries,
      workedMinutes: dayEntries.reduce((sum, e) => sum + e.workedMinutes, 0),
    })
  }

  // Overtime is per workweek; a week cut off by the range only includes the days in range
  const weekMinutes = {}
  for (const day of days) {
    const ws = weekStart(day.date, weekStartDay)
    weekMinutes[ws] = (weekMinutes[ws] || 0) + day.workedMinutes
  }
  const weeks = Object.entries(weekMinutes).map(([start, minutes]) => ({
    weekStart: start,
    workedMinutes: minutes,
    ...splitOvertime(minutes),
  }))

  return {
    days,
    weeks,
    workedMinutes: weeks.reduce((sum, w) => sum + w.workedMinutes, 0),
    regular: weeks.reduce((sum, w) => sum + w.regular, 0),
    overtime: weeks.reduce((sum, w) => sum + w.overtime, 0),
    openEntries: entries.filter(e => !e.clockOut).length,
    longOpenEntries: entries.filter(e => e.longOpen).length,
  }
}
