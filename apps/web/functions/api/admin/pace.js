import { requireAdmin, json } from './_auth.js'
import { recalculateHoleTimes } from './_pace.js'

// POST /api/admin/pace — recalculate the learned per-hole times now (the daily job does the same).
// Returns { holeSeconds, rounds, roundsPerHole, updatedAt }.
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  try {
    return json(await recalculateHoleTimes(result.supabase))
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
