<template>
  <div class="bg-surface">
    <!-- Status header (fills the page when there's nothing below it) -->
    <section
      :class="[
        'hero-bg on-dark relative isolate overflow-hidden text-on-primary flex items-center',
        !loading && state === 'confirmed' ? '' : 'min-h-[60vh]',
      ]"
    >
      <div class="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-14 text-center">
        <template v-if="loading">
          <ProgressIndicator :size="40" label="Loading your booking" class="mx-auto mb-4" />
          <h1 class="font-display text-headline-m">Loading your booking…</h1>
        </template>

        <template v-else-if="state === 'failed'">
          <IconCardOff class="w-12 h-12 mx-auto mb-3 text-gold-container" aria-hidden="true" />
          <h1 class="font-display text-headline-l md:text-display-s">Payment didn't go through</h1>
          <p class="text-body-l text-on-primary/90 mt-3 max-w-xl mx-auto">
            Your card wasn't charged and the tee time wasn't booked. Please try again, or call
            <a :href="`tel:${phone.tel}`" class="underline text-on-primary">{{ phone.display }}</a>.
          </p>
          <AppButton variant="gold" size="lg" to="/book" :icon="IconRefresh" class="mt-6">Try again</AppButton>
        </template>

        <div v-else-if="state === 'processing'" role="status">
          <ProgressIndicator v-if="!pollGaveUp" :size="40" label="Confirming your payment" class="mx-auto mb-4 text-gold-container" />
          <IconHourglass v-else class="w-12 h-12 mx-auto mb-3 text-gold-container" aria-hidden="true" />
          <h1 class="font-display text-headline-l md:text-display-s">Almost there…</h1>
          <p class="text-body-l text-on-primary/90 mt-3 max-w-xl mx-auto">
            <template v-if="!pollGaveUp">We're confirming your payment. This usually takes a few seconds.</template>
            <template v-else>
              Your payment is still processing. We'll email your confirmation as soon as it clears, and the booking will
              show in your account. Questions? Call
              <a :href="`tel:${phone.tel}`" class="underline text-on-primary">{{ phone.display }}</a>.
            </template>
          </p>
        </div>

        <template v-else-if="state === 'cancelled'">
          <IconEventBusy class="w-12 h-12 mx-auto mb-3 text-gold-container" aria-hidden="true" />
          <h1 class="font-display text-headline-l md:text-display-s">Booking not active</h1>
          <p class="text-body-l text-on-primary/90 mt-3 max-w-xl mx-auto">
            This booking was cancelled or its hold expired before payment. If you were charged, call
            <a :href="`tel:${phone.tel}`" class="underline text-on-primary">{{ phone.display }}</a>.
          </p>
          <AppButton variant="gold" size="lg" to="/book" :icon="IconEventAvailable" class="mt-6">Book a tee time</AppButton>
        </template>

        <template v-else-if="state === 'confirmed'">
          <BrandLogo variant="mark" :size="72" eager alt="" class="mx-auto mb-4" />
          <p class="text-label-l uppercase tracking-[.2em] text-gold-container mb-2">Booking confirmed</p>
          <h1 class="font-display text-headline-l md:text-display-s">You're on the <em>tee sheet</em></h1>
          <p class="text-body-l text-on-primary/90 mt-3">
            {{ dateLong }} at {{ timeLabel }}
          </p>
          <p class="mt-4 inline-flex items-center gap-2 rounded-full bg-on-primary/10 px-4 h-10 text-label-l">
            <IconTicket class="w-5 h-5" aria-hidden="true" />
            Reference <span class="tracking-widest tabular-nums">{{ reference }}</span>
          </p>
        </template>

        <template v-else>
          <IconSearchOff class="w-12 h-12 mx-auto mb-3 text-gold-container" aria-hidden="true" />
          <h1 class="font-display text-headline-l md:text-display-s">Booking not found</h1>
          <p class="text-body-l text-on-primary/90 mt-3 max-w-xl mx-auto">
            If you completed payment, your booking will be confirmed shortly. Check your email for a receipt, or call
            <a :href="`tel:${phone.tel}`" class="underline text-on-primary">{{ phone.display }}</a>.
          </p>
          <AppButton variant="outlined" size="lg" to="/" :icon="IconHome" class="mt-6 !text-on-primary !border-on-primary/60">Return home</AppButton>
        </template>
      </div>
    </section>

    <!-- Confirmed: details, calendar, directions, weather, manage, arrival tips -->
    <section v-if="!loading && state === 'confirmed'" class="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-10 space-y-6">
      <p class="text-body-m text-on-surface-variant text-center">
        A confirmation was sent to <span class="text-on-surface break-words">{{ email || 'your email' }}</span>.
      </p>

      <Card tag="section" aria-labelledby="conf-details" padding="lg">
        <h2 id="conf-details" class="text-title-l text-on-surface mb-4">Booking details</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-body-m">
          <div v-for="row in detailRows" :key="row.label" class="flex sm:flex-col justify-between gap-2 sm:gap-0.5">
            <dt class="text-on-surface-variant">{{ row.label }}</dt>
            <dd class="text-on-surface text-right sm:text-left break-words min-w-0">{{ row.value }}</dd>
          </div>
        </dl>

        <div class="flex flex-wrap gap-2 mt-6">
          <AppButton variant="tonal" :icon="IconCalendarAdd" @click="downloadIcs">Add to calendar</AppButton>
          <AppButton variant="outlined" :href="googleCalendarUrl" target="_blank" rel="noopener" :trailing-icon="IconOpenInNew">
            Google Calendar
          </AppButton>
        </div>
      </Card>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card tag="section" aria-labelledby="conf-getting-there" padding="lg">
          <h2 id="conf-getting-there" class="text-title-l text-on-surface mb-2 flex items-center gap-2">
            <IconDirections class="w-6 h-6 text-primary" aria-hidden="true" /> Getting here
          </h2>
          <address class="not-italic text-body-m text-on-surface">
            {{ courseName }}<br>
            <template v-for="line in addressLines" :key="line">{{ line }}<br></template>
          </address>
          <div class="flex flex-wrap gap-2 mt-4">
            <AppButton variant="outlined" :href="mapsDirectionsUrl" target="_blank" rel="noopener" :icon="IconMap">Google Maps</AppButton>
            <AppButton variant="outlined" :href="appleMapsUrl" target="_blank" rel="noopener" :icon="IconMap">Apple Maps</AppButton>
          </div>
        </Card>

        <Card tag="section" aria-labelledby="conf-weather" padding="lg">
          <h2 id="conf-weather" class="text-title-l text-on-surface mb-2 flex items-center gap-2">
            <IconWeather class="w-6 h-6 text-primary" aria-hidden="true" /> Weather
          </h2>
          <p class="text-body-m text-on-surface-variant">
            <template v-if="daysAhead <= 6">See the National Weather Service forecast for {{ dateShort }} at the course.</template>
            <template v-else>The National Weather Service forecast covers the next 7 days; check it closer to {{ dateShort }}.</template>
          </p>
          <AppButton variant="outlined" :href="WEATHER_URL" target="_blank" rel="noopener" :trailing-icon="IconOpenInNew" class="mt-4">
            Forecast
          </AppButton>
        </Card>
      </div>

      <Card tag="section" aria-labelledby="conf-manage" padding="lg">
        <h2 id="conf-manage" class="text-title-l text-on-surface mb-2 flex items-center gap-2">
          <IconEditCalendar class="w-6 h-6 text-primary" aria-hidden="true" /> Manage your booking
        </h2>
        <template v-if="auth.isLoggedIn && booking.userId">
          <p class="text-body-m text-on-surface-variant">
            See or cancel it in My Account up to 24 hours before the tee time. Within 24 hours, call
            <a :href="`tel:${phone.tel}`" class="text-primary underline">{{ phone.display }}</a>.
          </p>
          <AppButton variant="filled" to="/account" :icon="IconAccount" class="mt-4">My Account</AppButton>
        </template>
        <template v-else>
          <p class="text-body-m text-on-surface-variant">
            To change or cancel, call the pro shop at
            <a :href="`tel:${phone.tel}`" class="text-primary underline">{{ phone.display }}</a>
            and give your reference <span class="text-on-surface tracking-wider">{{ reference }}</span>.
          </p>
          <AppButton variant="outlined" :href="`tel:${phone.tel}`" :icon="IconCall" class="mt-4">Call {{ phone.display }}</AppButton>
        </template>
      </Card>

      <Card tag="section" variant="filled" aria-labelledby="conf-tips" padding="lg">
        <h2 id="conf-tips" class="text-title-l text-on-surface mb-3 flex items-center gap-2">
          <IconTips class="w-6 h-6 text-primary" aria-hidden="true" /> Before you arrive
        </h2>
        <ul class="space-y-2 text-body-m text-on-surface">
          <li v-for="tip in ARRIVAL_TIPS" :key="tip" class="flex items-start gap-2">
            <IconCheckCircle class="w-5 h-5 mt-0.5 text-primary flex-shrink-0" aria-hidden="true" />
            {{ tip }}
          </li>
        </ul>
      </Card>

      <div class="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <AppButton variant="outlined" size="lg" to="/" :icon="IconHome">Return home</AppButton>
        <AppButton variant="gold" size="lg" to="/book" :icon="IconEventAvailable">Book another round</AppButton>
      </div>
    </section>
  </div>
