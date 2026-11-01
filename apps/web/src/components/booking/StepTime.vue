<template>
  <section class="rounded-shape-md bg-surface-container-low shadow-elevation-1" aria-labelledby="step-time-title">
    <div class="px-4 sm:px-6 pt-3 sm:pt-4">
      <div class="flex items-center gap-1 -ml-3">
        <IconButton :icon="IconArrowBack" label="Back to date" @click="emit('back')" />
        <h2
          id="step-time-title"
          data-step-heading
          tabindex="-1"
          class="font-display text-headline-s text-on-surface scroll-mt-24 focus:outline-none focus-visible:outline-none"
        >
          Choose a tee time
        </h2>
      </div>
      <p class="text-body-m text-on-surface-variant mt-1">
        <span class="text-on-surface">{{ dateLong }}</span> · {{ rateLine }}
      </p>

      <!-- Players first: only times with room for the whole group are shown -->
      <div class="mt-5">
        <p class="text-label-l text-on-surface mb-2" aria-hidden="true">Players</p>
        <SegmentedButton
          :model-value="store.players"
          :options="PLAYER_OPTIONS"
          label="Players"
          block
          size="lg"
          @update:model-value="setPlayers"
        />
      </div>

      <div v-if="!loading && !error && visible.length" ref="chipRow" class="mt-4">
        <ChipGroup
          :model-value="store.timeOfDay ?? 'any'"
          type="choice"
          scroll
          label="Time of day"
          :options="timeOptions"
          @update:model-value="v => (store.timeOfDay = v === 'any' ? null : v)"
        />
      </div>
    </div>

    <div class="px-4 sm:px-6 pb-6 pt-2" :aria-busy="loading ? 'true' : undefined">
      <!-- Loading -->
      <div v-if="loading" class="pt-4">
        <Skeleton variant="text" :lines="1" width="30%" label="Loading tee times" />
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-3" aria-hidden="true">
          <Skeleton v-for="n in 10" :key="n" variant="rect" height="56px" />
        </div>
      </div>

      <ErrorBanner v-else-if="error" class="mt-4" :message="error" @retry="load" />

      <!-- Nothing fits this day -->
      <div v-else-if="!visible.length">
        <EmptyState :icon="IconEventBusy" :title="emptyTitle" :message="emptyMessage">
          <template #action>
            <div class="flex flex-col items-center gap-3">
              <AppButton v-if="maxAvailable > 0" variant="tonal" @click="setPlayers(maxAvailable)">
                Show times for {{ plural(maxAvailable, 'player') }}
              </AppButton>
              <template v-if="nextDays.length">
                <p class="text-label-l text-on-surface">Next days with open times</p>
                <ChipGroup
                  :model-value="null"
                  type="choice"
                  label="Next days with open times"
                  :options="nextDays"
                  class="justify-center"
                  @update:model-value="changeDate"
                />
              </template>
              <AppButton v-else variant="text" :icon="IconArrowBack" @click="emit('back')">Pick another day</AppButton>
            </div>
          </template>
        </EmptyState>
      </div>

      <!-- The chosen time of day has nothing, other times do -->
      <EmptyState
        v-else-if="!groups.length"
        compact
        :icon="IconSchedule"
        :title="`No ${groupLabel.toLowerCase()} times for ${plural(store.players, 'player')}`"
        action-label="Show all times"
        @action="store.timeOfDay = null"
      />

      <!-- Times, grouped Morning / Midday / Afternoon under sticky subheads -->
      <template v-else>
        <div v-for="g in groups" :key="g.key" role="group" :aria-labelledby="`tg-${g.key}`" class="mt-2">
          <h3
            :id="`tg-${g.key}`"
            class="sticky top-16 md:top-[72px] z-[1] -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-surface-container-low flex items-baseline gap-2"
          >
            <span class="text-title-s text-on-surface">{{ g.label }}</span>
            <span class="text-body-s text-on-surface-variant">{{ g.range }} · {{ plural(g.slots.length, 'time') }}</span>
          </h3>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-1 pb-3">
            <button
              v-for="slot in g.slots"
              :key="slot.id"
              type="button"
              :aria-pressed="String(store.selectedSlot?.id === slot.id)"
              :aria-label="`${teeTime(slot.startTime)}, ${plural(slot.available, 'spot')} open${slot.memberOnly ? ', members only' : ''}`"
              :class="[
                'state-layer min-h-14 px-1 py-1.5 rounded-shape-sm flex flex-col items-center justify-center cursor-pointer',
                'transition-colors duration-short-4 ease-standard',
                store.selectedSlot?.id === slot.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface border border-outline-variant',
              ]"
              @click="store.selectedSlot = slot"
            >
              <span class="text-title-s tabular-nums whitespace-nowrap" aria-hidden="true">{{ teeTime(slot.startTime) }}</span>
              <span
                :class="['text-label-s', store.selectedSlot?.id === slot.id ? 'text-on-primary' : 'text-on-surface-variant']"
                aria-hidden="true"
              >{{ slot.memberOnly ? 'Members · ' : '' }}{{ plural(slot.available, 'spot') }}</span>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Sticky summary + Continue -->
    <div
      class="sticky bottom-0 z-[2] rounded-b-shape-md bg-surface-container-high border-t border-outline-variant shadow-elevation-2 px-4 sm:px-6 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex items-center gap-3"
    >
      <div class="flex-1 min-w-0" aria-live="polite">
        <p class="text-label-l text-on-surface truncate">
          {{ dateShort }} · {{ store.selectedSlot ? teeTime(store.selectedSlot.startTime) : 'Pick a time' }}
        </p>
        <p class="text-body-s text-on-surface-variant truncate">
          {{ plural(store.players, 'player') }} · {{ formatCents(store.price.totalCents) }}<span class="hidden sm:inline">
            ({{ store.roundHoles }} holes, {{ store.cart ? 'riding' : 'walking' }}; change on the next step)</span>
        </p>
      </div>
      <AppButton variant="gold" size="lg" :disabled="!store.selectedSlot" :trailing-icon="IconArrowForward" @click="emit('next')">
        Continue
      </AppButton>
    </div>
  </section>
