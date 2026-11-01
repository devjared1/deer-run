<template>
  <div class="max-w-5xl font-body" :data-contrast="highContrast ? 'high' : undefined">
    <!-- Toolbar: date, high contrast, help -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <DateStepper v-model="dateModel" today class="-ml-3" />
      <div class="flex items-center gap-1 ml-auto">
        <Switch v-model="highContrast" label="High contrast" class="pr-1" />
        <IconButton :icon="IconInfo" label="How the tee sheet works" tooltip @click="helpOpen = true" />
      </div>
    </div>

    <div v-if="sheet" class="mt-2 space-y-1">
      <p class="text-body-l text-on-surface">
        <strong>{{ totals.players }}</strong> golfers booked · <strong>{{ totals.checkedIn }}</strong> checked in ·
        <strong>{{ totals.open }}</strong> open spots
        <span v-if="refreshedAt" class="text-body-m text-on-surface-variant"> · updated {{ refreshedAt }}</span>
      </p>
      <p v-if="paceSummary" class="flex items-start gap-2 text-body-m text-on-surface">
        <component :is="paceIcon(paceSummary.pace)" :class="['w-5 h-5 flex-none', paceIconClass(paceSummary.pace)]" aria-hidden="true" />
        <span class="min-w-0">
          <span :class="paceSummary.pace === 'BEHIND' ? 'font-bold' : ''">{{ paceSummary.text }}</span>
          <RouterLink
            v-if="authStore.canTrackCourse"
            to="/staff/oncourse"
            class="touch-target inline-flex items-center gap-1 ml-2 text-label-l text-primary underline-offset-2 hover:underline"
          >
            On Course
            <IconArrow class="w-4 h-4" aria-hidden="true" />
          </RouterLink>
        </span>
      </p>
    </div>

    <ErrorBanner v-if="actionError" class="mt-4" :message="actionError" @dismiss="actionError = ''" />
    <div
      v-if="notice"
      class="mt-4 flex items-start gap-3 rounded-shape-md bg-secondary-container text-on-secondary-container pl-4 pr-1 py-1"
      role="status"
    >
      <IconInfo class="w-5 h-5 flex-none mt-3" aria-hidden="true" />
      <p class="flex-1 py-2.5 text-body-m">
        {{ notice }}
      </p>
      <IconButton :icon="IconClose" label="Dismiss" variant="inherit" @click="notice = null" />
    </div>

    <div class="mt-4">
      <div v-if="loading && !sheet" class="space-y-3">
        <Skeleton variant="card" label="Loading the tee sheet" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
      <ErrorBanner v-else-if="error" :message="error" @retry="load()" />
      <EmptyState
        v-else-if="sheet && !sheet.slots.length"
        :icon="IconGolfCourse"
        title="No tee times this day"
        message="An admin can add them in Admin → Tee Times."
      />
      <div v-else-if="sheet" class="divide-y divide-outline-variant border-t border-outline-variant">
        <TeeSlotRow
          v-for="slot in sheet.slots"
          :key="slot.id"
          :tee-slot="slot"
          :past="isPast(slot)"
          :note-for="b => (date === today ? courseNote(b) : null)"
          :busy-id="busy"
          @action="(name, b) => onAction(name, b, slot)"
          @book="openBooking(slot)"
        />
      </div>
    </div>

    <!-- Help, behind the info button -->
    <AppDialog v-model:open="helpOpen" title="How the tee sheet works" size="sm">
      <ul class="list-disc pl-5 space-y-2 text-body-m text-on-surface">
        <li>The sheet refreshes every 30 seconds.</li>
        <li>
          <strong>Check in</strong> records the group's carts, starting hole and 9 or 18. Choose
          <strong>No add-ons, done</strong> to finish here, or <strong>Add items at the register</strong> to open a sale
          with the prepaid greens fee at $0, so carts, range balls and drinks go on the same ticket.
        </li>
        <li>
          Where checked-in groups are is estimated from their tee time until the starter or a marshal updates them on
          the On Course page.
        </li>
        <li>
          <strong>Pay at course</strong> bookings paid a non-refundable hold fee online. Checking one in opens the register
          with the balance due; the fee is kept if the booking is cancelled or the group doesn't show.
        </li>
        <li>Walk-ins and phone bookings are paid at the register; the booking is saved when the sale completes.</li>
        <li>Unfinished online payments hold their spots for {{ UNPAID_HOLD_MINUTES }} minutes.</li>
        <li>Cancelling or moving a booking never moves money.</li>
      </ul>
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">
          Got it
        </AppButton>
      </template>
    </AppDialog>

    <CheckInSheet
      v-model:open="checkInOpen"
      v-model:form="checkInForm"
      :booking="checkingIn?.booking ?? null"
      :tee-slot="checkingIn?.slot ?? null"
      :carts-out="checkingIn ? cartsInUse(groups, checkingIn.booking.id) : undefined"
      :busy="checkInBusy"
      :error="checkInError"
      @submit="confirmCheckIn"
      @after-leave="checkingIn = null"
    />

    <MoveBookingDialog
      v-model:open="moveOpen"
      :booking="moving?.booking ?? null"
      :tee-slot="moving?.slot ?? null"
      @moved="onMoved"
      @after-leave="moving = null"
    />

    <NewBookingDialog
      v-model:open="bookOpen"
      :tee-slot="bookSlot"
      @submit="startBooking"
      @after-leave="bookSlot = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { localDate, formatClockTime, isValidYmd, localDateTimeToUtc } from '@/lib/timeclock'
