import { Resend } from 'resend'
import { requireAdmin, json } from '../_auth.js'
import { fetchAll } from '../_db.js'
import { parseRange, fetchTimeOff, SHIFT_COLUMNS } from './_validate.js'
import { formatLocalDate, formatMinutes } from '../../../../src/lib/timeclock.js'
import { shiftMinutes, longTime } from '../../../../src/lib/schedule.js'
import { positionLabel } from '../../../../src/data/employeePositions.js'

// Resend's default limit is 2 requests per second
const SEND_INTERVAL_MS = 600

// POST /api/admin/shifts/email — { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } (the period shown, inclusive)
// Emails each active employee with shifts in the range (and an email address) their own shifts, plus their
// approved time off in the range. One failed email doesn't stop the rest.
// → { sent, skippedNoEmail, skippedInactive, failed: [{ employeeId, name, error }] }
// 503 { code: 'EMAIL_NOT_CONFIGURED' } when RESEND_API_KEY isn't set.
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const range = parseRange(new URLSearchParams({ from: body?.from ?? '', to: body?.to ?? '' }))
  if (range.error) return json({ error: range.error }, 400)

  if (!env.RESEND_API_KEY) {
    return json({ error: "Email isn't configured (RESEND_API_KEY isn't set), so no schedules were sent", code: 'EMAIL_NOT_CONFIGURED' }, 503)
  }

  let shifts, employees, timeOff
  try {
    shifts = await fetchAll(() => supabase
      .from('Shift')
      .select(SHIFT_COLUMNS)
      .gte('date', range.from)
      .lte('date', range.to)
      .order('date', { ascending: true })
      .order('startTime', { ascending: true })
      .order('id', { ascending: true }))
    const ids = [...new Set(shifts.map(s => s.employeeId))]
    if (!ids.length) return json({ sent: 0, skippedNoEmail: 0, skippedInactive: 0, failed: [] })

    const [employeesRes, approved] = await Promise.all([
      supabase.from('Employee').select('id, firstName, lastName, email, position, active').in('id', ids),
      fetchTimeOff(supabase, range.from, range.to, { statuses: ['APPROVED'] }),
    ])
    if (employeesRes.error) throw new Error(employeesRes.error.message)
    employees = employeesRes.data || []
    timeOff = approved
  } catch (e) {
    return json({ error: e.message }, 500)
  }

  const resend = new Resend(env.RESEND_API_KEY)
  const period = periodLabel(range.from, range.to)
  const out = { sent: 0, skippedNoEmail: 0, skippedInactive: 0, failed: [] }

  for (const employee of employees.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))) {
    if (!employee.active) { out.skippedInactive++; continue }
    if (!employee.email) { out.skippedNoEmail++; continue }

    const text = scheduleText(
      employee,
      period,
      shifts.filter(s => s.employeeId === employee.id),
      timeOff.filter(r => r.employeeId === employee.id),
      range,
    )
    if (out.sent || out.failed.length) await new Promise(resolve => setTimeout(resolve, SEND_INTERVAL_MS))
    try {
      const { error } = await resend.emails.send({
        from: 'noreply@deerrun.golf',
        to: employee.email,
        subject: `Your Deer Run schedule: ${period}`,
        text,
      })
      if (error) throw new Error(error.message)
      out.sent++
    } catch (e) {
      out.failed.push({ employeeId: employee.id, name: `${employee.firstName} ${employee.lastName}`, error: e.message })
    }
  }

  return json(out)
}

/** "Sun, Nov 2 – Sat, Nov 8, 2026" or "Sun, Nov 2, 2026". */
function periodLabel(from, to) {
  const opts = { weekday: 'short', month: 'short', day: 'numeric' }
  const withYear = { ...opts, year: 'numeric' }
  return from === to
    ? formatLocalDate(from, withYear)
    : `${formatLocalDate(from, opts)} – ${formatLocalDate(to, withYear)}`
}

function scheduleText(employee, period, shifts, timeOff, range) {
  const lines = [`Hi ${employee.firstName},`, '', `Here's your schedule for ${period}:`, '']
  for (const s of shifts) {
    const overnight = s.endTime <= s.startTime ? ' (ends the next day)' : ''
    let line = `${formatLocalDate(s.date)}: ${longTime(s.startTime)} – ${longTime(s.endTime)}${overnight}`
    if (s.position && s.position !== employee.position) line += `, working as ${positionLabel(s.position)}`
    if (s.notes) line += ` (${s.notes})`
    lines.push(line)
  }
  const total = shifts.reduce((sum, s) => sum + shiftMinutes(s), 0)
  lines.push('', `${shifts.length} shift${shifts.length === 1 ? '' : 's'}, ${formatMinutes(total)} scheduled`)

  if (timeOff.length) {
    lines.push('', 'Approved time off:')
    for (const r of timeOff) {
      // Only the part inside this period
      const start = r.startDate < range.from ? range.from : r.startDate
      const end = r.endDate > range.to ? range.to : r.endDate
      lines.push(start === end ? formatLocalDate(start) : `${formatLocalDate(start)} – ${formatLocalDate(end)}`)
    }
  }

  lines.push(
    '',
    'Schedules can change. The latest is always in the staff portal: https://deerrun.golf/staff/schedule',
    '',
    'Deer Run Golf Course',
  )
  return lines.join('\n')
}
