// On Course display helpers: pace as an arrow + "+6" / "−4" text (never color alone), and fresh vs estimated
// positions. The tone and wording come from statusChips.js ('pace'); the math stays in src/lib/pace.js.
import { statusInfo } from '@/components/ui/statusChips'
import { formatMinutes, paceLabel } from '@/lib/pace'
import IconBehind from '~icons/material-symbols/trending-down-rounded'
import IconAhead from '~icons/material-symbols/trending-up-rounded'
import IconOnPace from '~icons/material-symbols/check-rounded'

// A report this recent counts as fresh (solid on the map); older reports and every estimate are hatched
export const FRESH_MINUTES = 30

export const PACE_ICONS = { BEHIND: IconBehind, AHEAD: IconAhead, ON_PACE: IconOnPace }

/** 6 → "+6", -4 → "−4" (a real minus sign), 0 → "0"; over an hour: "+1 h 5 min" */
export function paceDelta(deltaMinutes) {
  if (deltaMinutes == null) return ''
  const m = Math.round(deltaMinutes)
  if (m === 0) return '0'
  const abs = Math.abs(m)
  return `${m > 0 ? '+' : '−'}${abs < 60 ? abs : formatMinutes(abs)}`
}

/** { icon, tone, label (Ahead / On pace / Behind), short ("+6 min", "On pace"), long ("6 min behind") } */
export function paceDisplay(pace, deltaMinutes) {
  const info = statusInfo('pace', pace)
  const short = pace === 'ON_PACE' || deltaMinutes == null ? info.label : `${paceDelta(deltaMinutes)} min`
  return { icon: PACE_ICONS[pace] ?? IconOnPace, tone: info.tone, label: info.label, short, long: paceLabel(deltaMinutes) || info.label }
}

export function isFresh(track) {
  return track.basis === 'REPORTED' && track.reportedMinutesAgo <= FRESH_MINUTES
}

/** "Reported 6 min ago" / "Reported just now" / "Estimated from the tee-off" / "Estimated from the tee time" */
export function basisText(track) {
  if (track.basis === 'REPORTED') return `Reported ${track.reportedMinutesAgo ? `${formatMinutes(track.reportedMinutesAgo)} ago` : 'just now'}`
  if (track.basis === 'TEED_OFF') return 'Estimated from the tee-off'
  return 'Estimated from the tee time'
}

/** Short label for a map chip: the cart numbers, else the first word of the name */
export function chipLabel(b) {
  if (b.cartNumbers?.length) return b.cartNumbers.join('·')
  return b.name.split(' ')[0]
}

export function playersText(b) {
  return `${b.players} player${b.players === 1 ? '' : 's'}`
}

// Tone → classes (literal, so Tailwind keeps them). Fresh: the tone's container fill. Estimate: no fill, a dashed
// outline in the tone's text color and a hatch (.estimate-hatch, defined where it's used).
export const FRESH_FILL = {
  neutral: 'bg-surface-container-highest text-on-surface-variant border-transparent',
  primary: 'bg-primary-container text-on-primary-container border-transparent',
  success: 'bg-success-container text-on-success-container border-transparent',
  warning: 'bg-warning-container text-on-warning-container border-transparent',
  error:   'bg-error-container text-on-error-container border-transparent',
  info:    'bg-secondary-container text-on-secondary-container border-transparent',
}
export const ESTIMATE_OUTLINE = {
  neutral: 'bg-surface text-on-surface-variant border-on-surface-variant',
  primary: 'bg-surface text-on-primary-container border-on-primary-container',
  success: 'bg-surface text-on-success-container border-on-success-container',
  warning: 'bg-surface text-on-warning-container border-on-warning-container',
  error:   'bg-surface text-on-error-container border-on-error-container',
  info:    'bg-surface text-on-secondary-container border-on-secondary-container',
}
