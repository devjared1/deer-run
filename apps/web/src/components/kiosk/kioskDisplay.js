// Display rules for the time clock kiosk (views/kiosk/TimeClockKioskView.vue and the components in this folder).
// No icon imports here: components map the `icon` keys to components.
import { formatClockTime, formatMinutes } from '@/lib/timeclock'

// How long the kiosk waits before going back to the name list (nobody touching it), and the done screen's countdown
export const IDLE_SECONDS = 30
export const DONE_SECONDS = 6
// The name list refreshes this often (who's on the clock), and the search clears after this long untouched
export const REFRESH_SECONDS = 60

/** Status chip on a name tile and the action screen: { label, tone, icon } (icon: on | break | off). */
export const STATUS = {
  off:   { label: 'Off the clock', tone: 'neutral', icon: 'off' },
  on:    { label: 'On the clock',  tone: 'success', icon: 'on' },
  break: { label: 'On break',      tone: 'warning', icon: 'break' },
}

/** "Sam Ortiz" → "SO" */
export function initials(e) {
  return `${e.firstName?.[0] ?? ''}${e.lastName?.[0] ?? ''}`.toUpperCase()
}

export function fullName(e) {
  return `${e.firstName} ${e.lastName}`.trim()
}

/** The search box: matches first name, last name or "first last", ignoring case and accents. */
export function matchesName(e, text) {
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const term = norm(text.trim())
  if (!term) return true
  return norm(`${e.firstName} ${e.lastName}`).includes(term) || norm(e.lastName).startsWith(term)
}

/**
 * The done screen after a punch: { title, message, icon } from the action and the new clock state.
 *   state: clockStatus from the API ({ openEntry, today, employee })
 */
export function doneMessage(action, state) {
  const name = state.employee.firstName
  const openBreak = state.openEntry?.breaks?.find(b => !b.endedAt)
  if (action === 'clock_in') {
    return { title: `Clocked in at ${formatClockTime(state.openEntry.clockIn)}`, message: `Have a good shift, ${name}.`, icon: 'in' }
  }
  if (action === 'break_start') {
    return { title: `Break started at ${formatClockTime(openBreak?.startedAt ?? state.serverTime)}`, message: `Enjoy your break, ${name}.`, icon: 'break' }
  }
  if (action === 'break_end') {
    return { title: 'Back on the clock', message: `Break over, ${name}. Welcome back.`, icon: 'in' }
  }
  return {
    title: `Clocked out at ${formatClockTime(state.serverTime)}`,
    message: `You worked ${formatMinutes(state.today.workedMinutes)} today. See you next time, ${name}.`,
    icon: 'out',
  }
}
