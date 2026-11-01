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
      <template v-else-if="store.availabilityReady">Numbers show the tee times still open each day. Pick a day to see them.</template>
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

const emit = defineEmits(['next'])
const auth = useAuthStore()
const store = useBookingStore()

const win = computed(() => bookingWindow(auth.maxBookDays))
const loadingHints = ref(!store.availabilityReady)

onMounted(async () => {
  await store.loadAvailability(win.value.from, win.value.to)
  loadingHints.value = false
})

// Availability hint for a day: only once the summary has loaded; a day with nothing open can't be picked
function dayInfo(ymd) {
  if (!store.availabilityReady) return { hint: '', disabled: false, aria: '' }
  const day = store.availability[ymd]
  if (!day) return { hint: 'No times', disabled: true, aria: 'no tee times online' }
  if (!day.open) return { hint: 'Full', disabled: true, aria: 'fully booked' }
  return { hint: `${day.open} open`, disabled: false, aria: `${plural(day.open, 'tee time')} open` }
}

function select(ymd) {
  if (store.selectedDate !== ymd) store.selectedSlot = null
  store.selectedDate = ymd
  emit('next')
}
</script>
