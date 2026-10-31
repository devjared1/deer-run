// Time clock math and course-local date helpers.
// Shared by the Vue app and the Pages Functions (imported there by relative path),
// so this file must not use '@/' imports or browser-only APIs.

export const COURSE_TZ = 'America/Chicago'

// Fallback when CourseSettings hasn't loaded: bi-weekly periods starting Sunday 2026-01-04.
// The real values live in CourseSettings.payPeriodDays / payPeriodAnchor (admin Settings page).
export const DEFAULT_PAY_PERIOD = { anchor: '2026-01-04', lengthDays: 14 }

// FLSA overtime: hours over 40 in a workweek
export const OVERTIME_THRESHOLD_MINUTES = 40 * 60

// An entry still open after this long is flagged as a probable missed clock-out
export const LONG_OPEN_ENTRY_MINUTES = 14 * 60

/**
 * TIMESTAMP(3) columns are stored in UTC but come back from PostgREST without a zone
 * ("2026-10-30T14:05:00"), which browsers would parse as local time. Mark them as UTC.
 */
export function toUtcIso(ts) {
  if (!ts) return null
  return /(Z|[+-]\d{2}:?\d{2})$/i.test(ts) ? ts : `${ts}Z`
}

function minutesBetween(start, end) {
  return Math.max(0, (new Date(end) - new Date(start)) / 60000)
}

/** Total break minutes in a time entry; an open break counts up to `now`. */
export function breakMinutes(entry, now = new Date()) {
  return (entry.breaks || []).reduce(
    (sum, b) => sum + minutesBetween(toUtcIso(b.startedAt), b.endedAt ? toUtcIso(b.endedAt) : now),
    0,
  )
}

/** Worked minutes = (clockOut, or now if still on the clock) − clockIn − breaks. */
export function workedMinutes(entry, now = new Date()) {
  const end = entry.clockOut ? toUtcIso(entry.clockOut) : now
  return Math.max(0, minutesBetween(toUtcIso(entry.clockIn), end) - breakMinutes(entry, now))
}

/** Splits a week's worked minutes into regular and overtime. */
export function splitOvertime(minutes) {
  const regular = Math.min(minutes, OVERTIME_THRESHOLD_MINUTES)
  return { regular, overtime: minutes - regular }
}

/** True when an entry has been open longer than LONG_OPEN_ENTRY_MINUTES. */
export function isLongOpen(entry, now = new Date()) {
  return !entry.clockOut && (new Date(now) - new Date(toUtcIso(entry.clockIn))) / 60000 > LONG_OPEN_ENTRY_MINUTES
}

// ─── Course-local dates (YYYY-MM-DD strings) ────────────────────────────────

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: COURSE_TZ,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

function zonedParts(date) {
  const parts = {}
  for (const { type, value } of partsFormatter.formatToParts(date)) parts[type] = value
  return parts
}

// Offset of the course time zone from UTC at an instant, in ms (negative for Central time)
function zoneOffsetMs(date) {
  const p = zonedParts(date)
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** The course-local calendar date of an instant, e.g. "2026-10-30". */
export function localDate(instant = new Date()) {
  const p = zonedParts(new Date(instant))
  return `${p.year}-${p.month}-${p.day}`
}

/** The UTC instant of local midnight at the start of a course-local date. */
export function startOfLocalDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const utcMidnight = Date.UTC(y, m - 1, d)
  // Apply the offset, then re-check it at the result in case a DST change is near midnight
  let ts = utcMidnight - zoneOffsetMs(new Date(utcMidnight))
  ts = utcMidnight - zoneOffsetMs(new Date(ts))
  return new Date(ts)
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function isValidYmd(ymd) {
  return typeof ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ymd) && addDays(ymd, 0) === ymd
}

export function isValidHhmm(hhmm) {
  return typeof hhmm === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)
}

/** Day of the week of a date, 0 = Sunday. */
export function dayOfWeek(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Whole days from date a to date b (negative if b is earlier). */
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

/** First day of the workweek containing a date. */
export function weekStart(ymd, weekStartDay = 0) {
  return addDays(ymd, -((dayOfWeek(ymd) - weekStartDay + 7) % 7))
}

/**
 * The pay period containing a date: { start, end } (inclusive), counted in blocks of
 * lengthDays from anchor. The workweek starts on the anchor's weekday.
 */
export function payPeriodContaining(ymd, { anchor, lengthDays } = DEFAULT_PAY_PERIOD) {
  const offset = ((daysBetween(anchor, ymd) % lengthDays) + lengthDays) % lengthDays
  const start = addDays(ymd, -offset)
  return { start, end: addDays(start, lengthDays - 1) }
}

/** The UTC instant of a course-local date and "HH:MM" time. */
export function localDateTimeToUtc(ymd, hhmm) {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  const asUtc = Date.UTC(y, m - 1, d, h, min)
  // Same two-pass offset correction as startOfLocalDay
  let ts = asUtc - zoneOffsetMs(new Date(asUtc))
  ts = asUtc - zoneOffsetMs(new Date(ts))
  return new Date(ts)
}

/** Timestamp → course-local "HH:MM" (24-hour), for time inputs. */
export function localTime(ts) {
  const p = zonedParts(new Date(toUtcIso(ts)))
  return `${p.hour}:${p.minute}`
}

// ─── Display ────────────────────────────────────────────────────────────────

/** 455.4 → "7h 35m" */
export function formatMinutes(minutes) {
  const total = Math.floor(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** Timestamp → "8:05 AM" in course time. */
export function formatClockTime(ts) {
  return new Date(toUtcIso(ts)).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
  })
}

/** "2026-10-30" → "Fri, Oct 30" (no time zone shift). */
export function formatLocalDate(ymd, options = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}
