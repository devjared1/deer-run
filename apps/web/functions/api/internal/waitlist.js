import { json, makeSupabase } from '../admin/_auth.js'
import { requireCronSecret } from './_secret.js'
import { notifyWaitlist } from '../bookings/_waitlist.js'
import { siteOrigin } from '../_links.js'
import { localDate } from '../../../src/lib/timeclock.js'

// POST /api/internal/waitlist — daily backstop for the waitlist (called by the apps/cron Worker). Cancellations and
// released holds tell the waitlist straight away; this catches anything they missed (an email outage, slots added by
// an admin) for every upcoming day with people waiting. Header: Authorization: Bearer <CRON_SECRET>.
// → { dates, notified, errors }
export async function onRequestPost({ request, env }) {
  const denied = requireCronSecret(request, env)
  if (denied) return denied
  const supabase = makeSupabase(env)

  const { data, error } = await supabase.from('WaitlistEntry').select('date')
    .gte('date', localDate()).is('notifiedAt', null).is('cancelledAt', null)
  // Before migration 15 there's no waitlist yet
  if (error) return json({ dates: 0, notified: 0, errors: [error.message] }, error.code === '42P01' ? 200 : 500)

  const dates = [...new Set((data || []).map(e => String(e.date).slice(0, 10)))].sort()
  const summary = { dates: dates.length, notified: 0, errors: [] }
  const origin = siteOrigin(env, request)
  for (const date of dates) {
    try {
      const r = await notifyWaitlist(supabase, env, date, origin)
      summary.notified += r.notified
      summary.errors.push(...r.errors)
    } catch (e) {
      summary.errors.push(`${date}: ${e.message}`)
    }
  }
  return json(summary)
}
