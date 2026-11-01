<template>
  <div>
    <PageHero
      label="Tournament Calendar"
      title-html="Events &amp; <em>Tournaments</em>"
      description="From weekly member events to signature charity tournaments. Something for every level of golfer."
      photo="course-2-wide"
    />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16 space-y-12 md:space-y-16">
      <!-- Upcoming -->
      <section aria-labelledby="upcoming-title" :aria-busy="loading ? 'true' : undefined">
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-4">
          <div>
            <p class="text-label-l uppercase tracking-[.2em] text-gold-text">On the calendar</p>
            <h2 id="upcoming-title" class="font-display text-headline-m md:text-headline-l text-on-surface">Upcoming events</h2>
          </div>
          <p v-if="!loading && !error && upcoming.length" class="text-body-m text-on-surface-variant">
            {{ upcomingShown.length === upcoming.length ? `${upcoming.length} event${upcoming.length === 1 ? '' : 's'}` : `${upcomingShown.length} of ${upcoming.length} events` }}
          </p>
        </div>

        <EventFilterBar v-if="!loading && !error && filterOptions.length" v-model="filters" :options="filterOptions" class="mb-6" />

        <!-- Loading -->
        <div v-if="loading" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="n in 3" :key="n" class="rounded-shape-md bg-surface-container-low shadow-elevation-1 overflow-hidden">
            <div class="aspect-[16/9]">
              <Skeleton variant="rect" height="100%" class="h-full [&>div]:rounded-none" :label="n === 1 ? 'Loading events' : ''" />
            </div>
            <div class="p-4 space-y-3">
              <Skeleton variant="rect" width="40%" height="24px" />
              <Skeleton variant="rect" width="80%" height="28px" />
              <Skeleton variant="text" :lines="3" />
            </div>
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="space-y-4">
          <ErrorBanner
            title="We couldn't load the events"
            :message="`Check your connection and try again, or call the pro shop at ${phone.display}.`"
            :retrying="retrying"
            @retry="load(true)"
          />
          <AppButton variant="outlined" :href="`tel:${phone.tel}`" :icon="IconCall">Call {{ phone.display }}</AppButton>
        </div>

        <!-- Nothing scheduled -->
        <Card v-else-if="!upcoming.length" variant="outlined">
          <EmptyState
            :icon="IconEventBusy"
            title="No upcoming events right now"
            message="New tournaments are posted here as soon as they're scheduled. Want to bring your own event to Deer Run?"
            action-label="Ask about hosting an event"
            :action-icon="IconMail"
            to="/contact"
          />
        </Card>

        <!-- Filters match nothing -->
        <Card v-else-if="!upcomingShown.length" variant="outlined">
          <EmptyState
            :icon="IconSearchOff"
            title="No upcoming events match these filters"
            message="Try another filter, or clear them to see every event."
            action-label="Clear filters"
            :action-icon="IconFilterOff"
            @action="filters = []"
          />
        </Card>

        <ul v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
          <li v-for="e in upcomingShown" :key="e.id">
            <EventCard :event="e" />
          </li>
        </ul>
      </section>

      <!-- Past: their own, quieter section (filled cards, grayscale photos; text keeps full contrast) -->
      <section v-if="!loading && !error && pastShown.length" aria-labelledby="past-title" class="rounded-shape-lg bg-surface-container-low p-4 sm:p-6 md:p-8">
        <h2 id="past-title" class="font-display text-headline-s md:text-headline-m text-on-surface">Past events</h2>
        <p class="text-body-m text-on-surface-variant mt-1 mb-6">Recent tournaments at Deer Run, most recent first.</p>
        <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
          <li v-for="e in pastShown" :key="e.id">
            <EventCard :event="e" />
          </li>
        </ul>
      </section>

      <!-- Host an event -->
      <section aria-labelledby="host-title" class="rounded-shape-lg bg-primary text-on-primary on-dark p-6 sm:p-10 text-center">
        <IconTrophy class="w-10 h-10 mx-auto text-gold-container" aria-hidden="true" />
        <p class="text-label-l uppercase tracking-[.2em] text-gold-container mt-3">Host an event</p>
        <h2 id="host-title" class="font-display text-headline-m md:text-headline-l mt-1">Interested in sponsoring a tournament?</h2>
        <p class="text-body-l text-on-primary max-w-xl mx-auto mt-3">
          Corporate sponsorships and custom event packages are available. Contact us to discuss opportunities.
        </p>
        <div class="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          <AppButton variant="gold" size="lg" to="/contact" :icon="IconMail">Get in touch</AppButton>
          <AppButton variant="outlined" size="lg" :href="`tel:${phone.tel}`" :icon="IconCall" class="!text-on-primary !border-on-primary">
            {{ phone.display }}
          </AppButton>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHero from '@/components/layout/PageHero.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EventCard from '@/components/tournament/EventCard.vue'
import EventFilterBar from '@/components/tournament/EventFilterBar.vue'
import { compareEvents, eventFilterOptions, filterEvents, normalizeEvent } from '@/components/tournament/eventDisplay'
import { phone } from '@/data/site'
import { localDate } from '@/lib/timeclock'
import IconCall from '~icons/material-symbols/call-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconFilterOff from '~icons/material-symbols/filter-alt-off-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconSearchOff from '~icons/material-symbols/search-off-rounded'
import IconTrophy from '~icons/material-symbols/trophy-rounded'

const loading  = ref(true)
const retrying = ref(false)
const error    = ref(false)
const rows     = ref([])
const filters  = ref([])

const events = computed(() => {
  const today = localDate()
  return rows.value.map(e => normalizeEvent(e, today))
})
const upcoming = computed(() => events.value.filter(e => !e.past).sort(compareEvents))
const past     = computed(() => events.value.filter(e => e.past).sort((a, b) => compareEvents(b, a)))

// Chips for whatever is upcoming (past events are filtered by the same chips)
const filterOptions = computed(() => eventFilterOptions(upcoming.value))
const active        = computed(() => filters.value.filter(v => filterOptions.value.some(o => o.value === v)))
const upcomingShown = computed(() => filterEvents(upcoming.value, active.value))
const pastShown     = computed(() => filterEvents(past.value, active.value))

async function load(retry = false) {
  if (retry) retrying.value = true
  try {
    const res = await fetch('/api/events')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    rows.value = await res.json()
    error.value = false
  } catch {
    error.value = true
  } finally {
    loading.value = false
    retrying.value = false
  }
}

onMounted(load)
</script>
