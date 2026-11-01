// Display helpers for public tournament events (TournamentsView, EventView, EventCard): a normalized event object,
// the decorative course photo for an event, the .ics file and Google Calendar link, and the schema.org Event JSON-LD.
// Events have no images in the database, so every event gets one of the course photos, picked from its id.
import { COURSE_TZ, formatLocalDate, localDate, localDateTimeToUtc } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import { formatCents } from '@/lib/money'
import { photos } from '@/data/photos'
import { address, addressLines, courseName } from '@/data/site'

// Landscape photos first; the order only decides which event gets which photo
const EVENT_PHOTOS = ['course-4', 'course-3', 'course-5', 'course-2-wide', 'course-hero', 'course-5-wide']

/** A course photo name (src/data/photos.js) for an event, stable for its id. */
export function eventPhoto(id) {
  let h = 0
  for (const ch of String(id ?? '')) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return EVENT_PHOTOS[h % EVENT_PHOTOS.length]
}

/**
 * The start time as "HH:MM" (24-hour), or null. The admin form saves "08:00"; older rows say "8:00 AM".
 * Anything after the time ("8:00 AM shotgun") is ignored here and kept in the display text.
 */
export function parseStartTime(text) {
  const m = String(text ?? '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(?:([AaPp])\.?\s*[Mm]\.?)?(?![\d:])/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (m[3]) {
    if (h < 1 || h > 12) return null
    h = (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0)
  } else if (!m[2]) {
    return null // a bare number isn't a time
  }
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** API row → what the pages show. */
export function normalizeEvent(e, today = localDate()) {
  const ymd = String(e.eventDate ?? '').slice(0, 10)
  const start = parseStartTime(e.startTime)
  const raw = String(e.startTime ?? '').trim()
  // "08:00" → "8:00 AM"; text that already reads as a time ("8:00 AM shotgun") is shown as entered
  const timeLabel = /^\d{1,2}:\d{2}$/.test(raw) && start ? teeTime(start) : raw
  return {
    id: e.id,
    name: e.name,
    description: e.description ?? '',
    format: e.format,
    memberOnly: !!e.memberOnly,
    featured: !!e.featured,
    ymd,
    start,
    timeLabel,
    // Past when the admin marked it so, or once its date has gone by (course time)
    past: !!e.past || (!!ymd && ymd < today),
    entryCents: e.entry ?? null,
    entryLabel: e.entry ? formatCents(e.entry).replace(/\.00$/, '') : null,
    spotsTotal: e.spotsTotal ?? null,
    spotsLabel: e.spotsTotal ? `${e.spotsTotal} spots` : 'Open field',
    photo: eventPhoto(e.id),
    month: ymd ? formatLocalDate(ymd, { month: 'short' }) : '',
    day: ymd ? formatLocalDate(ymd, { day: 'numeric' }) : '',
    year: ymd ? formatLocalDate(ymd, { year: 'numeric' }) : '',
    weekday: ymd ? formatLocalDate(ymd, { weekday: 'short' }) : '',
    dateLabel: ymd ? formatLocalDate(ymd, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '',
  }
}

/** Upcoming soonest first, then by start time and name. */
export function compareEvents(a, b) {
  return a.ymd.localeCompare(b.ymd) || (a.start ?? '').localeCompare(b.start ?? '') || a.name.localeCompare(b.name)
}

// ─── Filters (EventFilterBar) ───────────────────────────────────────────────
// Values: 'open' / 'members' (who can play) and 'format:<format>'. Within a group any selected value matches;
// both groups must match when both have a selection.

/** Chip options for a list of normalized events: who can play (when both kinds exist) + formats (when 2 or more). */
export function eventFilterOptions(events) {
  const options = []
  if (events.some(e => e.memberOnly) && events.some(e => !e.memberOnly)) {
    options.push({ value: 'open', label: 'Open to all' }, { value: 'members', label: 'Members only' })
  }
  const formats = [...new Set(events.map(e => e.format).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  if (formats.length > 1) options.push(...formats.map(f => ({ value: `format:${f}`, label: f })))
  return options
}

export function filterEvents(events, selected) {
  const who = selected.filter(v => v === 'open' || v === 'members')
  const formats = selected.filter(v => v.startsWith('format:')).map(v => v.slice(7))
  return events.filter(e =>
    (!who.length || who.includes(e.memberOnly ? 'members' : 'open')) &&
    (!formats.length || formats.includes(e.format)))
}

const fullAddress = `${courseName}, ${addressLines.join(', ')}`

// ─── Calendar ───────────────────────────────────────────────────────────────

const compact = ymd => ymd.replace(/-/g, '')
const compactTime = hhmm => `${hhmm.replace(':', '')}00`

/** The event's page URL (needs a browser). */
export function eventUrl(event) {
  return `${window.location.origin}/tournaments/${encodeURIComponent(event.id)}`
}

function calendarDetails(event) {
  return [event.format, event.entryLabel ? `Entry ${event.entryLabel}` : '', event.description, eventUrl(event)]
    .filter(Boolean).join('\n\n')
}

// RFC 5545 text: escape \ ; , and newlines; fold lines longer than 75 octets
const icsText = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
function fold(line) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0 }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

// US Central time rules (since 2007), so calendar apps place the start time correctly
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', `TZID:${COURSE_TZ}`,
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT', 'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE',
]

/**
 * The event as an .ics file (text). With a start time it starts then in course time; the database has no end
 * time, so none is given. Without a parseable time it's an all-day event.
 */
export function eventIcs(event, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const when = event.start
    ? [`DTSTART;TZID=${COURSE_TZ}:${compact(event.ymd)}T${compactTime(event.start)}`]
    : [`DTSTART;VALUE=DATE:${compact(event.ymd)}`, `DTEND;VALUE=DATE:${compact(addOneDay(event.ymd))}`]
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Deer Run Golf Course//Tournaments//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...(event.start ? VTIMEZONE : []),
    'BEGIN:VEVENT',
    `UID:event-${event.id}@deerrun.golf`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${icsText(event.name)}`,
    `DESCRIPTION:${icsText(calendarDetails(event))}`,
    `LOCATION:${icsText(fullAddress)}`,
    `URL:${eventUrl(event)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}

function addOneDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** "spring-scramble-2027.ics" */
export function eventIcsFilename(event) {
  const slug = String(event.name ?? 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event'
  return `${slug}-${event.ymd.slice(0, 4)}.ics`
}

/** Google Calendar "add event" link (times in course time via ctz). */
export function googleCalendarUrl(event) {
  const dates = event.start
    ? `${compact(event.ymd)}T${compactTime(event.start)}/${compact(event.ymd)}T${compactTime(event.start)}`
    : `${compact(event.ymd)}/${compact(addOneDay(event.ymd))}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates,
    details: calendarDetails(event),
    location: fullAddress,
    ctz: COURSE_TZ,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

// ─── schema.org ─────────────────────────────────────────────────────────────

/** "2027-03-20", "08:00" → "2027-03-20T08:00:00-05:00" (Central daylight/standard offset of that day). */
export function isoWithOffset(ymd, hhmm) {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  const offsetMin = Math.round((Date.UTC(y, m - 1, d, h, min) - localDateTimeToUtc(ymd, hhmm).getTime()) / 60000)
  const sign = offsetMin < 0 ? '-' : '+'
  const abs = Math.abs(offsetMin)
  return `${ymd}T${hhmm}:00${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

/** Largest JPEG of a photo up to 1280px wide, as an absolute URL (needs a browser). */
function photoUrl(name) {
  const p = photos[name]
  const width = Math.max(...p.widths.filter(w => w <= 1280))
  return `${window.location.origin}/images/photos/${name}-${width}.jpg`
}

/** schema.org Event for the event page's JSON-LD. */
export function eventJsonLd(event) {
  const url = eventUrl(event)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description || undefined,
    startDate: event.start ? isoWithOffset(event.ymd, event.start) : event.ymd,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url,
    image: [photoUrl(event.photo)],
    location: {
      '@type': 'Place',
      name: courseName,
      address: {
        '@type': 'PostalAddress',
        streetAddress: address.street,
        addressLocality: address.locality,
        addressRegion: address.region,
        postalCode: address.postalCode,
        addressCountry: 'US',
      },
    },
    organizer: { '@type': 'Organization', name: courseName, url: window.location.origin },
  }
  if (event.entryCents) {
    data.offers = { '@type': 'Offer', price: (event.entryCents / 100).toFixed(2), priceCurrency: 'USD', url }
  }
  return data
}
