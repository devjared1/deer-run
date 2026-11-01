<template>
  <form
    class="rounded-shape-lg bg-surface-container-lowest text-on-surface shadow-elevation-3 p-4 sm:p-6"
    aria-labelledby="tee-search-title"
    @submit.prevent="search"
  >
    <h2 id="tee-search-title" class="font-display text-headline-s text-on-surface">Find a tee time</h2>
    <p class="text-body-m text-on-surface-variant mt-1">Book online up to 7 days ahead.</p>

    <!-- Date: the next 7 days as a radiogroup of day tiles -->
    <fieldset class="mt-5">
      <legend class="text-label-l text-on-surface mb-2">Date</legend>
      <div
        ref="dayRow"
        role="radiogroup"
        aria-label="Date"
        class="grid grid-cols-7 gap-1"
        @keydown="onDayKeydown"
      >
        <button
          v-for="d in days"
          :key="d.ymd"
          type="button"
          role="radio"
          :aria-checked="String(d.ymd === date)"
          :aria-label="d.long"
          :tabindex="d.ymd === date ? 0 : -1"
          :class="[
            'state-layer flex flex-col items-center justify-center h-14 rounded-shape-sm border transition-colors duration-short-4 ease-standard',
            d.ymd === date
              ? 'bg-primary text-on-primary border-primary'
              : 'bg-surface text-on-surface border-outline-variant',
          ]"
          @click="date = d.ymd"
        >
          <span :class="['text-label-s uppercase', d.ymd === date ? 'text-on-primary' : 'text-on-surface-variant']">{{ d.weekday }}</span>
          <span class="text-title-m">{{ d.day }}</span>
        </button>
      </div>
    </fieldset>

    <div class="mt-4">
      <p class="text-label-l text-on-surface mb-2" aria-hidden="true">Players</p>
      <SegmentedButton v-model="players" block label="Players" :options="playerOptions" />
    </div>

    <div class="mt-4">
      <p class="text-label-l text-on-surface mb-1" aria-hidden="true">Time of day</p>
      <ChipGroup v-model="time" type="choice" label="Time of day" :options="timeOptions" />
    </div>

    <AppButton type="submit" variant="gold" size="lg" block :icon="IconSearch" class="mt-4">
      Find tee times
    </AppButton>
  </form>
</template>

<script setup>
// Home hero's instant tee time search: date (the next 7 course-local days), players (1–4) and time of day →
// /book?date=YYYY-MM-DD&players=N[&time=morning|midday|afternoon]. BookingWizard reads the query and starts on the
// tee time step.
import AppButton from '@/components/ui/AppButton.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import { addDays, formatLocalDate, localDate } from '@/lib/timeclock'
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import IconSearch from '~icons/material-symbols/search-rounded'

const router = useRouter()
const today = localDate()

const days = Array.from({ length: 7 }, (_, i) => {
  const ymd = addDays(today, i)
  return {
    ymd,
    weekday: i === 0 ? 'Today' : formatLocalDate(ymd, { weekday: 'short' }),
    day: Number(ymd.slice(8)),
    long: `${i === 0 ? 'Today, ' : i === 1 ? 'Tomorrow, ' : ''}${formatLocalDate(ymd, { weekday: 'long', month: 'long', day: 'numeric' })}`,
  }
})
const playerOptions = [1, 2, 3, 4].map(n => ({ value: n, label: String(n) }))
const timeOptions = [
  { value: 'any', label: 'Any time' },
  { value: 'morning', label: 'Morning' },
  { value: 'midday', label: 'Midday' },
  { value: 'afternoon', label: 'Afternoon' },
]

const date = ref(today)
const players = ref(2)
const time = ref('any')

const dayRow = ref(null)
function onDayKeydown(e) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  const edge = { Home: 0, End: days.length - 1 }[e.key]
  if (step === undefined && edge === undefined) return
  e.preventDefault()
  const current = days.findIndex(d => d.ymd === date.value)
  const next = edge ?? (current + step + days.length) % days.length
  date.value = days[next].ymd
  nextTick(() => dayRow.value?.children[next]?.focus())
}

function search() {
  const query = { date: date.value, players: String(players.value) }
  if (time.value !== 'any') query.time = time.value
  router.push({ path: '/book', query })
}
</script>