</template>

<script setup>
// /confirmation?booking_id=…[&redirect_status=…] after paying. States: processing (PENDING while the Stripe webhook
// catches up; polls), failed (Stripe redirect_status=failed), cancelled, missing, and confirmed with the reference,
// calendar (.ics + Google), directions, weather, managing the booking and arrival tips.
import {
  ARRIVAL_TIPS, ROUND_MINUTES, WEATHER_URL, bookingReference, plural,
} from '@/components/booking/bookingFlow'
import AppButton from '@/components/ui/AppButton.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import Card from '@/components/ui/Card.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import {
  addressLines, appleMapsUrl, courseName, mapsDirectionsUrl, mapsQuery, phone,
} from '@/data/site'
import { formatCents } from '@/lib/money'
import { teeTime } from '@/lib/teesheet'
import { daysBetween, formatLocalDate, localDate, localDateTimeToUtc } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import IconAccount from '~icons/material-symbols/account-circle-rounded'
import IconCalendarAdd from '~icons/material-symbols/calendar-add-on-rounded'
import IconCall from '~icons/material-symbols/call-rounded'
import IconCardOff from '~icons/material-symbols/credit-card-off-rounded'
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded'
import IconDirections from '~icons/material-symbols/directions-rounded'
import IconEditCalendar from '~icons/material-symbols/edit-calendar-rounded'
import IconEventAvailable from '~icons/material-symbols/event-available-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconHome from '~icons/material-symbols/home-rounded'
import IconHourglass from '~icons/material-symbols/hourglass-top-rounded'
import IconMap from '~icons/material-symbols/map-rounded'
import IconOpenInNew from '~icons/material-symbols/open-in-new-rounded'
import IconRefresh from '~icons/material-symbols/refresh-rounded'
import IconSearchOff from '~icons/material-symbols/search-off-rounded'
import IconTicket from '~icons/material-symbols/confirmation-number-rounded'
import IconTips from '~icons/material-symbols/tips-and-updates-rounded'
import IconWeather from '~icons/material-symbols/partly-cloudy-day-rounded'

