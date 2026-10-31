import { json, makeSupabase } from '../admin/_auth.js'
import { requireCronSecret } from './_secret.js'
import { runMonthlyStatements } from '../admin/_statements.js'

// POST /api/internal/statements — house account statements for the previous month (called daily by apps/cron;
// it only creates what's missing, so on the 1st it closes last month and on other days it does nothing new).
// Header: Authorization: Bearer <CRON_SECRET>.
export async function onRequestPost({ request, env }) {
  const denied = requireCronSecret(request, env)
  if (denied) return denied
  try {
    return json(await runMonthlyStatements(makeSupabase(env), env))
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
