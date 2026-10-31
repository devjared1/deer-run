import { Resend } from 'resend'
import { addDays, formatLocalDate } from '../../../src/lib/timeclock.js'
import { isLapsedMember } from '../../../src/lib/membership.js'

// Renewal reminders go out this many days before the last day of membership, then once when it lapses
export const REMINDER_DAYS = [30, 7]

const SITE = 'https://deerrun.golf'

/** Moves a lapsed member to GUEST. Returns the updated user (or the same user if nothing changed). */
export async function downgradeIfLapsed(supabase, user, today) {
  if (!isLapsedMember(user, today)) return user
  const { data, error } = await supabase
    .from('User')
    .update({ role: 'GUEST' })
    .eq('id', user.id)
    .eq('role', 'MEMBER')
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? user
}

/**
 * Which reminder (if any) a member is due today: '30' / '7' days before memberUntil, or 'expired' once it
 * has passed. Each is sent once per membership end date (User.renewalReminderKey = "<memberUntil>:<stage>"),
 * so renewing (which changes memberUntil) starts the reminders over.
 */
export function dueReminder(user, today) {
  if (!user.memberUntil || !user.email) return null
  let stage = null
  if (user.memberUntil < today) stage = 'expired'
  else {
    for (const days of [...REMINDER_DAYS].sort((a, b) => a - b)) {
      if (user.memberUntil <= addDays(today, days)) { stage = String(days); break }
    }
  }
  if (!stage) return null
  const key = `${user.memberUntil}:${stage}`
  if (user.renewalReminderKey === key) return null
  // Don't send the 30-day reminder after the 7-day one (e.g. the job was paused)
  const sentStage = user.renewalReminderKey?.startsWith(`${user.memberUntil}:`) ? user.renewalReminderKey.split(':')[1] : null
  if (sentStage === 'expired' || (sentStage && stage !== 'expired' && Number(sentStage) <= Number(stage))) return null
  return { stage, key }
}

export function reminderEmail(user, stage) {
  const endDate = formatLocalDate(user.memberUntil, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const tier = user.membershipTier ? `${user.membershipTier} ` : ''
  const greeting = `Hi ${user.name?.split(' ')[0] || 'there'},`
  if (stage === 'expired') {
    return {
      subject: 'Your Deer Run membership has ended',
      text: [
        greeting, '',
        `Your ${tier}membership at Deer Run ended on ${endDate}. We'd love to have you back:`,
        'renew at the pro shop or call (256) 974-7384, and your member rates and tee times start again right away.', '',
        `Membership options: ${SITE}/memberships`, '', 'Deer Run Golf Course',
      ].join('\n'),
    }
  }
  return {
    subject: `Your Deer Run membership renews soon (${formatLocalDate(user.memberUntil, { month: 'short', day: 'numeric' })})`,
    text: [
      greeting, '',
      `Your ${tier}membership at Deer Run runs through ${endDate}.`,
      'Renew at the pro shop or call (256) 974-7384 to keep your member rates and 14-day tee time booking.',
      'Renewing early adds the new term to the end of your current one, so you don\'t lose any days.', '',
      `Membership options: ${SITE}/memberships`, '', 'Deer Run Golf Course',
    ].join('\n'),
  }
}

/** Sends a reminder. Returns an error message, or null when sent. */
export async function sendReminder(env, user, stage) {
  if (!env.RESEND_API_KEY) return 'Email is not configured'
  try {
    const { subject, text } = reminderEmail(user, stage)
    const { error } = await new Resend(env.RESEND_API_KEY).emails.send({ from: 'noreply@deerrun.golf', to: user.email, subject, text })
    return error ? error.message : null
  } catch (e) {
    return e.message
  }
}
