import { json, makeSupabase } from '../admin/_auth.js'
import { requireCronSecret } from './_secret.js'
import { runMonthlyStatements, runOverdueStatements } from '../admin/_statements.js'

// POST /api/internal/statements — house account statements for the previous month (called daily by apps/cron;
// it only creates what's missing, so on the 1st it closes last month and on other days it does nothing new), then
// overdue statements: one late fee (if CourseSettings.lateFeeCents > 0) and one reminder email each.
// Header: Authorization: Bearer <CRON_SECRET>.
// Response: { period, created, skipped, autopay: { charged, failed }, emailed, errors, overdue: { reminded, lateFees, settled, errors } }
export async function onRequestPost({ request, env }) {
  const denied = requireCronSecret(request, env)
  if (denied) return denied
  const supabase = makeSupabase(env)
  try {
    const summary = await runMonthlyStatements(supabase, env)
    try {
      summary.overdue = await runOverdueStatements(supabase, env)
    } catch (e) {
      summary.overdue = { error: e.message }
    }
    return json(summary)
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
