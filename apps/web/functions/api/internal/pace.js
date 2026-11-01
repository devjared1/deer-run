import { json, makeSupabase } from '../admin/_auth.js'
import { requireCronSecret } from './_secret.js'
import { recalculateHoleTimes } from '../admin/_pace.js'

// POST /api/internal/pace — the daily per-hole time update (called by the apps/cron Worker).
// Header: Authorization: Bearer <CRON_SECRET>.
// Learns each hole's time from the last 60 days of tee-offs, position reports and finishes (src/lib/pace.js
// learnHoleSeconds) into CourseSettings.holeSeconds, which the tee sheet and On Course page estimate with.
// Safe to run any time. Returns { holeSeconds, rounds, roundsPerHole, updatedAt }.
export async function onRequestPost({ request, env }) {
  const denied = requireCronSecret(request, env)
  if (denied) return denied
  try {
    return json(await recalculateHoleTimes(makeSupabase(env)))
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