const route = useRoute()
const auth = useAuthStore()
const bookingStore = useBookingStore()

const POLL_MS = 2000
const POLL_LIMIT = 30 // ~1 minute, then tell the customer the email will follow

const booking = ref(null)
const loading = ref(true)
const pollGaveUp = ref(false)
let pollTimer = null

// confirmed | processing (PENDING while the Stripe webhook catches up) | failed | cancelled | missing
const state = computed(() => {
  if (route.query.redirect_status === 'failed') return 'failed'
  const status = booking.value?.status
  if (!status) return 'missing'
  if (status === 'CONFIRMED') return 'confirmed'
  if (status === 'PENDING') return 'processing'
  return 'cancelled'
})

const ymd = computed(() => String(booking.value?.teeTimeSlot?.date ?? '').slice(0, 10))
const startTime = computed(() => booking.value?.teeTimeSlot?.startTime ?? '')
const dateLong = computed(() => (ymd.value ? formatLocalDate(ymd.value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''))
const dateShort = computed(() => (ymd.value ? formatLocalDate(ymd.value, { weekday: 'long', month: 'short', day: 'numeric' }) : ''))
const timeLabel = computed(() => (startTime.value ? teeTime(startTime.value) : ''))
const daysAhead = computed(() => (ymd.value ? daysBetween(localDate(), ymd.value) : 0))
const reference = computed(() => bookingReference(booking.value?.id))
const holes = computed(() => (Number(booking.value?.roundHoles) === 9 ? 9 : 18))
const riding = computed(() => !!booking.value?.cartIncluded)
const email = computed(() => booking.value?.guestEmail || (booking.value?.userId ? auth.profile?.email : '') || '')

const detailRows = computed(() => {
  const b = booking.value
  if (!b) return []
  return [
    { label: 'Reference', value: reference.value },
    { label: 'Date', value: dateLong.value },
    { label: 'Tee time', value: timeLabel.value },
    { label: 'Players', value: plural(b.players, 'player') },
    { label: 'Round', value: `${holes.value} holes, ${riding.value ? 'riding (cart included)' : 'walking'}` },
    ...(b.guestName ? [{ label: 'Name', value: b.guestName }] : auth.profile?.name && b.userId ? [{ label: 'Name', value: auth.profile.name }] : []),
    { label: 'Total paid', value: formatCents(b.totalCents) },
  ]
})

// ── Calendar ──
const start = computed(() => (ymd.value && startTime.value ? localDateTimeToUtc(ymd.value, startTime.value) : null))
const end = computed(() => (start.value ? new Date(start.value.getTime() + ROUND_MINUTES[holes.value] * 60_000) : null))
const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') // 20261107T151000Z
const eventTitle = 'Tee time at Deer Run Golf Course'
const eventDetails = computed(() => [
  `${plural(booking.value?.players ?? 1, 'player')}, ${holes.value} holes, ${riding.value ? 'riding' : 'walking'}.`,
  `Reference ${reference.value}.`,
  ARRIVAL_TIPS[0],
  `Questions: ${phone.display}.`,
].join('\n'))

const googleCalendarUrl = computed(() => {
  if (!start.value) return ''
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle,
    dates: `${stamp(start.value)}/${stamp(end.value)}`,
    details: eventDetails.value,
    location: mapsQuery,
  })
  return `https://calendar.google.com/calendar/render?${params}`
})

