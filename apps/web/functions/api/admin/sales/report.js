import { requireAdmin, json } from '../_auth.js'
import { parseDateRange, loadReport } from './_report.js'

// GET /api/admin/sales/report?date=YYYY-MM-DD  or  ?from=&to=  [&registerId=]
// Sales report for a course-local day (the end-of-day "Z" report) or range: sales by category and
// tender, tax collected, discounts, voids and refunds, cash expected and No Sale count. See buildReport.
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  const { searchParams } = new URL(request.url)
  const range = parseDateRange(searchParams)
  if (range.error) return json({ error: range.error }, 400)

  try {
    return json(await loadReport(result.supabase, range, searchParams.get('registerId') || null))
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
