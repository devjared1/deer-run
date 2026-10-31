import { requireAdmin, json } from './_auth.js'
import { serializeEntry, loadPayPeriod, resolvePeriod, fetchEntries, buildTimesheet } from '../staff/_timesheet.js'
import { isValidYmd, formatClockTime } from '../../../src/lib/timeclock.js'
import { positionLabel } from '../../../src/data/employeePositions.js'
import { dollars, toCsv, csvResponse } from './_csv.js'

// GET /api/admin/timesheets?date=YYYY-MM-DD[&format=csv&detail=summary|entries]
// Every employee's timesheet for the pay period containing `date` (default: today).
// Inactive employees are included only if they have time in the period.
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (date && !isValidYmd(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400)

  try {
    const period = resolvePeriod(date, await loadPayPeriod(supabase))
    const [{ data: employees, error }, rawEntries] = await Promise.all([
      supabase
        .from('Employee')
        .select('id, firstName, lastName, email, position, hourlyRateCents, active')
        .order('lastName', { ascending: true })
        .order('firstName', { ascending: true }),
      fetchEntries(supabase, period.start, period.end),
    ])
    if (error) throw new Error(error.message)

    const now = new Date()
    const byEmployee = {}
    for (const raw of rawEntries) {
      (byEmployee[raw.employeeId] ||= []).push(serializeEntry(raw, now))
    }

    const rows = (employees || [])
      .filter(emp => emp.active || byEmployee[emp.id]?.length)
      .map(emp => ({
        ...emp,
        ...buildTimesheet(byEmployee[emp.id] || [], period.start, period.end, period.weekStartDay),
      }))

    if (searchParams.get('format') === 'csv') {
      return searchParams.get('detail') === 'entries'
        ? csvResponse(entriesCsv(rows), `timesheet-entries-${period.start}-to-${period.end}.csv`)
        : csvResponse(summaryCsv(rows), `timesheet-summary-${period.start}-to-${period.end}.csv`)
    }

    const sum = (field) => rows.reduce((total, r) => total + r[field], 0)
    return json({
      period,
      employees: rows,
      totals: {
        workedMinutes: sum('workedMinutes'),
        regular: sum('regular'),
        overtime: sum('overtime'),
        openEntries: sum('openEntries'),
        longOpenEntries: sum('longOpenEntries'),
      },
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// ─── CSV ────────────────────────────────────────────────────────────────────

const hours = (minutes) => (minutes / 60).toFixed(2)

// One row per employee: hours and an estimated gross (overtime at 1.5×)
function summaryCsv(rows) {
  return toCsv(
    ['Employee', 'Email', 'Position', 'Regular Hours', 'Overtime Hours', 'Total Hours', 'Hourly Rate', 'Estimated Gross', 'Open Entries'],
    rows.map(r => {
      const rate = r.hourlyRateCents
      const gross = rate === null ? null : Math.round((r.regular / 60) * rate + (r.overtime / 60) * rate * 1.5)
      return [
        `${r.lastName}, ${r.firstName}`,
        r.email,
        positionLabel(r.position),
        hours(r.regular),
        hours(r.overtime),
        hours(r.workedMinutes),
        rate === null ? '' : dollars(rate),
        gross === null ? '' : dollars(gross),
        r.openEntries || '',
      ]
    }),
  )
}

// One row per time entry
function entriesCsv(rows) {
  const out = []
  for (const r of rows) {
    for (const day of r.days) {
      for (const e of day.entries) {
        out.push([
          `${r.lastName}, ${r.firstName}`,
          e.date,
          formatClockTime(e.clockIn),
          e.clockOut ? formatClockTime(e.clockOut) : 'OPEN',
          Math.round(e.breakMinutes),
          hours(e.workedMinutes),
          e.editedAt ? 'Yes' : '',
          e.note || '',
        ])
      }
    }
  }
  return toCsv(['Employee', 'Date', 'Clock In', 'Clock Out', 'Break Minutes', 'Hours', 'Edited', 'Note'], out)
}
