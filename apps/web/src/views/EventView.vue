<template>
  <div>
    <!-- Loading -->
    <template v-if="loading">
      <div class="bg-primary min-h-[250px]" aria-hidden="true" />
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="space-y-4">
          <Skeleton variant="rect" height="160px" label="Loading the event" />
          <Skeleton variant="text" :lines="4" />
        </div>
        <Skeleton variant="rect" height="360px" />
      </div>
    </template>

    <!-- Not found -->
    <section v-else-if="notFound" class="max-w-2xl mx-auto px-4 sm:px-6 py-16 md:py-24" aria-labelledby="not-found-title">
      <h1 id="not-found-title" class="sr-only">Event not found</h1>
      <EmptyState
        :icon="IconEventBusy"
        title="We couldn't find that event"
        message="It may have been removed, or the link may be mistyped. Every scheduled tournament is on the events page."
        action-label="See all events"
        :action-icon="IconTrophy"
        to="/tournaments"
      />
    </section>

    <!-- Error -->
    <section v-else-if="error" class="max-w-2xl mx-auto px-4 sm:px-6 py-16 space-y-4">
      <h1 class="font-display text-headline-m text-on-surface">Tournament details</h1>
      <ErrorBanner
        title="We couldn't load this event"
        :message="`Check your connection and try again, or call the pro shop at ${phone.display}.`"
        :retrying="retrying"
        @retry="load(true)"
      />
      <AppButton variant="text" to="/tournaments" :icon="IconArrowBack">All events</AppButton>
    </section>

    <template v-else-if="event">
      <PageHero
        :label="event.past ? 'Past event' : event.memberOnly ? 'Members-only event' : 'Tournament'"
        :title-html="escapeHtml(event.name)"
        :description="heroLine"
        :photo="event.photo"
      />

      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <AppButton variant="text" to="/tournaments" :icon="IconArrowBack" class="-ml-3 mb-4">All events</AppButton>

        <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <!-- Details -->
          <div class="space-y-8 min-w-0">
            <Card variant="elevated" padding="lg">
              <div class="flex flex-col sm:flex-row gap-6">
                <EventDateBlock
                  class="self-start"
                  size="lg"
                  :month="event.month"
                  :day="event.day"
                  :year="event.year"
                  :label="event.dateLabel"
                  :muted="event.past"
                />
                <dl class="flex-1 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div v-for="d in details" :key="d.label" class="flex gap-3 min-w-0">
                    <component :is="d.icon" class="w-6 h-6 flex-shrink-0 text-on-surface-variant" aria-hidden="true" />
                    <div class="min-w-0">
                      <dt class="text-label-m uppercase tracking-wider text-on-surface-variant">{{ d.label }}</dt>
                      <dd class="text-body-l text-on-surface break-words">{{ d.value }}</dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div class="flex flex-wrap gap-2 mt-6">
                <StatusChip v-if="event.past" label="This event has ended" tone="neutral" icon="flag" />
                <StatusChip v-if="event.memberOnly" label="Members only" tone="primary" icon="member" />
                <StatusChip v-if="event.featured && !event.past" label="Featured" tone="info" :icon="IconStar" />
              </div>
            </Card>

            <section v-if="event.description" aria-labelledby="about-title">
              <h2 id="about-title" class="font-display text-headline-s text-on-surface mb-3">About this event</h2>
              <p class="text-body-l text-on-surface-variant whitespace-pre-line max-w-prose">{{ event.description }}</p>
            </section>

            <div class="flex flex-wrap gap-3">
              <template v-if="!event.past">
                <AppButton variant="tonal" :icon="IconCalendarAdd" @click="downloadIcs">Add to calendar</AppButton>
                <AppButton variant="outlined" :href="googleUrl" target="_blank" rel="noopener" :trailing-icon="IconOpenInNew">
                  Google Calendar<span class="sr-only"> (opens in a new tab)</span>
                </AppButton>
              </template>
              <AppButton variant="outlined" :icon="IconShare" @click="share">Share</AppButton>
            </div>
          </div>

          <!-- Registration -->
          <aside aria-labelledby="register-title" class="lg:sticky lg:top-24">
            <Card variant="outlined" padding="lg">
              <template v-if="event.past">
                <h2 id="register-title" class="text-title-l text-on-surface">This event has ended</h2>
                <p class="text-body-m text-on-surface-variant mt-2">
                  Registration is closed. See what's coming up next on the calendar.
                </p>
                <AppButton variant="filled" to="/tournaments" :icon="IconTrophy" class="mt-4">Upcoming events</AppButton>
              </template>

              <template v-else-if="event.memberOnly && !canRegisterAsMember">
                <h2 id="register-title" class="text-title-l text-on-surface">Members only</h2>
                <p v-if="!auth.isLoggedIn" class="text-body-m text-on-surface-variant mt-2">
                  This event is for Deer Run members. Members, sign in to register here, or call the pro shop to sign up.
                </p>
                <p v-else class="text-body-m text-on-surface-variant mt-2">
                  This event is for Deer Run members. Ask about membership, or call the pro shop with questions.
                </p>
                <div class="flex flex-col gap-3 mt-4">
                  <AppButton v-if="!auth.isLoggedIn" variant="filled" :to="{ path: '/login', query: { redirect: route.fullPath } }" :icon="IconLogin" block>
                    Sign in to register
                  </AppButton>
                  <AppButton v-else variant="filled" to="/memberships" :icon="IconMember" block>About memberships</AppButton>
                  <AppButton variant="outlined" :href="`tel:${phone.tel}`" :icon="IconCall" block>Call {{ phone.display }}</AppButton>
                </div>
              </template>

              <template v-else>
                <h2 id="register-title" class="text-title-l text-on-surface">Request a spot</h2>
                <p class="text-body-m text-on-surface-variant mt-1 mb-5">
                  <template v-if="event.memberOnly">This is a members-only event. </template>
                  Send your details and the pro shop will be in touch, or call
                  <a :href="`tel:${phone.tel}`" class="text-primary underline underline-offset-2 whitespace-nowrap">{{ phone.display }}</a>.
                </p>
                <EventRegistrationForm :event="event" />
              </template>
            </Card>
          </aside>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