import { balanceDue, bookingLineDescription, teeTimeLabel, UNPAID_HOLD_MINUTES } from '@/lib/teesheet'
import { setRegisterHandoff } from '@/lib/registerHandoff'
import { cartsInUse, coursePace, paceLabel, paceOf, paceProfile, trackedGroups } from '@/lib/pace'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import { useHighContrast } from '@/composables/useHighContrast'
import { setupForm, setupPayload } from '@/components/oncourse/roundSetup'
import { bookingChip, moneyNote, playersText } from '@/components/teesheet/teeSheetDisplay'
import TeeSlotRow from '@/components/teesheet/TeeSlotRow.vue'
import CheckInSheet from '@/components/teesheet/CheckInSheet.vue'
import MoveBookingDialog from '@/components/teesheet/MoveBookingDialog.vue'
import NewBookingDialog from '@/components/teesheet/NewBookingDialog.vue'
import DateStepper from '@/components/ui/DateStepper.vue'
import Switch from '@/components/ui/Switch.vue'
import IconButton from '@/components/ui/IconButton.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import IconInfo from '~icons/material-symbols/info-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconArrow from '~icons/material-symbols/arrow-forward-rounded'
import IconGolfCourse from '~icons/material-symbols/golf-course-rounded'
import IconAhead from '~icons/material-symbols/trending-up-rounded'
import IconBehind from '~icons/material-symbols/trending-down-rounded'
import IconOnPace from '~icons/material-symbols/trending-flat-rounded'
import IconCancel from '~icons/material-symbols/cancel-rounded'
import IconUndo from '~icons/material-symbols/undo-rounded'

const REFRESH_MS = 30_000

const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()
const confirm   = useConfirm()
const snackbar  = useSnackbar()
const { highContrast } = useHighContrast()

const today       = localDate()
const sheet       = ref(null)
const loading     = ref(false)
const error       = ref(null)
const actionError = ref('')
const busy        = ref(null)    // booking id with a request in flight
const refreshedAt = ref(null)
const notice      = ref(null)    // stays until dismissed (refund instructions after a cancel, move result)
const helpOpen    = ref(false)
const now         = ref(new Date())
let timer = null

// Check-in / carts and round (CheckInSheet)
const checkingIn   = ref(null)   // { booking, slot }
const checkInOpen  = ref(false)
const checkInForm  = ref(null)
const checkInBusy  = ref(null)   // 'done' | 'register' | 'save'
const checkInError = ref('')

const moving   = ref(null)       // { booking, slot }
const moveOpen = ref(false)
const bookSlot = ref(null)
const bookOpen = ref(false)

const date = computed(() => (isValidYmd(route.query.date) ? route.query.date : today))
const dateModel = computed({ get: () => date.value, set: go })