const icsText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
// RFC 5545: lines over 75 octets fold onto continuation lines starting with a space
function fold(line) {
  const out = []
  let rest = line
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}` }
  out.push(rest)
  return out.join('\r\n')
}

function downloadIcs() {
  if (!start.value) return
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Deer Run Golf Course//Tee time//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.value.id}@deerrun.golf`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start.value)}`,
    `DTEND:${stamp(end.value)}`,
    `SUMMARY:${icsText(eventTitle)}`,
    `LOCATION:${icsText(mapsQuery)}`,
    `DESCRIPTION:${icsText(eventDetails.value)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(eventTitle)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([`${lines.map(fold).join('\r\n')}\r\n`], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `deer-run-tee-time-${ymd.value}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Loading / polling ──
async function load() {
  const res = await fetch(`/api/bookings/${route.query.booking_id}`)
  if (res.ok) booking.value = await res.json()
  if (booking.value?.status === 'CONFIRMED') bookingStore.reset()
}

function poll(attempt = 1) {
  pollTimer = setTimeout(async () => {
    try { await load() } catch { /* keep polling */ }
    if (state.value !== 'processing') return
    if (attempt >= POLL_LIMIT) pollGaveUp.value = true
    else poll(attempt + 1)
  }, POLL_MS)
}

onMounted(async () => {
  if (!route.query.booking_id || route.query.redirect_status === 'failed') { loading.value = false; return }
  try {
    await load()
  } catch { /* shown as not found */ } finally {
    loading.value = false
  }
  if (state.value === 'processing') poll()
})

onBeforeUnmount(() => clearTimeout(pollTimer))
</script>