// One tournament (/tournaments/:id, GET /api/events/:id): details, a decorative course photo, a registration
// request form (POST /api/inquiries/contact), Add to calendar (.ics / Google), Share, and schema.org Event JSON-LD.
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import PageHero from '@/components/layout/PageHero.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import EventDateBlock from '@/components/tournament/EventDateBlock.vue'
import EventRegistrationForm from '@/components/tournament/EventRegistrationForm.vue'
import {
  eventIcs, eventIcsFilename, eventJsonLd, eventUrl, googleCalendarUrl, normalizeEvent,
} from '@/components/tournament/eventDisplay'
import { useSnackbar } from '@/composables/useSnackbar'
import { courseName, phone } from '@/data/site'
import { useAuthStore } from '@/stores/auth'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconCalendarAdd from '~icons/material-symbols/calendar-add-on-rounded'
import IconCall from '~icons/material-symbols/call-rounded'
import IconEvent from '~icons/material-symbols/event-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconGolf from '~icons/material-symbols/sports-golf-rounded'
import IconGroup from '~icons/material-symbols/group-rounded'
import IconLink from '~icons/material-symbols/link-rounded'
import IconLogin from '~icons/material-symbols/login-rounded'
import IconMember from '~icons/material-symbols/card-membership-rounded'
import IconOpenInNew from '~icons/material-symbols/open-in-new-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconShare from '~icons/material-symbols/share-rounded'
import IconStar from '~icons/material-symbols/star-rounded'
import IconTrophy from '~icons/material-symbols/trophy-rounded'

const route = useRoute()
const auth = useAuthStore()
const snackbar = useSnackbar()

const loading = ref(true)
const retrying = ref(false)
const error = ref(false)
const notFound = ref(false)
const row = ref(null)

const event = computed(() => (row.value ? normalizeEvent(row.value) : null))
const canRegisterAsMember = computed(() => auth.isMember || auth.isAdmin)
const googleUrl = computed(() => (event.value ? googleCalendarUrl(event.value) : '#'))

const heroLine = computed(() => {
  const e = event.value
  return [e.dateLabel, e.timeLabel, e.format].filter(Boolean).join(' · ')
})

const details = computed(() => {
  const e = event.value
  return [
    { label: 'Date', value: e.dateLabel, icon: IconEvent },
    e.timeLabel && { label: 'Start', value: e.timeLabel, icon: IconSchedule },
    e.format && { label: 'Format', value: e.format, icon: IconGolf },
    { label: 'Entry', value: e.entryLabel ?? 'Ask the pro shop', icon: IconPayments },
    { label: 'Field', value: e.spotsLabel, icon: IconGroup },
  ].filter(Boolean)
})

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

async function load(retry = false) {
  const id = route.params.id
  if (retry) retrying.value = true
  else loading.value = true
  notFound.value = false
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(id)}`)
    if (res.status === 404) {
      row.value = null
      notFound.value = true
    } else if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    } else {
      row.value = await res.json()
    }
    error.value = false
  } catch {
    error.value = true
  } finally {
    loading.value = false
    retrying.value = false
  }
}

// Also reloads when going from one event page straight to another
watch(() => route.params.id, (id) => { if (id) load() }, { immediate: true })

function downloadIcs() {
  const blob = new Blob([eventIcs(event.value)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = eventIcsFilename(event.value)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url)
    snackbar.show({ message: 'Link copied', icon: IconLink })
  } catch {
    snackbar.show({ message: `Couldn't copy the link. It's ${url}`, tone: 'error', duration: 8000 })
  }
}

async function share() {
  const e = event.value
  const url = eventUrl(e)
  if (navigator.share) {
    try {
      await navigator.share({ title: e.name, text: `${e.name} at ${courseName}, ${e.dateLabel}`, url })
    } catch (err) {
      // Closing the share sheet is a choice, not an error
      if (err?.name !== 'AbortError') await copyLink(url)
    }
    return
  }
  await copyLink(url)
}

// Title, description and the schema.org Event (only once the event has loaded)
useHead({
  title: computed(() => (event.value ? `${event.value.name} · ${courseName}` : notFound.value ? `Event not found · ${courseName}` : `Event · ${courseName}`)),
  meta: computed(() => (event.value?.description
    ? [{ name: 'description', content: event.value.description.replace(/\s+/g, ' ').slice(0, 160) }]
    : [])),
  script: computed(() => (event.value
    ? [{ key: 'event-jsonld', type: 'application/ld+json', textContent: JSON.stringify(eventJsonLd(event.value)) }]
    : [])),
})
</script>