// On-course estimates for the checked-in groups (src/lib/pace.js); only meaningful for today
const groups = computed(() => trackedGroups(sheet.value?.slots, paceProfile(sheet.value), now.value))
const trackById = computed(() => new Map(groups.value.map(g => [g.booking.id, g.track])))

const paceSummary = computed(() => {
  if (date.value !== today || !groups.value.length) return null
  const pace = coursePace(groups.value.map(g => g.track), now.value)
  const parts = [`${pace.groupsOut} group${pace.groupsOut === 1 ? '' : 's'} on the course`]
  if (pace.deltaMinutes != null) parts.push(`running ${paceLabel(pace.deltaMinutes).toLowerCase()}`)
  if (pace.firstTeeLateMinutes > 0) parts.push(`first tee ${pace.firstTeeLateMinutes} min late`)
  return { text: parts.join(' · '), pace: pace.deltaMinutes == null ? null : paceOf(pace.deltaMinutes) }
})

function paceIcon(pace) {
  if (pace === 'BEHIND') return IconBehind
  if (pace === 'AHEAD') return IconAhead
  return IconOnPace
}
function paceIconClass(pace) {
  if (pace === 'BEHIND') return 'text-error'
  if (pace === 'AHEAD') return 'text-secondary'
  return 'text-on-surface-variant'
}

// Short on-course note for a checked-in group: where it probably is, or when it finished
function courseNote(b) {
  const t = trackById.value.get(b.id)
  if (!t) return null
  if (t.state === 'FINISHED') return { text: `Finished ${formatClockTime(b.finishedAt)}`, pace: null, state: t.state }
  if (t.state === 'DONE') return { text: 'Probably finished', pace: null, state: t.state }
  if (t.state === 'WAITING') return { text: 'Waiting to tee off', pace: null, state: t.state }
  return { text: `Hole ${t.hole}${t.basis === 'REPORTED' ? '' : ' (est.)'} · ${paceLabel(t.deltaMinutes)}`, pace: t.pace, state: t.state }
}

const totals = computed(() => {
  const slots = sheet.value?.slots ?? []
  const active = slots.flatMap(s => s.bookings.filter(b => b.holdsSpot))
  return {
    players: active.reduce((s, b) => s + b.players, 0),
    checkedIn: active.filter(b => b.checkedInAt).reduce((s, b) => s + b.players, 0),
    open: slots.filter(s => !isPast(s)).reduce((s, slot) => s + slot.available, 0),
  }
})

function go(d) {
  router.replace({ query: d === today ? {} : { date: d } })
}

// A slot is past once its start time has gone by (course time)
function isPast(slot) {
  return localDateTimeToUtc(slot.date, slot.startTime) < now.value
}

function onAction(name, b, slot) {
  if (name === 'check-in' || name === 'setup') openCheckIn(b, slot)
  else if (name === 'register') openOnRegister(b, slot)
  else if (name === 'undo') undoCheckIn(b)
  else if (name === 'move') openMove(b, slot)
  else if (name === 'cancel') cancelBooking(b, slot)
}

// ── Check-in ──
function openCheckIn(b, slot) {
  checkingIn.value = { booking: b, slot }
  checkInForm.value = setupForm(b)
  checkInError.value = ''
  checkInBusy.value = null
  checkInOpen.value = true
}

// mode 'save': a checked-in group's carts / round. 'done': check in and stay here. 'register': check in and open
// the register with the prepaid greens fee at $0 for add-ons (or the pay-at-course balance).
async function confirmCheckIn(mode) {
  const { booking: b, slot } = checkingIn.value
  busy.value = b.id
  checkInBusy.value = mode
  checkInError.value = ''
  actionError.value = ''
  try {
    if (mode === 'save') {
      await apiFetch(`/api/staff/oncourse/${b.id}`, { method: 'POST', body: { action: 'setup', ...setupPayload(checkInForm.value) } })
      checkInOpen.value = false
      snackbar.show(`Saved carts and round for ${b.name}`)
      load({ quiet: true })
    } else {
      await apiFetch(`/api/staff/teesheet/${b.id}`, { method: 'POST', body: { action: 'check_in', ...setupPayload(checkInForm.value) } })
      checkInOpen.value = false
      if (mode === 'register') {
        openOnRegister(b, slot)
      } else {
        snackbar.show({ message: `Checked in ${b.name}`, actionLabel: 'Undo', onAction: () => undoCheckIn(b, { ask: false }) })
        load({ quiet: true })
      }
    }
  } catch (e) {
    checkInError.value = e.message
    load({ quiet: true })
  } finally {
    busy.value = null
    checkInBusy.value = null
  }
}

