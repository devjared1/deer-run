<template>
  <div class="max-w-2xl">
    <div v-if="loading && !state" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="loadError" class="text-red-500 text-sm">{{ loadError }}</div>

    <template v-else-if="state">
      <!-- Status card -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 md:p-8 text-center">
        <div class="text-gray-400 text-xs font-body uppercase tracking-wider">{{ todayLabel }}</div>
        <div class="font-display font-bold text-bark text-5xl mt-1 tabular-nums">{{ clockNow }}</div>

        <div class="mt-5 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-body" :class="statusStyle.badge">
          <span class="w-2 h-2 rounded-full" :class="statusStyle.dot" />
          {{ statusStyle.label }}
        </div>

        <div v-if="state.openEntry" class="mt-3 text-gray-500 text-sm font-body">
          Clocked in at {{ formatClockTime(state.openEntry.clockIn) }}
          <template v-if="currentBreak"> · on break since {{ formatClockTime(currentBreak.startedAt) }}</template>
        </div>

        <!-- Actions -->
        <div class="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          <button
            v-if="state.status === 'off'"
            :disabled="busy"
            class="action-btn bg-pine text-parch hover:bg-pine/90"
            @click="act('clock_in')"
          >
            Clock In
          </button>
          <button
            v-if="state.status === 'on'"
            :disabled="busy"
            class="action-btn bg-amber text-bark hover:bg-amber/90"
            @click="act('break_start')"
          >
            Start Break
          </button>
          <button
            v-if="state.status === 'break'"
            :disabled="busy"
            class="action-btn bg-amber text-bark hover:bg-amber/90"
            @click="act('break_end')"
          >
            End Break
          </button>
          <button
            v-if="state.status !== 'off'"
            :disabled="busy"
            class="action-btn bg-clay text-parch hover:bg-clay/90"
            @click="confirmingClockOut = true"
          >
            Clock Out
          </button>
        </div>
        <p v-if="actionError" class="text-red-500 text-sm mt-3 font-body">{{ actionError }}</p>
      </div>

      <!-- Today -->
      <div class="bg-white rounded-xl border border-gray-200 mt-6">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="font-display font-bold text-bark text-sm">Today</h2>
          <div class="font-body text-sm text-bark">
            <span class="text-gray-400 text-xs mr-1">Worked</span>
            <span class="font-semibold tabular-nums">{{ formatMinutes(todayMinutes) }}</span>
          </div>
        </div>
        <div class="divide-y divide-gray-50">
          <div v-for="entry in state.today.entries" :key="entry.id" class="px-5 py-3 font-body text-sm">
            <div class="flex items-center justify-between gap-3">
              <div class="text-bark">
                {{ formatClockTime(entry.clockIn) }} – {{ entry.clockOut ? formatClockTime(entry.clockOut) : 'now' }}
              </div>
              <div class="text-gray-600 tabular-nums">{{ formatMinutes(liveMinutes(entry)) }}</div>
            </div>
            <div v-for="b in entry.breaks" :key="b.id" class="text-gray-400 text-xs mt-0.5">
              Break {{ formatClockTime(b.startedAt) }} – {{ b.endedAt ? formatClockTime(b.endedAt) : 'now' }}
            </div>
          </div>
          <div v-if="!state.today.entries.length" class="px-5 py-6 text-gray-400 text-sm text-center">
            No time recorded today.
          </div>
        </div>
      </div>
    </template>

    <!-- Clock out confirm -->
    <div v-if="confirmingClockOut" class="modal-overlay" @click.self="confirmingClockOut = false">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">Clock out now?</h2>
        <p class="text-gray-500 text-sm font-body mb-5">
          You've worked {{ formatMinutes(todayMinutes) }} today.
          <template v-if="currentBreak">Your break will end when you clock out.</template>
        </p>
        <div class="flex justify-end gap-3">
          <button class="btn-outline-sm" @click="confirmingClockOut = false">Cancel</button>
          <button
            :disabled="busy"
            class="bg-clay hover:bg-clay/90 text-parch text-sm px-4 py-2 rounded-lg font-body font-semibold transition-colors disabled:opacity-50"
            @click="act('clock_out')"
          >
            {{ busy ? 'Clocking out…' : 'Clock Out' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  COURSE_TZ, workedMinutes, formatMinutes, formatClockTime, formatLocalDate,
} from '@/lib/timeclock'

const authStore = useAuthStore()
const state       = ref(null)
const loading     = ref(false)
const loadError   = ref(null)
const busy        = ref(false)
const actionError = ref(null)
const confirmingClockOut = ref(false)

// Ticks every second to drive the clock and running totals
const now = ref(new Date())
let ticker = null

const clockNow = computed(() =>
  now.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: COURSE_TZ }),
)
const todayLabel = computed(() =>
  state.value ? formatLocalDate(state.value.today.date, { weekday: 'long', month: 'long', day: 'numeric' }) : '',
)

const currentBreak = computed(() => state.value?.openEntry?.breaks.find(b => !b.endedAt) ?? null)

const statusStyle = computed(() => ({
  off:   { label: 'Off the clock', badge: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400' },
  on:    { label: 'On the clock',  badge: 'bg-pine/15 text-pine',        dot: 'bg-pine animate-pulse' },
  break: { label: 'On break',      badge: 'bg-amber/20 text-bark',       dot: 'bg-amber animate-pulse' },
}[state.value?.status ?? 'off']))

function liveMinutes(entry) {
  return entry.clockOut ? entry.workedMinutes : workedMinutes(entry, now.value)
}

const todayMinutes = computed(() =>
  (state.value?.today.entries ?? []).reduce((sum, e) => sum + liveMinutes(e), 0),
)

async function api(options = {}) {
  const res = await fetch('/api/staff/clock', {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
  })
  if (!res.ok) throw new Error((await res.json()).error || res.statusText)
  return res.json()
}

async function load() {
  loading.value   = true
  loadError.value = null
  try {
    state.value = await api()
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
}

async function act(action) {
  busy.value        = true
  actionError.value = null
  try {
    state.value = await api({ method: 'POST', body: JSON.stringify({ action }) })
    confirmingClockOut.value = false
  } catch (e) {
    actionError.value = e.message
    confirmingClockOut.value = false
    // The state may have changed elsewhere (another device); refresh it
    await load()
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  load()
  ticker = setInterval(() => { now.value = new Date() }, 1000)
})
onBeforeUnmount(() => clearInterval(ticker))
</script>

<style scoped>
.action-btn     { @apply px-8 py-4 rounded-xl font-body font-semibold text-lg transition-colors disabled:opacity-50 min-w-[10rem]; }
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
