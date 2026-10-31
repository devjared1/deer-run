import { requireAdmin, json } from '../_auth.js'
import { parseDateRange } from '../sales/_report.js'
import { loadDrawerSessions } from '../../staff/_drawer.js'

// GET /api/admin/drawer-sessions?from=&to=&registerId=
// Drawer sessions that were open at any point in the course-local date range (default today), newest first.
// Open sessions include running totals (expected so far).
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  const { searchParams } = new URL(request.url)
  const range = parseDateRange(searchParams)
  if (range.error) return json({ error: range.error }, 400)

  try {
    const sessions = await loadDrawerSessions(result.supabase, range, searchParams.get('registerId') || null)
    return json({ from: range.from, to: range.to, sessions: sessions.reverse() })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
