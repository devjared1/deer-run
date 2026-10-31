import { requireAdmin, json } from '../_auth.js'
import { TIME_OFF_SELECT, TIME_OFF_STATUSES, serializeTimeOff } from '../../staff/_timeoff.js'
import { isValidYmd } from '../../../../src/lib/timeclock.js'

// GET /api/admin/time-off?status=PENDING|APPROVED|DENIED|CANCELLED|all&from=&to=
// Requests (default: pending) with the employee, the reviewer's name, and the shifts the employee
// is scheduled for during each request. from/to keep requests that overlap that date range.
// Pending requests are listed soonest first; others newest first.
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') || 'PENDING').toUpperCase()
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (status !== 'ALL' && !TIME_OFF_STATUSES.includes(status)) return json({ error: 'Unknown status' }, 400)
  if ((from && !isValidYmd(from)) || (to && !isValidYmd(to))) return json({ error: 'from and to must be YYYY-MM-DD' }, 400)

  let query = supabase
    .from('TimeOffRequest')
    .select(`${TIME_OFF_SELECT}, employee:Employee(id, firstName, lastName, email, position, active)`)
    .order('startDate', { ascending: status === 'PENDING' })
    .limit(200)
  if (status !== 'ALL') query = query.eq('status', status)
  if (from) query = query.gte('endDate', from)
  if (to) query = query.lte('startDate', to)

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)
  const requests = (data || []).map(serializeTimeOff)

  // Shifts during the listed requests, in one query
  let shifts = []
  if (requests.length) {
    const minDate = requests.reduce((m, r) => (r.startDate < m ? r.startDate : m), requests[0].startDate)
    const maxDate = requests.reduce((m, r) => (r.endDate > m ? r.endDate : m), requests[0].endDate)
    const { data: shiftData, error: shiftError } = await supabase
      .from('Shift')
      .select('id, employeeId, date, startTime, endTime')
      .in('employeeId', [...new Set(requests.map(r => r.employeeId))])
      .gte('date', minDate)
      .lte('date', maxDate)
      .order('date', { ascending: true })
      .order('startTime', { ascending: true })
    if (shiftError) return json({ error: shiftError.message }, 500)
    shifts = shiftData || []
  }

  // Reviewer names
  const reviewerIds = [...new Set(requests.map(r => r.reviewedById).filter(Boolean))]
  const reviewers = new Map()
  if (reviewerIds.length) {
    const { data: users } = await supabase.from('User').select('id, name, email').in('id', reviewerIds)
    for (const u of users || []) reviewers.set(u.id, u.name || u.email)
  }

  return json(requests.map(r => ({
    ...r,
    reviewedByName: r.reviewedById ? reviewers.get(r.reviewedById) ?? null : null,
    scheduledShifts: shifts.filter(s => s.employeeId === r.employeeId && s.date >= r.startDate && s.date <= r.endDate),
  })))
}
