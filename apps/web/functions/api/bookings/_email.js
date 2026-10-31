import { Resend } from 'resend'
import { formatLocalDate } from '../../../src/lib/timeclock.js'
import { teeTime } from '../../../src/lib/teesheet.js'

// Short emails to golfers about their online booking (moved from the tee sheet, refunded after its hold ran out).

const FOOTER = ['', 'Pro Shop: (256) 974-7384', '1175 County Road 100, Moulton, AL 35650']

/** "Saturday, October 31, 2026 at 7:30 AM" */
export function slotWhen(slot) {
  const day = formatLocalDate(slot.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return `${day} at ${teeTime(slot.startTime)}`
}

/** Sends a plain-text email. Skipped (null) without RESEND_API_KEY or an address. Returns an error message, or null. */
export async function sendBookingEmail(env, to, subject, lines) {
  if (!env.RESEND_API_KEY || !to) return null
  try {
    const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
      from: 'noreply@deerrun.golf', to, subject, text: [...lines, ...FOOTER].join('\n'),
    })
    return error ? error.message : null
  } catch (e) {
    return e.message
  }
}
