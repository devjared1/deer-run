<template>
  <div class="bg-surface">
    <PageHero label="Your booking" title-html="Manage your <em>tee time</em>" />

    <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-10 space-y-6">
      <Skeleton v-if="loading" variant="card" label="Loading your booking" />

      <Card v-else-if="error" variant="outlined" padding="lg">
        <EmptyState
          :icon="IconLinkOff"
          title="We couldn't open this booking"
          :message="`${error} Call the pro shop at ${phone.display} if you need help.`"
          action-label="Book a tee time"
          to="/book"
        />
      </Card>

      <template v-else-if="data">
        <Card variant="elevated" padding="lg" tag="section" aria-labelledby="manage-when">
          <div class="flex flex-wrap items-start gap-4">
            <div
              class="flex-shrink-0 w-16 py-2 flex flex-col items-center rounded-shape-sm bg-primary text-on-primary"
              role="img"
              :aria-label="longDate"
            >
              <span class="text-label-m uppercase tracking-widest text-gold-container">{{ formatLocalDate(slot.date, { month: 'short' }) }}</span>
              <span class="font-display text-headline-m leading-none">{{ formatLocalDate(slot.date, { day: 'numeric' }) }}</span>
              <span class="text-label-s">{{ formatLocalDate(slot.date, { weekday: 'short' }) }}</span>
            </div>
            <div class="flex-1 min-w-[12rem]">
              <h2 id="manage-when" class="text-title-l text-on-surface">{{ longDate }} at {{ teeTime(slot.startTime) }}</h2>
              <p class="text-body-m text-on-surface-variant">{{ summary }}</p>
              <p v-if="data.guest.name" class="text-body-m text-on-surface-variant">Booked for {{ data.guest.name }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip size="sm" kind="booking" :status="bookingStatus(data.booking)" />
                <span class="text-body-s text-on-surface-variant">Reference <span class="tracking-widest text-on-surface">{{ reference }}</span></span>
              </div>
            </div>
          </div>

          <p v-if="weather" class="mt-4 flex items-center gap-2 text-body-m text-on-surface">
            <component :is="weather.icon" class="w-5 h-5 flex-none text-on-surface-variant" aria-hidden="true" />
            Forecast: {{ weather.label }}
          </p>

          <div v-if="data.canChange || data.canCancel" class="mt-6 flex flex-wrap gap-3">
            <AppButton v-if="data.canChange" variant="filled" :icon="IconEditCalendar" @click="changing = true">Change time or players</AppButton>
            <AppButton v-if="data.canCancel" variant="outlined" :icon="IconEventBusy" :loading="cancelling" @click="cancel">Cancel tee time</AppButton>
          </div>
          <p v-if="!data.canChange && active" class="mt-4 text-body-m text-on-surface-variant">
            {{ data.changeBlocker }} Call <a :href="`tel:${phone.tel}`" class="text-primary underline">{{ phone.display }}</a>
            for changes.
          </p>
          <ErrorBanner v-if="actionError" class="mt-4" :message="actionError" @dismiss="actionError = null" />
        </Card>

        <p class="text-body-s text-on-surface-variant text-center">
          Anyone with this page's link can change or cancel this booking, so keep the email to yourself.
        </p>
      </template>
    </div>

    <ChangeBookingDialog
      v-if="changing && data"
      :booking="data.booking"
      :token="token"
      @done="onChanged"
      @close="changing = false"
    />
  </div>
</template>

<script setup>
// /booking/:id?t=<token> — the "change or cancel" link in the booking emails, for guests without an account (the
// owner can open it signed in, without the token). GET /api/bookings/:id/manage says what's still allowed; Change uses
// the same dialog as My Account (ChangeBookingDialog), Cancel the same rules (24 hours before the tee time).
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { teeTime } from '@/lib/teesheet'
import { formatLocalDate } from '@/lib/timeclock'
import { phone } from '@/data/site'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import { useForecast } from '@/composables/useForecast'
import { bookingReference } from '@/components/booking/bookingFlow'
import { bookingStatus } from '@/components/ui/statusChips'
import PageHero from '@/components/layout/PageHero.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import ChangeBookingDialog from '@/components/accounts/ChangeBookingDialog.vue'
import IconEditCalendar from '~icons/material-symbols/edit-calendar-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconLinkOff from '~icons/material-symbols/link-off-rounded'
import IconCheck from '~icons/material-symbols/check-circle-rounded'

const route    = useRoute()
const router   = useRouter()
const confirm  = useConfirm()
const snackbar = useSnackbar()
const { forecastFor } = useForecast()

const id    = String(route.params.id)
const token = typeof route.query.t === 'string' ? route.query.t : ''
const query = token ? `?t=${encodeURIComponent(token)}` : ''

const data        = ref(null)
const loading     = ref(true)
const error       = ref(null)
const changing    = ref(false)
const cancelling  = ref(false)
const actionError = ref(null)

const slot = computed(() => data.value.booking.teeTimeSlot)
const active = computed(() => ['PENDING', 'CONFIRMED'].includes(data.value?.booking.status))
const longDate = computed(() => formatLocalDate(slot.value.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))
const reference = computed(() => bookingReference(id))
const weather = computed(() => (data.value && active.value ? forecastFor(slot.value.date) : null))
const summary = computed(() => {
  const b = data.value.booking
  return [
    `${b.players} player${b.players === 1 ? '' : 's'}`,
    `${b.roundHoles ?? 18} holes`,
    b.cartIncluded ? 'cart' : 'walking',
    formatCents(b.totalCents),
    b.holdFeeCents != null && b.balanceDueCents > 0 ? `${formatCents(b.balanceDueCents)} due at the course` : '',
  ].filter(Boolean).join(' · ')
})

async function load() {
  error.value = null
  try {
    data.value = await apiFetch(`/api/bookings/${encodeURIComponent(id)}/manage${query}`)
  } catch (e) {
    error.value = e.status === 403 || e.status === 401 || e.status === 404
      ? 'The link may be incomplete or out of date. Use the newest link from your booking emails.'
      : e.message
  } finally {
    loading.value = false
  }
}

async function cancel() {
  const b = data.value.booking
  const ok = await confirm({
    title: 'Cancel this tee time?',
    message: `${longDate.value} at ${teeTime(slot.value.startTime)}, ${b.players} player${b.players === 1 ? '' : 's'}. ` +
      'Your spot is released and this can\'t be undone.' +
      (b.holdFeeCents != null ? ` The ${formatCents(b.holdFeeCents)} hold fee isn't refunded.` : ` Questions about payment? Call ${phone.display}.`),
    confirmLabel: 'Cancel tee time',
    cancelLabel: 'Keep it',
    destructive: true,
    icon: IconEventBusy,
  })
  if (!ok) return
  cancelling.value = true
  actionError.value = null
  try {
    await apiFetch(`/api/bookings/${encodeURIComponent(id)}${query}`, { method: 'DELETE' })
    snackbar.show({ message: 'Tee time cancelled.', icon: IconCheck })
    await load()
  } catch (e) {
    actionError.value = e.message
  } finally {
    cancelling.value = false
  }
}

function onChanged({ message, tone }) {
  changing.value = false
  snackbar.show({ message, tone, icon: tone ? undefined : IconCheck })
  load()
}

// Back from a bank redirect while paying for a change: finish it
async function finishRedirectedChange() {
  const changeId = route.query.booking_change
  if (typeof changeId !== 'string') return
  router.replace({ query: token ? { t: token } : {} })
  try {
    const res = await apiFetch(`/api/bookings/${encodeURIComponent(id)}/change${query}`, { method: 'POST', body: { action: 'confirm', changeId } })
    if (res.status === 'applied') snackbar.show({ message: res.warning || 'Tee time changed.', icon: res.warning ? undefined : IconCheck })
    else if (res.status === 'processing') snackbar.show({ message: 'Your payment is still processing. We\'ll email you as soon as the change is made.' })
    else snackbar.show({ message: res.error || 'The change couldn\'t be made.', tone: 'error' })
  } catch (e) {
    snackbar.show({ message: e.message, tone: 'error' })
  }
  load()
}

onMounted(async () => {
  await load()
  finishRedirectedChange()
})
</script>