async function undoCheckIn(b, { ask = true } = {}) {
  if (ask) {
    const ok = await confirm({
      title: `Undo check-in for ${b.name}?`,
      message: 'The group goes back to not checked in. Its tee-off, position updates and finish are cleared; the cart numbers are kept.',
      confirmLabel: 'Undo check-in',
      cancelLabel: 'Keep checked in',
      icon: IconUndo,
    })
    if (!ok) return
  }
  busy.value = b.id
  actionError.value = ''
  try {
    await apiFetch(`/api/staff/teesheet/${b.id}`, { method: 'POST', body: { action: 'undo_check_in' } })
    snackbar.show(`Check-in undone for ${b.name}`)
    await load({ quiet: true })
  } catch (e) {
    actionError.value = e.message
  } finally {
    busy.value = null
  }
}

// ── Cancel (never refunds: the confirm says where the money is) ──
async function cancelBooking(b, slot) {
  const ok = await confirm({
    title: `Cancel ${b.name}?`,
    message: `${teeTimeLabel(slot.date, slot.startTime)} · ${playersText(b.players)} · ${bookingChip(b).label}. ${moneyNote(b)}`,
    confirmLabel: 'Cancel booking',
    cancelLabel: 'Keep booking',
    destructive: true,
    icon: IconCancel,
  })
  if (!ok) return
  busy.value = b.id
  actionError.value = ''
  notice.value = null
  try {
    await apiFetch(`/api/staff/teesheet/${b.id}`, { method: 'POST', body: { action: 'cancel' } })
    // Keep the refund instructions on screen after the dialog closes
    notice.value = `Cancelled ${b.name} at ${teeTimeLabel(slot.date, slot.startTime)}. ${moneyNote(b)}`
  } catch (e) {
    actionError.value = e.message
  } finally {
    busy.value = null
    load({ quiet: true })
  }
}

// ── Move ──
function openMove(b, slot) {
  moving.value = { booking: b, slot }
  moveOpen.value = true
}

function onMoved({ target, emailError }) {
  const b = moving.value.booking
  notice.value = `Moved ${b.name} to ${teeTimeLabel(target.date, target.startTime)}.` +
    (emailError ? ` The email to the golfer didn't send (${emailError}); let them know.` : '')
  moveOpen.value = false
  if (target.date !== date.value) go(target.date)
  else load({ quiet: true })
}

// ── Register handoff ──
function openOnRegister(b, slot) {
  setRegisterHandoff({
    kind: 'booking',
    bookingId: b.id,
    label: bookingLineDescription(b, slot),
    // Pay at course: the register charges the balance on the booking line (the server checks it's still owed)
    balanceCents: balanceDue(b),
    customer: b.customer ? { ...b.customer } : null,
  })
  router.push('/staff/register')
}

function openBooking(slot) {
  bookSlot.value = slot
  bookOpen.value = true
}

function startBooking({ slot, source, players, name }) {
  setRegisterHandoff({
    kind: 'newBooking',
    newBooking: { teeTimeSlotId: slot.id, players, name, source },
    label: `Tee time ${teeTimeLabel(slot.date, slot.startTime)} — ${playersText(players)} (${source === 'PHONE' ? 'phone booking' : 'walk-in'})`,
  })
  bookOpen.value = false
  router.push('/staff/register')
}

// ── Loading ──
async function load({ quiet = false } = {}) {
  if (!quiet) loading.value = true
  error.value = null
  try {
    sheet.value = await apiFetch(`/api/staff/teesheet?date=${date.value}`)
    now.value = new Date()
    refreshedAt.value = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch (e) {
    if (!quiet) error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(date, () => { sheet.value = null; load() })

onMounted(() => {
  load()
  timer = setInterval(() => { if (!document.hidden) load({ quiet: true }) }, REFRESH_MS)
})
onUnmounted(() => clearInterval(timer))
</script>
