import { json, makeSupabase } from '../admin/_auth.js'
import { requireCronSecret } from './_secret.js'
import { fetchAll } from '../admin/_db.js'
import { downgradeIfLapsed, dueReminder, sendReminder, REMINDER_DAYS } from '../admin/_membership.js'
import { localDate, addDays } from '../../../src/lib/timeclock.js'

// Lapsed members get the "membership ended" email for this many days after their last day
const EXPIRED_EMAIL_DAYS = 14

// POST /api/internal/memberships — the daily membership job (called by the apps/cron Worker).
// Header: Authorization: Bearer <CRON_SECRET>.
//   1. Emails renewal reminders 30 and 7 days before a member's last day, and once when it has passed
//      (each at most once per membership end date).
//   2. Moves members whose membership has passed to GUEST (they also drop to GUEST when they next sign in).
// Safe to run more than once a day. Returns counts and any per-member errors.
export async function onRequestPost({ request, env }) {
  const denied = requireCronSecret(request, env)
  if (denied) return denied

  const supabase = makeSupabase(env)
  const today = localDate()
  const maxDays = Math.max(...REMINDER_DAYS)

  try {
    const users = await fetchAll(() => supabase
      .from('User')
      .select('id, email, name, role, memberUntil, membershipTier, renewalReminderKey')
      .in('role', ['MEMBER', 'GUEST'])
      .not('memberUntil', 'is', null)
      .gte('memberUntil', addDays(today, -EXPIRED_EMAIL_DAYS))
      .lte('memberUntil', addDays(today, maxDays))
      .order('memberUntil', { ascending: true }))

    const summary = { checked: users.length, downgraded: 0, reminders: { 30: 0, 7: 0, expired: 0 }, errors: [] }
    for (const user of users) {
      // Upcoming reminders are only for current members; guests only get the "ended" email
      const due = dueReminder(user, today)
      if (due && (user.role === 'MEMBER' || due.stage === 'expired')) {
        const error = await sendReminder(env, user, due.stage)
        if (error) {
          summary.errors.push(`${user.email}: ${error}`)
        } else {
          await supabase.from('User').update({ renewalReminderKey: due.key }).eq('id', user.id)
          summary.reminders[due.stage] = (summary.reminders[due.stage] ?? 0) + 1
        }
      }
      const updated = await downgradeIfLapsed(supabase, user, today)
      if (updated.role !== user.role) summary.downgraded++
    }

    return json({ date: today, ...summary })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
