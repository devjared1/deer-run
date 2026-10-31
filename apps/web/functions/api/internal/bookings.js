import { json, makeSupabase } from '../admin/_auth.js'
import { requireCronSecret } from './_secret.js'
import { releaseExpiredHolds } from '../bookings/_holds.js'

// POST /api/internal/bookings — the daily unpaid-booking cleanup (called by the apps/cron Worker).
// Header: Authorization: Bearer <CRON_SECRET>.
// Releases every online booking whose payment wasn't finished within its 30-minute hold: cancels the
// PaymentIntent and marks the booking CANCELLED (or settles it if the payment did go through). The holds already
// stop counting toward capacity after 30 minutes, and the pages release them as they're viewed; this catches the
// rest. Safe to run any time. Returns { checked, released, confirmed, refunded, processing, errors }.
export async function onRequestPost({ request, env }) {
  const denied = requireCronSecret(request, env)
  if (denied) return denied

  // Oldest first, capped so one run stays inside the Workers subrequest limit (50 on the free plan; each booking
  // takes 2–3 Stripe calls and an update); anything left over goes on the next run or when its day is viewed
  const summary = await releaseExpiredHolds(makeSupabase(env), env, { limit: 15 })
  return json(summary)
}
