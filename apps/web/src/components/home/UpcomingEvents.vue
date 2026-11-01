<template>
  <!-- Hidden when the events can't be loaded: the rest of the page doesn't depend on them -->
  <section v-if="state !== 'error'" class="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20" aria-labelledby="events-title">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-label-l uppercase tracking-[.2em] text-gold-text">On the calendar</p>
        <h2 id="events-title" class="mt-2 font-display text-headline-m md:text-headline-l text-on-surface">
          Upcoming <em class="italic">events</em>
        </h2>
      </div>
      <AppButton v-if="state === 'ready' && events.length" to="/tournaments" variant="text" :trailing-icon="IconArrowForward">
        All tournaments
      </AppButton>
    </div>

    <div v-if="state === 'loading'" class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="status">
      <span class="sr-only">Loading events</span>
      <Skeleton v-for="n in 3" :key="n" variant="rect" height="148px" :class="n === 3 ? 'md:hidden lg:block' : ''" />
    </div>

    <ul v-else-if="events.length" class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <li v-for="e in events" :key="e.id">
        <Card :to="`/tournaments/${e.id}`" variant="outlined" padding="lg" class="h-full">
          <div class="flex gap-4">
            <div class="self-start flex-shrink-0 w-16 rounded-shape-sm bg-primary text-on-primary text-center py-2" aria-hidden="true">
              <div class="text-label-m uppercase tracking-wider">{{ e.month }}</div>
              <div class="font-display text-headline-m leading-none mt-1">{{ e.day }}</div>
            </div>
            <div class="min-w-0">
              <p class="text-label-m text-on-surface-variant">
                <span class="sr-only">{{ e.longDate }}</span>
                <span aria-hidden="true">{{ e.weekday }}</span>
                <template v-if="e.startTime"> · {{ e.startTime }}</template>
              </p>
              <h3 class="mt-1 font-display text-headline-s text-on-surface">{{ e.name }}</h3>
              <p v-if="e.format" class="mt-1 text-body-m text-on-surface-variant">{{ e.format }}</p>
              <p v-if="e.memberOnly" class="mt-2 inline-flex rounded-shape-sm bg-gold-container text-on-gold-container px-2 py-0.5 text-label-m">
                Members only
              </p>
            </div>
          </div>
        </Card>
      </li>
    </ul>

    <EmptyState
      v-else
      :icon="IconTrophy"
      title="No events on the calendar yet"
      message="New tournaments are posted on the Tournaments page."
      action-label="See tournaments"
      to="/tournaments"
      class="mt-8 rounded-shape-md bg-surface-container-low"
    />
  </section>
</template>

<script setup>
// The next three upcoming events from GET /api/events?past=false, linking to /tournaments/:id.
// Loading: skeletons. None: an empty state with a link to /tournaments. API error: the section hides itself.
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { formatLocalDate, localDate } from '@/lib/timeclock'
import { onMounted, ref } from 'vue'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconTrophy from '~icons/material-symbols/trophy-rounded'

const state = ref('loading') // loading | ready | error
const events = ref([])

onMounted(async () => {
  try {
    const res = await fetch('/api/events?past=false')
    if (!res.ok) throw new Error('events')
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('events')
    const today = localDate()
    events.value = data
      // eventDate is a timestamp at midnight with no zone: its first 10 characters are the event's date
      .map(e => ({ ...e, ymd: String(e.eventDate ?? '').slice(0, 10) }))
      .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.ymd) && e.ymd >= today)
      .sort((a, b) => a.ymd.localeCompare(b.ymd))
      .slice(0, 3)
      .map(e => ({
        ...e,
        month: formatLocalDate(e.ymd, { month: 'short' }),
        day: Number(e.ymd.slice(8)),
        weekday: formatLocalDate(e.ymd, { weekday: 'long' }) + (e.ymd.slice(0, 4) === today.slice(0, 4) ? '' : `, ${e.ymd.slice(0, 4)}`),
        longDate: formatLocalDate(e.ymd, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      }))
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})
</script>
