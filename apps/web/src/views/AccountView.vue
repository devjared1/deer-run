<template>
  <div>
    <PageHero label="My Account" title-html="Your <em>Account</em>" />

    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 space-y-10 md:space-y-12">
      <!-- Who's signed in -->
      <Card variant="elevated" padding="lg">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4 min-w-0">
            <span class="inline-flex items-center justify-center w-12 h-12 flex-shrink-0 rounded-full bg-primary-container text-on-primary-container" aria-hidden="true">
              <IconPerson class="w-6 h-6" />
            </span>
            <div class="min-w-0">
              <p class="font-display text-headline-s text-on-surface break-words">
                {{ authStore.profile?.name || authStore.profile?.email || 'My account' }}
              </p>
              <p v-if="authStore.profile?.name" class="text-body-m text-on-surface-variant break-all">{{ authStore.profile?.email }}</p>
              <div class="flex flex-wrap items-center gap-2 mt-2">
                <StatusChip v-if="authStore.profile?.role" size="sm" kind="role" :status="authStore.profile.role" />
                <span v-if="membershipLine" class="text-body-m text-on-surface-variant">{{ membershipLine }}</span>
              </div>
            </div>
          </div>
          <AppButton variant="outlined" :icon="IconLogout" @click="logout">Sign out</AppButton>
        </div>
      </Card>

      <HouseAccountPanel />

      <!-- Upcoming bookings -->
      <section aria-labelledby="upcoming-title" :aria-busy="loading ? 'true' : undefined">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="upcoming-title" class="font-display text-headline-s md:text-headline-m text-on-surface">Upcoming tee times</h2>
          <AppButton v-if="!loading && !loadError && upcomingBookings.length" variant="text" to="/book" :icon="IconAdd">Book another</AppButton>
        </div>

        <div v-if="loading" class="space-y-3">
          <Skeleton v-for="n in 2" :key="n" variant="card" :label="n === 1 ? 'Loading your bookings' : ''" />
        </div>

        <ErrorBanner
          v-else-if="loadError"
          title="We couldn't load your bookings"
          :message="loadError"
          :retrying="retrying"
          @retry="load(true)"
        />

        <Card v-else-if="!upcomingBookings.length" variant="outlined">
          <EmptyState
            :icon="IconGolf"
            title="No upcoming tee times"
            message="Pick a day and time, and your booking shows up here."
            action-label="Book a tee time"
            :action-icon="IconEventAvailable"
            to="/book"
          />
        </Card>

        <ul v-else class="space-y-3" role="list">
          <li v-for="b in upcomingBookings" :key="b.id">
            <Card variant="elevated">
              <div class="flex flex-wrap items-center gap-4">
                <div class="flex items-center gap-4 flex-1 min-w-[14rem]">
                  <div class="flex-shrink-0 w-16 py-2 flex flex-col items-center rounded-shape-sm bg-primary text-on-primary" role="img" :aria-label="longDate(b)">
                    <span class="text-label-m uppercase tracking-widest text-gold-container">{{ formatLocalDate(slotDate(b), { month: 'short' }) }}</span>
                    <span class="font-display text-headline-m leading-none">{{ formatLocalDate(slotDate(b), { day: 'numeric' }) }}</span>
                    <span class="text-label-s">{{ formatLocalDate(slotDate(b), { weekday: 'short' }) }}</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-title-l text-on-surface">{{ teeTime(b.teeTimeSlot.startTime) }}</p>
                    <p class="text-body-m text-on-surface-variant">{{ summary(b) }}</p>
                    <StatusChip size="sm" kind="booking" :status="displayStatus(b)" class="mt-2" />
                  </div>
                </div>
                <AppButton
                  v-if="canCancel(b)"
                  variant="outlined"
                  :icon="IconEventBusy"
                  :loading="cancelling === b.id"
                  :disabled="!!cancelling && cancelling !== b.id"
                  class="ml-auto"
                  @click="cancelBooking(b)"
                >
                  Cancel<span class="sr-only"> tee time on {{ longDate(b) }}</span>
                </AppButton>
                <p v-else-if="['PENDING', 'CONFIRMED'].includes(b.status)" class="ml-auto text-body-s text-on-surface-variant max-w-[14rem]">
                  Within 24 hours of the tee time: call {{ phone.display }} to make changes.
                </p>
              </div>
              <ErrorBanner v-if="cancelError?.id === b.id" :message="cancelError.message" class="mt-4" @dismiss="cancelError = null" />
            </Card>
          </li>
        </ul>
      </section>

      <!-- Past and cancelled bookings: quieter surface, full-contrast text -->
      <section v-if="!loading && !loadError && pastBookings.length" aria-labelledby="past-title">
        <h2 id="past-title" class="font-display text-headline-s text-on-surface mb-4">Past &amp; cancelled</h2>
        <Card variant="filled" padding="none">
          <ul class="divide-y divide-outline-variant" role="list">
            <li v-for="b in pastBookings" :key="b.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div class="flex-shrink-0 w-12 py-1 flex flex-col items-center rounded-shape-sm bg-surface-container-lowest text-on-surface" role="img" :aria-label="longDate(b)">
                <span class="text-label-s uppercase text-on-surface-variant">{{ formatLocalDate(slotDate(b), { month: 'short' }) }}</span>
                <span class="font-display text-title-l leading-none">{{ formatLocalDate(slotDate(b), { day: 'numeric' }) }}</span>
              </div>
              <div class="flex-1 min-w-[10rem]">
                <p class="text-title-s text-on-surface">{{ teeTime(b.teeTimeSlot.startTime) }} · {{ formatLocalDate(slotDate(b), { year: 'numeric' }) }}</p>
                <p class="text-body-m text-on-surface-variant">{{ summary(b) }}</p>
              </div>
              <StatusChip size="sm" kind="booking" :status="displayStatus(b)" />
            </li>
          </ul>
        </Card>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { isExpiredHold, teeTime } from '@/lib/teesheet'
