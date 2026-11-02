import { Resend } from 'resend'
import { json, makeSupabase } from '../admin/_auth.js'
import { requireCronSecret } from './_secret.js'
import { fetchAll } from '../admin/_db.js'
import { forecastLine, loadForecast } from '../_weather.js'
import { manageBookingUrl, siteOrigin } from '../_links.js'
import { slotWhen } from '../bookings/_email.js'
import { addDays, localDate } from '../../../src/lib/timeclock.js'
import { formatCents } from '../../../src/lib/money.js'
import { addressLines, mapsDirectionsUrl, phone } from '../../../src/data/site.js'

const BATCH = 100 // Resend's batch limit: one request (one Workers subrequest) per 100 emails

// POST /api/internal/reminders — the day-before reminder (called daily by the apps/cron Worker, early morning).
// Header: Authorization: Bearer <CRON_SECRET>. Every paid booking for tomorrow with an email gets one reminder: the tee
// time, players, what's still due at the course, tomorrow's forecast, directions and the change/cancel link.
// Booking.reminderSentAt is claimed before sending, so a re-run never sends twice (a failed batch is released for the
// next run). Without RESEND_API_KEY nothing is sent or marked. → { date, sent, failed, skipped, errors }
export async function onRequestPost({ request, env }) {
  const denied = requireCronSecret(request, env)
  if (denied) return denied
  const supabase = makeSupabase(env)
  const date = addDays(localDate(), 1)
  const summary = { date, sent: 0, failed: 0, skipped: 0, errors: [] }
  if (!env.RESEND_API_KEY) return json({ ...summary, skipped: 'RESEND_API_KEY is not set' })

  let bookings
  try {
    bookings = await fetchAll(() => supabase.from('Booking')
      .select('*, slot:TeeTimeSlot!inner(date, startTime), user:User(name, email)')
      .eq('slot.date', date).eq('status', 'CONFIRMED').is('reminderSentAt', null).is('checkedInAt', null)
      .order('id'))
  } catch (e) {
    // Before migration 15 (no reminderSentAt) there's nothing to do
    return json({ ...summary, errors: [e.message] }, /reminderSentAt/.test(e.message) ? 200 : 500)
  }

  const forecast = await loadForecast().catch(() => null)
  const weather = forecastLine(forecast, date)
  const origin = siteOrigin(env, request)
  const resend = new Resend(env.RESEND_API_KEY)

  const due = bookings.filter(b => b.user?.email || b.guestEmail)
  summary.skipped = bookings.length - due.length
  for (let i = 0; i < due.length; i += BATCH) {
    const batch = due.slice(i, i + BATCH)
    const ids = batch.map(b => b.id)
    // Claim the batch first; only the ones still unclaimed are sent
    const { data: claimed, error } = await supabase.from('Booking').update({ reminderSentAt: new Date().toISOString() })
      .in('id', ids).is('reminderSentAt', null).select('id')
    if (error) {
      summary.errors.push(error.message)
      continue
    }
    const mine = new Set(claimed.map(r => r.id))
    const emails = await Promise.all(batch.filter(b => mine.has(b.id)).map(async b => ({
      from: 'noreply@deerrun.golf',
      to: b.user?.email ?? b.guestEmail,
      subject: `Tomorrow: your tee time at ${slotWhen(b.slot).split(' at ')[1]} — Deer Run Golf Course`,
      text: reminderText(b, { weather, manageUrl: await manageBookingUrl(env, origin, b.id) }),
    })))
    if (!emails.length) continue
    try {
      const { error: sendError } = await resend.batch.send(emails)
      if (sendError) throw new Error(sendError.message)
      summary.sent += emails.length
    } catch (e) {
      summary.failed += emails.length
      summary.errors.push(e.message)
      // Let the next run try these again
      await supabase.from('Booking').update({ reminderSentAt: null }).in('id', [...mine])
    }
  }
  return json(summary)
}

function reminderText(b, { weather, manageUrl }) {
  const name = b.user?.name || b.guestName
  const due = b.holdFeeCents != null && b.balanceDueCents > 0
  return [
    `${name ? `Hi ${name}, see` : 'See'} you tomorrow at Deer Run Golf Course!`,
    '',
    `Tee time: ${slotWhen(b.slot)}`,
    `Players: ${b.players} · ${b.roundHoles ?? 18} holes${b.cartIncluded ? ' · cart' : ''}`,
    due ? `Due at the course: ${formatCents(b.balanceDueCents)}, at the pro shop when you check in` : 'Paid: nothing more to pay for the round',
    ...(weather ? [`Forecast: ${weather}`] : []),
    '',
    'Check in at the pro shop 15 minutes before your tee time.',
    `Directions: ${addressLines.join(', ')} (${mapsDirectionsUrl})`,
    '',
    `Change or cancel (up to 24 hours before the tee time): ${manageUrl}`,
    `Running late or plans changed today? Call the pro shop at ${phone.display}.`,
  ].join('\n')
}
