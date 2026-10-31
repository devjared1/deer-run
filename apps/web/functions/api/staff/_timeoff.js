import { Resend } from 'resend'
import { isValidYmd, daysBetween, localDate, toUtcIso, formatLocalDate } from '../../../src/lib/timeclock.js'

// Must match the TimeOffType enum in apps/api/prisma/schema.prisma
export const TIME_OFF_TYPES = ['VACATION', 'SICK', 'PERSONAL', 'UNPAID']
export const TIME_OFF_STATUSES = ['PENDING', 'APPROVED', 'DENIED', 'CANCELLED']
const TYPE_LABELS = { VACATION: 'Vacation', SICK: 'Sick', PERSONAL: 'Personal', UNPAID: 'Unpaid' }

// Longest single request, in days (inclusive)
export const MAX_REQUEST_DAYS = 60

export const TIME_OFF_SELECT =
  'id, employeeId, startDate, endDate, type, reason, status, reviewedById, reviewedAt, reviewNote, createdAt'

/** Normalizes timestamps and adds the number of days (inclusive). */
export function serializeTimeOff(r) {
  return {
    ...r,
    reviewedAt: toUtcIso(r.reviewedAt),
    createdAt: toUtcIso(r.createdAt),
    days: daysBetween(r.startDate, r.endDate) + 1,
  }
}

/**
 * Validates a new time off request: { startDate, endDate, type, reason? }.
 * Dates are course-local; requests can't start in the past.
 * Returns { data } or { error }.
 */
export function parseTimeOffRequest(body, today = localDate()) {
  const { startDate, endDate, type, reason } = body || {}
  if (!isValidYmd(startDate)) return { error: 'Start date must be a date (YYYY-MM-DD)' }
  if (!isValidYmd(endDate)) return { error: 'End date must be a date (YYYY-MM-DD)' }
  if (endDate < startDate) return { error: 'End date must be on or after the start date' }
  if (startDate < today) return { error: "Time off can't start in the past" }
  if (daysBetween(startDate, endDate) + 1 > MAX_REQUEST_DAYS) {
    return { error: `A request can be at most ${MAX_REQUEST_DAYS} days. Split longer time off into several requests` }
  }
  if (!TIME_OFF_TYPES.includes(type)) return { error: 'Choose a type of time off' }
  if (reason !== undefined && reason !== null && typeof reason !== 'string') return { error: 'Reason must be text' }
  const trimmed = reason?.trim() || null
  if (trimmed && trimmed.length > 500) return { error: 'Reason can be at most 500 characters' }
  return { data: { startDate, endDate, type, reason: trimmed } }
}

/** The employee's shifts dated within [from, to]. */
export async function shiftsDuring(supabase, employeeId, from, to) {
  const { data, error } = await supabase
    .from('Shift')
    .select('id, employeeId, date, startTime, endTime')
    .eq('employeeId', employeeId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('startTime', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

function dateRange(r) {
  const opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  return r.startDate === r.endDate
    ? formatLocalDate(r.startDate, opts)
    : `${formatLocalDate(r.startDate, opts)} – ${formatLocalDate(r.endDate, opts)}`
}

/**
 * Emails the employee that their request was approved or denied.
 * Returns an error message, or null on success (or when email isn't configured).
 */
export async function emailDecision(env, request, employee) {
  if (!env.RESEND_API_KEY || !employee?.email) return null
  const approved = request.status === 'APPROVED'
  const lines = [
    `Hi ${employee.firstName},`,
    '',
    `Your ${TYPE_LABELS[request.type]?.toLowerCase() ?? ''} time off request for ${dateRange(request)} was ${approved ? 'approved' : 'denied'}.`,
  ]
  if (request.reviewNote) lines.push('', `Note from your manager: ${request.reviewNote}`)
  lines.push('', 'You can see your requests and schedule in the staff portal: https://deerrun.golf/staff/time-off', '', 'Deer Run Golf Course')
  try {
    const resend = new Resend(env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'noreply@deerrun.golf',
      to: employee.email,
      subject: `Time off ${approved ? 'approved' : 'denied'}: ${dateRange(request)}`,
      text: lines.join('\n'),
    })
    return error ? error.message : null
  } catch (e) {
    return e.message
  }
}
