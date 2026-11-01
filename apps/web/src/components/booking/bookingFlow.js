// Shared bits of the booking wizard (BookingWizard + Step*.vue) and the confirmation page: the steps, the booking
// window, time-of-day groups, labels and the customer-facing copy.
import { addDays, localDate } from '@/lib/timeclock'
import { phone } from '@/data/site'

// Steps in the URL: /book (date), /book?step=time|details|payment
export const STEPS = [
  { key: 'date',    label: 'Date',    title: 'Choose a date' },
  { key: 'time',    label: 'Time',    title: 'Choose a tee time' },
  { key: 'details', label: 'Details', title: 'Your details' },
  { key: 'payment', label: 'Payment', title: 'Payment' },
]

/** Bookable dates: today through today + maxBookDays (course time), as { from, to }. */
export function bookingWindow(maxBookDays) {
  const from = localDate()
  return { from, to: addDays(from, maxBookDays) }
}

// Time-of-day groups for the Time step (and the Home search's ?time=)
export const TIME_GROUPS = [
  { key: 'morning',   label: 'Morning',   range: 'Before 11 AM', test: t => t < '11:00' },
  { key: 'midday',    label: 'Midday',    range: '11 AM – 2 PM', test: t => t >= '11:00' && t < '14:00' },
  { key: 'afternoon', label: 'Afternoon', range: '2 PM and later', test: t => t >= '14:00' },
]

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Short booking reference shown to the golfer: the first 8 characters of the booking id. */
export const bookingReference = id => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase()

// ── Customer-facing copy. Edit freely; confirm with the course (TODO.md → Feature 4) ──

// Matches DELETE /api/bookings/:id (signed-in owner, more than 24 hours before the tee time) and the Account page
export const CANCEL_POLICY = `Signed-in golfers can cancel from My Account up to 24 hours before the tee time. `
  + `Booked as a guest, or within 24 hours? Call the pro shop at ${phone.display}.`

// Pay at course (booking Details / Payment steps and the confirmation page)
export const HOLD_FEE_POLICY = 'The hold fee is non-refundable: it isn\'t returned if the booking is cancelled or the tee '
  + 'time is missed. Pay the rest at the pro shop when you check in.'

// Shown on the confirmation page
export const ARRIVAL_TIPS = [
  'Check in at the pro shop 15 minutes before your tee time.',
  'Give the pro shop the name on the booking; payment is already taken care of.',
  'Collared shirts, no denim, and no metal spikes on the greens.',
  'Running late or need to change the group size? Call the pro shop.',
]

/** The arrival tips for a booking: paying at the course, the second one says what's still owed. */
export function arrivalTips(balanceDueCents = 0, formatMoney = String) {
  if (!(balanceDueCents > 0)) return ARRIVAL_TIPS
  return ARRIVAL_TIPS.map((tip, i) => (i === 1
    ? `Give the pro shop the name on the booking and pay the ${formatMoney(balanceDueCents)} balance when you check in.`
    : tip))
}

// Calendar event length (time on the course plus checking in)
export const ROUND_MINUTES = { 9: 135, 18: 255 }

// National Weather Service point forecast for the course (no API call)
export const WEATHER_URL = 'https://forecast.weather.gov/MapClick.php?lat=34.48&lon=-87.29'
