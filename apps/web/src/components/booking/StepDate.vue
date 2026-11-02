<template>
  <section class="rounded-shape-md bg-surface-container-low shadow-elevation-1 p-4 sm:p-6" aria-labelledby="step-date-title">
    <h2
      id="step-date-title"
      data-step-heading
      tabindex="-1"
      class="font-display text-headline-s text-on-surface scroll-mt-24 focus:outline-none focus-visible:outline-none"
    >
      Choose a date
    </h2>
    <p class="text-body-m text-on-surface-variant mt-1 mb-4">
      Tee times can be booked up to {{ auth.maxBookDays }} days ahead.
      <template v-if="!auth.isMember && !auth.isAdmin">Members can book 14 days ahead.</template>
      {{ ' ' }}<RouterLink
        v-if="!auth.isLoggedIn"
        :to="{ path: '/login', query: { redirect: '/book' } }"
        class="text-primary underline"
      >Member sign in</RouterLink>
    </p>

    <!-- Phones: a strip of the bookable days; md+: the month -->
    <div class="md:hidden">
      <DateStrip :model-value="store.selectedDate" :min="win.from" :max="win.to" :day-info="dayInfo" @select="select" />
    </div>
    <div class="hidden md:block">
      <BookingCalendar :model-value="store.selectedDate" :min="win.from" :max="win.to" :day-info="dayInfo" @select="select" />
    </div>

    <p class="mt-3 text-body-s text-on-surface-variant" aria-live="polite">
      <template v-if="loadingHints">Checking availability…</template>
      <template v-else-if="store.availabilityReady">
        Numbers show the tee times still open each day, with the forecast for the week ahead. Pick a day to see them; a
        full day lets you join its waitlist.
      </template>
      <template v-else>Pick a day to see its open tee times.</template>
    </p>
  </section>
</template>

<script setup>
// Booking step 1: picking a day goes straight on to the Time step.
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'
import { computed, onMounted, ref } from 'vue'
import BookingCalendar from './BookingCalendar.vue'
import DateStrip from './DateStrip.vue'
import { bookingWindow, plural } from './bookingFlow'
import { useForecast } from '@/composables/useForecast'

const { forecastFor } = useForecast()

const emit = defineEmits(['next'])
const auth = useAuthStore()
const store = useBookingStore()

const win = computed(() => bookingWindow(auth.maxBookDays))
const loadingHints = ref(!store.availabilityReady)

onMounted(async () => {
  await store.loadAvailability(win.value.from, win.value.to)
  loadingHints.value = false
})

// Availability hint for a day: only once the summary has loaded. A day with no tee times can't be picked; a full one
// can (the Time step offers the waitlist). Plus the forecast for the next 7 days, when the weather service answers.
function dayInfo(ymd) {
  const weather = forecastFor(ymd)
  const w = weather ? { weather, aria: weather.label } : { weather: null, aria: '' }
  const aria = text => [text, w.aria].filter(Boolean).join(', ')
  if (!store.availabilityReady) return { hint: '', disabled: false, ...w }
  const day = store.availability[ymd]
  if (!day) return { hint: 'No times', disabled: true, weather: w.weather, aria: aria('no tee times online') }
  if (!day.open) return { hint: 'Full', disabled: false, weather: w.weather, aria: aria('fully booked, join the waitlist') }
  return { hint: `${day.open} open`, disabled: false, weather: w.weather, aria: aria(`${plural(day.open, 'tee time')} open`) }
}

function select(ymd) {
  if (store.selectedDate !== ymd) store.selectedSlot = null
  store.selectedDate = ymd
  emit('next')
}
</script>
