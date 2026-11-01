<template>
  <div class="max-w-5xl">
    <!-- Date navigation -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3">
      <button class="btn-outline-sm" @click="go(addDays(date, -1))">
        ← Previous day
      </button>
      <button class="btn-outline-sm" :disabled="date === today" @click="go(today)">
        Today
      </button>
      <button class="btn-outline-sm" @click="go(addDays(date, 1))">
        Next day →
      </button>
      <input :value="date" type="date" class="input-field" @change="e => e.target.value && go(e.target.value)">
      <div class="ml-auto text-sm text-gray-500 font-body text-right">
        <div class="font-display font-bold text-bark text-lg">
          {{ formatLocalDate(date, { weekday: 'long', month: 'long', day: 'numeric' }) }}
        </div>
        <div v-if="sheet">
          {{ totals.players }} golfers booked · {{ totals.checkedIn }} checked in · {{ totals.open }} open spots
          <span v-if="refreshedAt" class="text-gray-400"> · updated {{ refreshedAt }}</span>
        </div>
        <div v-if="paceSummary" class="text-xs mt-0.5">
          <span :class="paceClass(paceSummary.pace)">{{ paceSummary.text }}</span>
          <RouterLink v-if="authStore.canTrackCourse" to="/staff/oncourse" class="text-pine hover:underline ml-2">
            On Course →
          </RouterLink>
        </div>
      </div>
    </div>

    <p v-if="actionError" class="text-red-500 text-sm font-body mb-3">
      {{ actionError }}
    </p>
    <div v-if="notice" class="bg-pine/10 text-pine text-sm font-body rounded-lg px-4 py-2 mb-3 flex items-start gap-3">
      <span class="flex-1">{{ notice }}</span>
      <button class="text-pine/60 hover:text-pine" aria-label="Dismiss" @click="notice = null">
        ✕
      </button>
    </div>
    <div v-if="loading && !sheet" class="text-gray-400 text-sm">
      Loading…
    </div>
    <div v-else-if="error" class="text-red-500 text-sm">
      {{ error }}
    </div>
    <div v-else-if="sheet && !sheet.slots.length" class="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center text-gray-400 text-sm font-body">
      No tee times are set up for this day. An admin can add them in Admin → Tee Times.
    </div>

    <div v-else-if="sheet" class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div
        v-for="slot in sheet.slots"
        :key="slot.id"
        :class="['flex gap-4 px-4 py-3 font-body', isPast(slot) ? 'bg-gray-50/60' : '']"
      >
        <div class="w-24 flex-shrink-0">
          <div :class="['font-display font-bold text-lg', isPast(slot) ? 'text-gray-400' : 'text-bark']">
            {{ teeTime(slot.startTime) }}
          </div>
          <div class="text-xs" :class="slot.available ? 'text-gray-400' : 'text-clay'">
            {{ slot.available ? `${slot.available} of ${slot.maxPlayers} open` : 'Full' }}
          </div>
          <div v-if="slot.memberOnly" class="text-xs text-lake">
            Members only
          </div>
        </div>

        <div class="flex-1 min-w-0 space-y-2">
          <div
            v-for="b in slot.bookings"
            :key="b.id"
            :class="['flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', inactive(b) || b.holdExpired ? 'opacity-50' : '']"
          >
            <span class="font-semibold text-bark">{{ b.name }}</span>
            <span class="text-gray-500">{{ b.players }} player{{ b.players === 1 ? '' : 's' }}</span>
            <span v-if="b.customer?.isMember" class="badge bg-lake/15 text-lake">Member</span>
            <span :class="['badge', statusBadge(b).class]">{{ statusBadge(b).label }}</span>
            <span v-if="b.checkedInAt" class="badge bg-pine text-parch">✓ Checked in {{ formatClockTime(b.checkedInAt) }}</span>
            <template v-if="b.checkedInAt && b.status === 'CONFIRMED'">
              <span v-if="cartsLabel(b)" class="badge bg-gray-100 text-gray-600">🛺 {{ cartsLabel(b) }}</span>
              <span v-if="b.startHole === 10 || b.roundHoles === 9" class="badge bg-gray-100 text-gray-600">
                {{ b.roundHoles }} holes{{ b.startHole === 10 ? ' from 10' : '' }}
              </span>
              <span v-if="date === today && courseNote(b)" :class="['text-xs', paceClass(courseNote(b).pace)]">
                {{ courseNote(b).text }}
              </span>
            </template>
            <span v-for="r in b.receipts" :key="r.id" class="text-xs text-gray-400">#{{ r.number }}</span>
            <span class="ml-auto flex gap-2">
              <template v-if="b.status === 'CONFIRMED'">
                <button
                  v-if="!b.checkedInAt"
                  class="btn-pine-sm"
                  :disabled="busy === b.id"
                  title="Check the group in and open a register sale for add-ons"
                  @click="openCheckIn(b, slot)"
                >
                  Check in
                </button>
                <template v-else>
                  <button class="btn-outline-xs" @click="openOnRegister(b, slot)">
                    Ring up add-ons
                  </button>
                  <button class="btn-outline-xs" title="Cart numbers, starting hole, 9 or 18 holes" @click="openCheckIn(b, slot)">
                    Carts
                  </button>
                  <button class="btn-outline-xs text-gray-400" :disabled="busy === b.id" @click="undoCheckIn(b)">
                    Undo
                  </button>
                </template>
              </template>
              <template v-if="canChange(b)">
                <button
                  v-if="b.status === 'CONFIRMED'"
                  class="btn-outline-xs"
                  :disabled="busy === b.id"
                  title="Move the booking to another tee time"
                  @click="openMove(b, slot)"
                >
                  Move
                </button>
                <button class="btn-outline-xs text-clay" :disabled="busy === b.id" @click="cancelling = { booking: b, slot }">
                  Cancel
                </button>
              </template>
            </span>
          </div>
          <div v-if="!activeBookings(slot).length" class="text-sm text-gray-300">
            Open
          </div>
        </div>

        <div class="flex-shrink-0 self-center">
          <button
            v-if="slot.available && !isPast(slot)"
            class="btn-outline-xs"
            @click="openBooking(slot)"
          >
            + Book
          </button>
        </div>
      </div>
    </div>
    <p class="text-gray-400 text-xs font-body mt-3">
      Refreshes every 30 seconds. "Check in" records the group's cart numbers and opens the register with the prepaid
      greens fee at $0, so carts, range balls and drinks go on the same ticket. Where checked-in groups are is
      estimated from their tee time until the starter or a marshal updates them on the On Course page. Walk-ins and phone bookings are paid at the register; the booking is
      saved when the sale completes. Unfinished online payments hold their spots for {{ UNPAID_HOLD_MINUTES }} minutes.
      Cancelling or moving a booking never moves money.
    </p>

    <!-- Check in (or change the carts / round of a checked-in group) -->
    <div v-if="checkingIn" class="modal-overlay" @click.self="checkingIn = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">
          {{ checkingIn.booking.checkedInAt ? 'Carts and round' : 'Check in' }} — {{ checkingIn.booking.name }}
        </h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          {{ teeTimeLabel(checkingIn.slot.date, checkingIn.slot.startTime) }} ·
          {{ checkingIn.booking.players }} player{{ checkingIn.booking.players === 1 ? '' : 's' }}
        </p>
        <RoundSetupFields v-model="checkingIn.form" :carts-out="cartsInUse(groups, checkingIn.booking.id)" />
        <p v-if="checkingIn.error" class="text-red-500 text-sm font-body mt-3">
          {{ checkingIn.error }}
        </p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="checkingIn = null">
            Back
          </button>
          <button class="btn-amber px-4 py-2 text-sm" :disabled="busy === checkingIn.booking.id" @click="confirmCheckIn">
            <template v-if="checkingIn.booking.checkedInAt">
              {{ busy === checkingIn.booking.id ? 'Saving…' : 'Save' }}
            </template>
            <template v-else>
              {{ busy === checkingIn.booking.id ? 'Checking in…' : 'Check in and open register' }}
            </template>
          </button>
        </div>
      </div>
    </div>

    <!-- Cancel a booking -->
    <div v-if="cancelling" class="modal-overlay" @click.self="cancelling = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">
          Cancel {{ cancelling.booking.name }}?
        </h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          {{ teeTimeLabel(cancelling.slot.date, cancelling.slot.startTime) }} ·
          {{ cancelling.booking.players }} player{{ cancelling.booking.players === 1 ? '' : 's' }} · {{ statusBadge(cancelling.booking).label }}
        </p>
        <p class="text-sm font-body text-bark bg-amber/10 rounded-lg px-3 py-2">
          {{ moneyNote(cancelling.booking) }}
        </p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="cancelling = null">
            Keep booking
          </button>
          <button class="btn-clay px-4 py-2 text-sm" :disabled="busy === cancelling.booking.id" @click="confirmCancel">
            {{ busy === cancelling.booking.id ? 'Cancelling…' : 'Cancel booking' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Move a booking -->
    <div v-if="moving" class="modal-overlay" @click.self="moving = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">
          Move {{ moving.booking.name }}
        </h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          Now {{ teeTimeLabel(moving.slot.date, moving.slot.startTime) }} ·
          {{ moving.booking.players }} player{{ moving.booking.players === 1 ? '' : 's' }}.
          The price doesn't change<span v-if="moving.booking.source === 'ONLINE'">; the golfer is emailed the new time</span>.
        </p>
        <input v-model="moving.date" type="date" :min="today" class="input-field mb-3" @change="loadMoveSlots">
        <div v-if="moving.loading" class="text-gray-400 text-sm font-body">
          Loading…
        </div>
        <div v-else-if="moving.error" class="text-red-500 text-sm font-body">
          {{ moving.error }}
        </div>
        <div v-else-if="!moveOptions.length" class="text-gray-400 text-sm font-body">
          No tee times left on this day.
        </div>
        <div v-else class="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
          <button
            v-for="opt in moveOptions"
            :key="opt.slot.id"
            type="button"
            :disabled="!!opt.reason"
            :title="opt.reason || ''"
            :class="['rounded-lg border px-2 py-1.5 text-sm font-body text-left disabled:opacity-40',
                     moving.selected === opt.slot.id ? 'bg-pine text-parch border-pine' : 'border-gray-300 text-bark hover:bg-gray-50']"
            @click="moving.selected = opt.slot.id"
          >
            <div class="font-semibold">
              {{ teeTime(opt.slot.startTime) }}
            </div>
            <div class="text-xs opacity-75">
              {{ opt.reason || `${opt.slot.available} open` }}
            </div>
          </button>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="moving = null">
            Back
          </button>
          <button
            class="btn-amber px-4 py-2 text-sm"
            :disabled="!moving.selected || busy === moving.booking.id"
            @click="confirmMove"
          >
            {{ busy === moving.booking.id ? 'Moving…' : 'Move booking' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Walk-in / phone booking -->
    <div v-if="booking" class="modal-overlay" @click.self="booking = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">
          Book {{ teeTime(booking.slot.startTime) }}
        </h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          {{ formatLocalDate(booking.slot.date, { weekday: 'long', month: 'short', day: 'numeric' }) }} ·
          {{ booking.slot.available }} spot{{ booking.slot.available === 1 ? '' : 's' }} open
          <span v-if="booking.slot.memberOnly" class="text-lake"> · members only (attach the member at the register)</span>
        </p>
        <div class="space-y-3">
          <div class="flex rounded-lg border border-gray-300 overflow-hidden w-fit">
            <button
              v-for="opt in SOURCES"
              :key="opt.value"
              type="button"
              :class="['px-3 py-2 text-sm font-body', booking.source === opt.value ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
              @click="booking.source = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <div>
            <label class="label-sm">Players</label>
            <div class="flex gap-2">
              <button
                v-for="n in booking.slot.available"
                :key="n"
                type="button"
                :class="['w-10 h-10 rounded-lg border text-sm font-body', booking.players === n ? 'bg-pine text-parch border-pine' : 'border-gray-300 text-bark hover:bg-gray-50']"
                @click="booking.players = n"
              >
                {{ n }}
              </button>
            </div>
          </div>
          <div>
            <label class="label-sm">Name for the tee sheet</label>
            <input v-model="booking.name" type="text" maxlength="80" class="input-field w-full" placeholder="e.g. Smith party">
            <p class="text-xs text-gray-400 font-body mt-1">
              Or leave blank and attach the customer's account at the register.
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="booking = null">
            Cancel
          </button>
          <button class="btn-amber px-4 py-2 text-sm" @click="startBooking">
            Continue to register
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { localDate, addDays, formatLocalDate, formatClockTime, isValidYmd, localDateTimeToUtc } from '@/lib/timeclock'
import { teeTime, teeTimeLabel, UNPAID_HOLD_MINUTES } from '@/lib/teesheet'
import { formatCents } from '@/lib/money'
import { setRegisterHandoff } from '@/lib/registerHandoff'
import { cartsInUse, coursePace, paceLabel, paceOf, paceProfile, trackedGroups } from '@/lib/pace'
import { useAuthStore } from '@/stores/auth'
import RoundSetupFields from '@/components/oncourse/RoundSetupFields.vue'
import { cartsLabel, setupForm, setupPayload } from '@/components/oncourse/roundSetup'

const SOURCES = [
  { value: 'POS',   label: 'Walk-in' },
  { value: 'PHONE', label: 'Phone booking' },
]
const REFRESH_MS = 30_000

const route  = useRoute()
const router = useRouter()

const today       = localDate()
const sheet       = ref(null)
const loading     = ref(false)
const error       = ref(null)
const actionError = ref(null)
const busy        = ref(null)
const booking     = ref(null)
const refreshedAt = ref(null)
const notice      = ref(null)
const cancelling  = ref(null)   // { booking, slot }
const moving      = ref(null)   // { booking, slot, date, slots, loading, error, selected }
const checkingIn  = ref(null)   // { booking, slot, form, error }
const now         = ref(new Date())
const authStore   = useAuthStore()
let timer = null

const date = computed(() => (isValidYmd(route.query.date) ? route.query.date : today))

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

// Short on-course note for a checked-in group: where it probably is, or when it finished
function courseNote(b) {
  const t = trackById.value.get(b.id)
  if (!t) return null
  if (t.state === 'FINISHED') return { text: `Finished ${formatClockTime(b.finishedAt)}`, pace: null }
  if (t.state === 'DONE') return { text: 'Probably finished', pace: null }
  if (t.state === 'WAITING') return { text: 'Waiting to tee off', pace: null }
  return { text: `Hole ${t.hole}${t.basis === 'REPORTED' ? '' : ' (est.)'} · ${paceLabel(t.deltaMinutes)}`, pace: t.pace }
}

function paceClass(pace) {
  if (pace === 'BEHIND') return 'text-clay font-semibold'
  if (pace === 'AHEAD') return 'text-lake'
  return 'text-gray-500'
}

function openCheckIn(b, slot) {
  checkingIn.value = { booking: b, slot, form: setupForm(b), error: null }
}

// New check-in: saves the carts with the check-in and opens the register. Already checked in: just the carts / round.
async function confirmCheckIn() {
  const { booking: b, slot, form } = checkingIn.value
  busy.value = b.id
  checkingIn.value.error = null
  actionError.value = null
  try {
    if (b.checkedInAt) {
      await apiFetch(`/api/staff/oncourse/${b.id}`, { method: 'POST', body: { action: 'setup', ...setupPayload(form) } })
      checkingIn.value = null
      load({ quiet: true })
    } else {
      await apiFetch(`/api/staff/teesheet/${b.id}`, { method: 'POST', body: { action: 'check_in', ...setupPayload(form) } })
      checkingIn.value = null
      openOnRegister(b, slot)
    }
  } catch (e) {
    if (checkingIn.value) checkingIn.value.error = e.message
    load({ quiet: true })
  } finally {
    busy.value = null
  }
}

const totals = computed(() => {
  const active = (sheet.value?.slots ?? []).flatMap(activeBookings)
  return {
    players: active.reduce((s, b) => s + b.players, 0),
    checkedIn: active.filter(b => b.checkedInAt).reduce((s, b) => s + b.players, 0),
    open: (sheet.value?.slots ?? []).filter(s => !isPast(s)).reduce((s, slot) => s + slot.available, 0),
  }
})

function go(d) {
  router.replace({ query: d === today ? {} : { date: d } })
}

// Bookings taking up spots (the server works this out: unfinished online payments stop after their hold)
function activeBookings(slot) {
  return slot.bookings.filter(b => b.holdsSpot)
}

// Cancel / move: not once the group is checked in (undo first). Unpaid online bookings can be cancelled
// (releasing their spots); register bookings are only PENDING while their card is on the reader.
function canChange(b) {
  if (b.checkedInAt) return false
  return b.status === 'CONFIRMED' || (b.status === 'PENDING' && b.source === 'ONLINE')
}

// Cancelling never refunds: say where the money is and how to refund it
function moneyNote(b) {
  if (b.status === 'PENDING') {
    return "No money was taken. The unfinished online payment is cancelled too, so it can't go through later."
  }
  const receipts = b.receipts.map(r => `#${r.number}`).join(', ')
  if (b.source === 'ONLINE' && b.totalCents > 0) {
    return `Cancelling doesn't refund anything. The golfer paid ${formatCents(b.totalCents)} online; if it should be ` +
      'refunded, ask an admin to refund the payment in the Stripe dashboard (and mark the booking Refunded in Admin → Bookings).' +
      (receipts ? ` Add-ons are on receipt ${receipts} (refund those from Recent sales at the register).` : '')
  }
  if (receipts) {
    return `Cancelling doesn't refund anything. The greens fees are on receipt ${receipts}; to refund them, open the receipt ` +
      'in Recent sales at the register and refund those lines (manager approval).'
  }
  return 'No money is attached to this booking.'
}

async function confirmCancel() {
  const { booking: b, slot } = cancelling.value
  busy.value = b.id
  actionError.value = null
  notice.value = null
  try {
    await apiFetch(`/api/staff/teesheet/${b.id}`, { method: 'POST', body: { action: 'cancel' } })
    // Keep the refund instructions on screen after the dialog closes
    notice.value = `Cancelled ${b.name} at ${teeTimeLabel(slot.date, slot.startTime)}. ${moneyNote(b)}`
  } catch (e) {
    actionError.value = e.message
  } finally {
    busy.value = null
    cancelling.value = null
    load({ quiet: true })
  }
}

// Move: tee times on the chosen day that haven't started, with a reason when one can't take the group
const moveOptions = computed(() => {
  const m = moving.value
  if (!m?.slots) return []
  const member = m.booking.customer?.isMember || m.booking.customer?.role === 'ADMIN'
  return m.slots
    .filter(s => s.id !== m.slot.id && !isPast(s))
    .map(s => ({
      slot: s,
      reason: s.available < m.booking.players
        ? (s.available ? `${s.available} open` : 'Full')
        : (s.memberOnly && !member ? 'Members only' : null),
    }))
})

function openMove(b, slot) {
  moving.value = { booking: b, slot, date: slot.date < today ? today : slot.date, slots: null, loading: false, error: null, selected: null }
  loadMoveSlots()
}

async function loadMoveSlots() {
  const m = moving.value
  if (!m || !isValidYmd(m.date)) return
  m.loading = true
  m.error = null
  m.selected = null
  try {
    m.slots = (await apiFetch(`/api/staff/teesheet?date=${m.date}`)).slots
  } catch (e) {
    m.error = e.message
  } finally {
    m.loading = false
  }
}

async function confirmMove() {
  const m = moving.value
  const target = m.slots.find(s => s.id === m.selected)
  busy.value = m.booking.id
  actionError.value = null
  notice.value = null
  try {
    const res = await apiFetch(`/api/staff/teesheet/${m.booking.id}`, { method: 'POST', body: { action: 'move', teeTimeSlotId: m.selected } })
    notice.value = `Moved ${m.booking.name} to ${teeTimeLabel(target.date, target.startTime)}.` +
      (res.emailError ? ` The email to the golfer didn't send (${res.emailError}); let them know.` : '')
    moving.value = null
    if (target.date !== date.value) go(target.date)
    else load({ quiet: true })
  } catch (e) {
    m.error = e.message
    loadMoveSlots()
  } finally {
    busy.value = null
  }
}

function inactive(b) {
  return b.status === 'CANCELLED' || b.status === 'REFUNDED'
}

// A slot is past once its start time has gone by (course time)
function isPast(slot) {
  return localDateTimeToUtc(slot.date, slot.startTime) < new Date()
}

function statusBadge(b) {
  if (b.status === 'CONFIRMED') {
    if (b.source === 'ONLINE') return { label: 'Paid online', class: 'bg-pine/15 text-pine' }
    return { label: b.source === 'PHONE' ? 'Phone · paid' : 'Walk-in · paid', class: 'bg-pine/15 text-pine' }
  }
  if (b.status === 'PENDING' && b.holdExpired) return { label: 'Payment not finished · released', class: 'bg-gray-100 text-gray-500' }
  if (b.status === 'PENDING') return { label: 'Payment not finished', class: 'bg-amber/20 text-amber-dark' }
  return { label: b.status === 'REFUNDED' ? 'Refunded' : 'Cancelled', class: 'bg-gray-100 text-gray-500' }
}

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

watch(date, () => load())

onMounted(() => {
  load()
  timer = setInterval(() => { if (!document.hidden) load({ quiet: true }) }, REFRESH_MS)
})
onUnmounted(() => clearInterval(timer))

function handoffCustomer(b) {
  return b.customer ? { ...b.customer } : null
}

function openOnRegister(b, slot) {
  setRegisterHandoff({
    kind: 'booking',
    bookingId: b.id,
    label: `Greens fee ${b.source === 'ONLINE' ? 'paid online' : 'paid'} — ${teeTimeLabel(slot.date, slot.startTime)}, ${b.players} player${b.players === 1 ? '' : 's'}`,
    customer: handoffCustomer(b),
  })
  router.push('/staff/register')
}

async function undoCheckIn(b) {
  busy.value = b.id
  actionError.value = null
  try {
    await apiFetch(`/api/staff/teesheet/${b.id}`, { method: 'POST', body: { action: 'undo_check_in' } })
    await load({ quiet: true })
  } catch (e) {
    actionError.value = e.message
  } finally {
    busy.value = null
  }
}

function openBooking(slot) {
  booking.value = { slot, source: 'POS', players: Math.min(slot.available, 4), name: '' }
}

function startBooking() {
  const { slot, source, players, name } = booking.value
  setRegisterHandoff({
    kind: 'newBooking',
    newBooking: { teeTimeSlotId: slot.id, players, name: name.trim(), source },
    label: `Tee time ${teeTimeLabel(slot.date, slot.startTime)} — ${players} player${players === 1 ? '' : 's'} (${source === 'PHONE' ? 'phone booking' : 'walk-in'})`,
  })
  booking.value = null
  router.push('/staff/register')
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.badge          { @apply text-xs px-2 py-0.5 rounded-full whitespace-nowrap; }
.btn-clay       { @apply bg-clay text-parch font-semibold rounded-lg font-body hover:bg-clay/90 transition-colors disabled:opacity-50; }
.btn-pine-sm    { @apply bg-pine text-parch text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-pine/90 transition-colors disabled:opacity-50; }
.btn-outline-xs { @apply border border-gray-300 text-gray-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent; }
</style>