</template>

<script setup>
// Booking step 2: players first, then only the times with room for them, grouped by time of day. The summary bar
// at the bottom stays in view while scrolling; Continue goes to Details.
import AppButton from '@/components/ui/AppButton.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { phone } from '@/data/site'
import { formatCents } from '@/lib/money'
import { isWeekendRate } from '@/lib/rates'
import { teeTime } from '@/lib/teesheet'
import { formatLocalDate, localDate, localDateTimeToUtc } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'
import { computed, nextTick, onMounted, ref } from 'vue'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import { TIME_GROUPS, bookingWindow, plural } from './bookingFlow'

const emit = defineEmits(['next', 'back'])
const store = useBookingStore()
const auth = useAuthStore()

const PLAYER_OPTIONS = [1, 2, 3, 4].map(n => ({ value: n, label: String(n) }))

const chipRow = ref(null)
const slots = ref([])
const loading = ref(true)
const error = ref('')

const dateLong = computed(() => (store.selectedDate ? formatLocalDate(store.selectedDate, { weekday: 'long', month: 'long', day: 'numeric' }) : ''))
const dateShort = computed(() => (store.selectedDate ? formatLocalDate(store.selectedDate) : ''))

// "Weekday rates: $20 for 9 holes, $30 for 18, per player"
const rateLine = computed(() => {
  const weekend = store.selectedDate && isWeekendRate(store.selectedDate, store.holidayDates)
  const prefix = weekend ? 'WEEKEND' : 'WEEKDAY'
  const d = cents => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
  return `${weekend ? 'Weekend/holiday' : 'Weekday'} rates: ${d(store.rates[`${prefix}_9`])} for 9 holes, ${d(store.rates[`${prefix}_18`])} for 18, per player`
})

// Today's times that have gone by aren't offered
const upcoming = computed(() => {
  if (store.selectedDate !== localDate()) return slots.value
  const now = Date.now()
  return slots.value.filter(s => localDateTimeToUtc(store.selectedDate, s.startTime).getTime() > now)
})
const visible = computed(() => upcoming.value.filter(s => s.available >= store.players))
const maxAvailable = computed(() => Math.min(4, upcoming.value.reduce((m, s) => Math.max(m, s.available), 0)))

const allGroups = computed(() => TIME_GROUPS
  .map(g => ({ ...g, slots: visible.value.filter(s => g.test(s.startTime)) }))
  .filter(g => g.slots.length))
const groups = computed(() => (store.timeOfDay ? allGroups.value.filter(g => g.key === store.timeOfDay) : allGroups.value))
const groupLabel = computed(() => TIME_GROUPS.find(g => g.key === store.timeOfDay)?.label ?? '')
const timeOptions = computed(() => [
  { value: 'any', label: `Any time (${visible.value.length})` },
  ...TIME_GROUPS.map(g => ({ value: g.key, label: `${g.label} (${allGroups.value.find(a => a.key === g.key)?.slots.length ?? 0})` })),
])

const emptyTitle = computed(() => (maxAvailable.value > 0
  ? `No times for ${plural(store.players, 'player')} on ${dateShort.value}`
  : `No tee times left on ${dateShort.value}`))
const emptyMessage = computed(() => (maxAvailable.value > 0
  ? `The open times have room for up to ${plural(maxAvailable.value, 'player')}. For a bigger group, call ${phone.display}.`
  : `Try another day, or call the pro shop at ${phone.display}.`))

// The next 3 days after this one with open times (from the availability summary)
const nextDays = computed(() => {
  if (!store.availabilityReady || !store.selectedDate) return []
  const { to } = bookingWindow(auth.maxBookDays)
  return Object.entries(store.availability)
    .filter(([ymd, d]) => ymd > store.selectedDate && ymd <= to && d.open > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 3)
    .map(([ymd, d]) => ({ value: ymd, label: `${formatLocalDate(ymd)} · ${d.open} open` }))
})

function setPlayers(n) {
  store.players = n
  if (store.selectedSlot && store.selectedSlot.available < n) store.selectedSlot = null
}

function changeDate(ymd) {
  if (!ymd) return
  store.selectedDate = ymd
  store.selectedSlot = null
  load()
}

async function load() {
  if (!store.selectedDate) return
  loading.value = true
  error.value = ''
  try {
    slots.value = await store.fetchAvailableSlots(store.selectedDate)
    // Coming back to this step: refresh the chosen time's availability, or drop it if it no longer fits
    if (store.selectedSlot) {
      const fresh = slots.value.find(s => s.id === store.selectedSlot.id)
      store.selectedSlot = fresh && fresh.available >= store.players ? fresh : null
    }
  } catch {
    error.value = `Tee times couldn't be loaded. Try again, or call ${phone.display}.`
  } finally {
    loading.value = false
  }
  // A preset time of day (Home search) may sit off-screen in the scrolling chip row
  await nextTick()
  const chosen = chipRow.value?.querySelector('[aria-checked="true"], [aria-pressed="true"]')
  const row = chosen?.parentElement
  if (chosen && row) row.scrollLeft += chosen.getBoundingClientRect().left - row.getBoundingClientRect().left - 16
}

onMounted(() => {
  store.loadRates()
  const { from, to } = bookingWindow(auth.maxBookDays)
  store.loadAvailability(from, to)
  load()
})
</script>
