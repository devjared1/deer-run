import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { parseDateRange, loadReport } from '../../admin/sales/_report.js'

// GET /api/staff/register/report?date=YYYY-MM-DD&registerId=
// End-of-day (Z) report for one register and day (default today), printed at the register.
// Register managers only (positions in CourseSettings.managerPositions).
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  if (!result.isRegisterManager) return json({ error: 'Only managers can run the end-of-day report' }, 403)

  const { searchParams } = new URL(request.url)
  const registerId = searchParams.get('registerId')
  if (!registerId) return json({ error: 'registerId is required' }, 400)
  if (searchParams.get('from') || searchParams.get('to')) return json({ error: 'Use date= for a single day' }, 400)
  const range = parseDateRange(searchParams)
  if (range.error) return json({ error: range.error }, 400)

  try {
    const report = await loadReport(result.supabase, range, registerId)
    if (!report.register) return json({ error: 'Register not found' }, 404)
    return json({ ...report, printedBy: `${result.employee.firstName} ${result.employee.lastName}` })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