import { formatLocalDate, localDate, localDateTimeToUtc } from '@/lib/timeclock'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import { phone } from '@/data/site'
import PageHero from '@/components/layout/PageHero.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import { bookingStatus } from '@/components/ui/statusChips'
import HouseAccountPanel from '@/components/accounts/HouseAccountPanel.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconCheck from '~icons/material-symbols/check-circle-rounded'
import IconEventAvailable from '~icons/material-symbols/event-available-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconLogout from '~icons/material-symbols/logout-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'

const router    = useRouter()
const authStore = useAuthStore()
const confirm   = useConfirm()
const snackbar  = useSnackbar()

const bookings    = ref([])
const loading     = ref(true)
const retrying    = ref(false)
const loadError   = ref(null)
const cancelling  = ref(null)
const cancelError = ref(null) // { id, message } when a cancel fails

// "Premier member through Nov 30, 2027" (the role chip says Member / Guest / Admin)
const membershipLine = computed(() => {
  const p = authStore.profile
  if (p?.role !== 'MEMBER') return ''
  const tier = p.membershipTier ? `${p.membershipTier} member` : ''
  const until = p.memberUntil ? `through ${formatLocalDate(p.memberUntil, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''
  return [tier, until].filter(Boolean).join(' ')
})

// Course-local today; slot dates are YYYY-MM-DD, compared as strings
const today = localDate()
const slotDate = b => String(b.teeTimeSlot.date).slice(0, 10)
const sortKey  = b => `${slotDate(b)} ${b.teeTimeSlot.startTime}`
// An unpaid online booking past its 30-minute hold is released, so it's history, not upcoming
const isReleased = b => isExpiredHold(b)
const displayStatus = b => bookingStatus({ ...b, holdExpired: isReleased(b) })

const upcomingBookings = computed(() =>
  bookings.value
    .filter(b => slotDate(b) >= today && ['PENDING', 'CONFIRMED'].includes(b.status) && !isReleased(b))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
)
const pastBookings = computed(() => {
  const upcoming = new Set(upcomingBookings.value.map(b => b.id))
  return bookings.value.filter(b => !upcoming.has(b.id)).sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
})

// Same rule as DELETE /api/bookings/:id: at least 24 hours before the tee time (course time)
function canCancel(b) {
  const teeTimeAt = localDateTimeToUtc(slotDate(b), b.teeTimeSlot.startTime)
  return ['PENDING', 'CONFIRMED'].includes(b.status) && teeTimeAt.getTime() - Date.now() > 24 * 60 * 60 * 1000
}

function longDate(b) {
  return formatLocalDate(slotDate(b), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function summary(b) {
  return [
    `${b.players} player${b.players === 1 ? '' : 's'}`,
    `${b.roundHoles ?? 18} holes`,
    b.cartIncluded ? 'cart' : '',
    formatCents(b.totalCents),
    // Pay at course: only the hold fee was paid online
    b.holdFeeCents != null && b.status === 'CONFIRMED' && b.balanceDueCents > 0 ? `${formatCents(b.balanceDueCents)} due at the course` : '',
  ].filter(Boolean).join(' · ')
}

async function cancelBooking(b) {
  const when = `${formatLocalDate(slotDate(b), { weekday: 'short', month: 'short', day: 'numeric' })} at ${teeTime(b.teeTimeSlot.startTime)}`
  const ok = await confirm({
    title: 'Cancel this tee time?',
    message: `${when}, ${b.players} player${b.players === 1 ? '' : 's'}. Your spot is released and this can't be undone.` +
      (b.holdFeeCents != null && b.status === 'CONFIRMED'
        ? ` The ${formatCents(b.holdFeeCents)} hold fee isn't refunded.`
        : ` Questions about payment? Call the pro shop at ${phone.display}.`),
    confirmLabel: 'Cancel tee time',
    cancelLabel: 'Keep it',
    destructive: true,
    icon: IconEventBusy,
  })
  if (!ok) return
  const id = b.id
  cancelling.value = id
  cancelError.value = null
  try {
    await apiFetch(`/api/bookings/${id}`, { method: 'DELETE' })
    const row = bookings.value.find(x => x.id === id)
    if (row) row.status = 'CANCELLED'
    snackbar.show({ message: `Tee time on ${when} cancelled.`, icon: IconCheck })
  } catch (e) {
    cancelError.value = {
      id,
      message: e.status
        ? e.message || `Could not cancel this tee time. Please try again or call ${phone.display}.`
        : 'Could not reach the server. Check your connection and try again.',
    }
  } finally {
    cancelling.value = null
  }
}

async function logout() {
  await authStore.logout()
  router.push('/')
}

async function load(retry = false) {
  if (retry) retrying.value = true
  try {
    bookings.value = await apiFetch('/api/bookings/my')
    loadError.value = null
  } catch (e) {
    loadError.value = e.status ? (e.message || 'Please try again.') : 'Check your connection and try again.'
  } finally {
    loading.value = false
    retrying.value = false
  }
}

onMounted(load)
</script>
