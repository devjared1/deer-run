import { json } from '../admin/_auth.js'
import { requireStaff } from './_auth.js'
import { serializeEntry, loadPayPeriod, resolvePeriod, fetchEntries, buildTimesheet } from './_timesheet.js'
import { isValidYmd } from '../../../src/lib/timeclock.js'

// GET /api/staff/timesheet?date=YYYY-MM-DD
// Signed-in employee's timesheet for the pay period containing `date` (default: today).
export async function onRequestGet({ request, env }) {
  const result = await requireStaff(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  const date = new URL(request.url).searchParams.get('date')
  if (date && !isValidYmd(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400)

  try {
    const period = resolvePeriod(date, await loadPayPeriod(supabase))
    const now = new Date()
    const entries = (await fetchEntries(supabase, period.start, period.end, employee.id))
      .map(e => serializeEntry(e, now))

    return json({ period, ...buildTimesheet(entries, period.start, period.end, period.weekStartDay) })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
