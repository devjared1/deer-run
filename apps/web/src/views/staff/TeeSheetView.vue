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
      </div>
    </div>

    <p v-if="actionError" class="text-red-500 text-sm font-body mb-3">
      {{ actionError }}
    </p>
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
            :class="['flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', inactive(b) ? 'opacity-50' : '']"
          >
            <span class="font-semibold text-bark">{{ b.name }}</span>
            <span class="text-gray-500">{{ b.players }} player{{ b.players === 1 ? '' : 's' }}</span>
            <span v-if="b.customer?.isMember" class="badge bg-lake/15 text-lake">Member</span>
            <span :class="['badge', statusBadge(b).class]">{{ statusBadge(b).label }}</span>
            <span v-if="b.checkedInAt" class="badge bg-pine text-parch">✓ Checked in {{ formatClockTime(b.checkedInAt) }}</span>
            <span v-for="r in b.receipts" :key="r.id" class="text-xs text-gray-400">#{{ r.number }}</span>
            <span class="ml-auto flex gap-2">
              <template v-if="b.status === 'CONFIRMED'">
                <button
                  v-if="!b.checkedInAt"
                  class="btn-pine-sm"
                  :disabled="busy === b.id"
                  title="Check the group in and open a register sale for add-ons"
                  @click="checkIn(b, slot)"
                >
                  Check in
                </button>
                <template v-else>
                  <button class="btn-outline-xs" @click="openOnRegister(b, slot)">
                    Ring up add-ons
                  </button>
                  <button class="btn-outline-xs text-gray-400" :disabled="busy === b.id" @click="undoCheckIn(b)">
                    Undo
                  </button>
                </template>
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
      Refreshes every 30 seconds. "Check in" opens the register with the prepaid greens fee at $0, so carts, range
      balls and drinks go on the same ticket. Walk-ins and phone bookings are paid at the register; the booking is
      saved when the sale completes.
    </p>

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
import { teeTime, teeTimeLabel } from '@/lib/teesheet'
import { setRegisterHandoff } from '@/lib/registerHandoff'

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
let timer = null

const date = computed(() => (isValidYmd(route.query.date) ? route.query.date : today))

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

function activeBookings(slot) {
  return slot.bookings.filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED')
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
  if (b.status === 'PENDING') return { label: 'Payment not finished', class: 'bg-amber/20 text-amber-dark' }
  return { label: b.status === 'REFUNDED' ? 'Refunded' : 'Cancelled', class: 'bg-gray-100 text-gray-500' }
}

async function load({ quiet = false } = {}) {
  if (!quiet) loading.value = true
  error.value = null
  try {
    sheet.value = await apiFetch(`/api/staff/teesheet?date=${date.value}`)
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

async function checkIn(b, slot) {
  busy.value = b.id
  actionError.value = null
  try {
    await apiFetch(`/api/staff/teesheet/${b.id}`, { method: 'POST', body: { action: 'check_in' } })
    openOnRegister(b, slot)
  } catch (e) {
    actionError.value = e.message
    load({ quiet: true })
  } finally {
    busy.value = null
  }
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
.btn-pine-sm    { @apply bg-pine text-parch text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-pine/90 transition-colors disabled:opacity-50; }
.btn-outline-xs { @apply border border-gray-300 text-gray-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent; }
</style>
