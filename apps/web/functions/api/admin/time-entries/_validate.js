import { isValidYmd, isValidHhmm, localDateTimeToUtc, addDays } from '../../../../src/lib/timeclock.js'

const MAX_ENTRY_MINUTES = 24 * 60

/**
 * Converts a course-local "HH:MM" on `date` to a UTC Date that falls after `clockIn`.
 * A time earlier than clock-in means the next day (a shift that runs past midnight).
 */
function resolveTime(date, hhmm, clockIn, allowEqual) {
  const t = localDateTimeToUtc(date, hhmm)
  const tooEarly = allowEqual ? t < clockIn : t <= clockIn
  return tooEarly ? localDateTimeToUtc(addDays(date, 1), hhmm) : t
}

/**
 * Validates a manager's time entry correction.
 * Body: { date: 'YYYY-MM-DD', clockIn: 'HH:MM', clockOut: 'HH:MM' | null,
 *         breaks: [{ start: 'HH:MM', end: 'HH:MM' | null }], note }
 * Times are course-local; clockOut empty/null means the employee is still on the clock.
 * Returns { entry, breaks } with UTC ISO timestamps, or { error }.
 */
export function parseEntryInput(body, now = new Date()) {
  const { date, clockIn, clockOut, breaks = [], note } = body || {}

  if (!isValidYmd(date)) return { error: 'date must be YYYY-MM-DD' }
  if (!isValidHhmm(clockIn)) return { error: 'Clock in must be a time (HH:MM)' }
  const inAt = localDateTimeToUtc(date, clockIn)
  if (inAt > now) return { error: "Clock in can't be in the future" }

  let outAt = null
  if (clockOut) {
    if (!isValidHhmm(clockOut)) return { error: 'Clock out must be a time (HH:MM)' }
    outAt = resolveTime(date, clockOut, inAt, false)
    if (outAt > now) return { error: "Clock out can't be in the future" }
  }
  const end = outAt ?? now
  if ((end - inAt) / 60000 > MAX_ENTRY_MINUTES) return { error: "An entry can't be longer than 24 hours" }

  if (!Array.isArray(breaks)) return { error: 'breaks must be a list' }
  const parsed = []
  for (const [i, b] of breaks.entries()) {
    const label = `Break ${i + 1}`
    if (!isValidHhmm(b?.start)) return { error: `${label}: start must be a time (HH:MM)` }
    const startedAt = resolveTime(date, b.start, inAt, true)
    let endedAt = null
    if (b.end) {
      if (!isValidHhmm(b.end)) return { error: `${label}: end must be a time (HH:MM)` }
      endedAt = resolveTime(date, b.end, inAt, true)
      if (endedAt <= startedAt) return { error: `${label} ends before it starts` }
    } else if (outAt) {
      return { error: `${label} needs an end time because the employee clocked out` }
    }
    if ((endedAt ?? now) > end || startedAt > end) return { error: `${label} must be within the shift` }
    parsed.push({ startedAt, endedAt })
  }

  parsed.sort((a, b) => a.startedAt - b.startedAt)
  for (let i = 0; i < parsed.length; i++) {
    const b = parsed[i]
    if (!b.endedAt && i !== parsed.length - 1) return { error: 'Only the latest break can still be in progress' }
    const next = parsed[i + 1]
    if (next && b.endedAt > next.startedAt) return { error: 'Breaks overlap' }
  }

  return {
    entry: {
      clockIn: inAt.toISOString(),
      clockOut: outAt ? outAt.toISOString() : null,
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
    },
    breaks: parsed.map(b => ({ startedAt: b.startedAt.toISOString(), endedAt: b.endedAt?.toISOString() ?? null })),
  }
}

/** Returns an error message if the entry would overlap another of the employee's entries. */
export async function findOverlap(supabase, employeeId, entry, excludeId = null) {
  // Open entries (no clock out) extend to now
  const end = entry.clockOut ?? new Date().toISOString()
  let query = supabase
    .from('TimeEntry')
    .select('id, clockIn, clockOut')
    .eq('employeeId', employeeId)
    .lt('clockIn', end)
    .or(`clockOut.is.null,clockOut.gt."${entry.clockIn}"`)
    .limit(1)
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error) return error.message
  if (data?.length) {
    return data[0].clockOut
      ? 'This overlaps another time entry for this employee'
      : 'This employee already has an open entry (still on the clock) that overlaps this time'
  }
  return null
}

/** Replaces all breaks on an entry. */
export async function replaceBreaks(supabase, timeEntryId, breaks) {
  const { error: delError } = await supabase.from('TimeBreak').delete().eq('timeEntryId', timeEntryId)
  if (delError) return delError.message
  if (!breaks.length) return null
  const { error } = await supabase
    .from('TimeBreak')
    .insert(breaks.map(b => ({ id: crypto.randomUUID(), timeEntryId, ...b })))
  return error?.message ?? null
}

/** Maps the one-open-entry unique index violation to a readable message. */
export function writeErrorMessage(error) {
  if (error?.code === '23505') return 'This employee already has an open entry (still on the clock)'
  return error?.message
}
