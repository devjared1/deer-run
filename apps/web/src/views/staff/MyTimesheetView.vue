<template>
  <div class="max-w-4xl">
    <!-- Pay period navigation -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3">
      <button class="btn-outline-sm" :disabled="!sheet" @click="load(sheet.period.prevStart)">← Previous</button>
      <button class="btn-outline-sm" :disabled="!sheet || isCurrent" @click="load(null)">Current Period</button>
      <button class="btn-outline-sm" :disabled="!sheet || isCurrent" @click="load(sheet.period.nextStart)">Next →</button>
      <div v-if="sheet" class="font-display font-bold text-bark ml-auto">
        {{ formatLocalDate(sheet.period.start, { month: 'short', day: 'numeric' }) }} –
        {{ formatLocalDate(sheet.period.end, { month: 'short', day: 'numeric', year: 'numeric' }) }}
      </div>
    </div>

    <div v-if="loading && !sheet" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <template v-else-if="sheet">
      <!-- Totals -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="stat-card">
          <div class="stat-label">Total</div>
          <div class="stat-value">{{ formatMinutes(sheet.workedMinutes) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Regular</div>
          <div class="stat-value">{{ formatMinutes(sheet.regular) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Overtime</div>
          <div class="stat-value" :class="sheet.overtime > 0 ? 'text-clay' : ''">{{ formatMinutes(sheet.overtime) }}</div>
        </div>
      </div>

      <!-- One table per workweek -->
      <div v-for="week in weeks" :key="week.weekStart" class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between font-body text-sm">
          <span class="font-semibold text-bark">Week of {{ formatLocalDate(week.weekStart, { month: 'short', day: 'numeric' }) }}</span>
          <span class="text-gray-500">
            {{ formatMinutes(week.workedMinutes) }}
            <span v-if="week.overtime > 0" class="text-clay ml-1">({{ formatMinutes(week.overtime) }} overtime)</span>
          </span>
        </div>
        <table class="w-full text-sm font-body">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100 text-left">
              <th class="th">Day</th>
              <th class="th">In</th>
              <th class="th">Out</th>
              <th class="th">Breaks</th>
              <th class="th text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="day in week.days" :key="day.date">
              <tr v-if="!day.entries.length" class="border-b border-gray-50">
                <td class="td text-gray-400">{{ formatLocalDate(day.date) }}</td>
                <td class="td text-gray-300" colspan="4">—</td>
              </tr>
              <tr
                v-for="(entry, i) in day.entries"
                :key="entry.id"
                :class="i === day.entries.length - 1 ? 'border-b border-gray-50' : ''"
              >
                <td class="td text-bark font-semibold">
                  <template v-if="i === 0">{{ formatLocalDate(day.date) }}</template>
                </td>
                <td class="td text-gray-600">{{ formatClockTime(entry.clockIn) }}</td>
                <td class="td text-gray-600">
                  <span v-if="entry.clockOut">{{ formatClockTime(entry.clockOut) }}</span>
                  <span v-else class="text-pine">On the clock</span>
                  <span v-if="entry.editedAt" class="ml-1 text-xs text-gray-400" title="Corrected by a manager">(edited)</span>
                </td>
                <td class="td text-gray-500">{{ entry.breakMinutes ? formatMinutes(entry.breakMinutes) : '—' }}</td>
                <td class="td text-right text-bark tabular-nums">{{ formatMinutes(entry.workedMinutes) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="text-gray-400 text-xs font-body mt-3">
        Hours count toward the day you clocked in. Overtime is time over 40 hours in a workweek.
        If a punch is wrong, ask a manager to correct it.
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  localDate, formatMinutes, formatClockTime, formatLocalDate, weekStart,
} from '@/lib/timeclock'

const authStore = useAuthStore()
const sheet   = ref(null)
const loading = ref(false)
const error   = ref(null)

const isCurrent = computed(() => {
  if (!sheet.value) return true
  const today = localDate()
  return sheet.value.period.start <= today && today <= sheet.value.period.end
})

// Attach each workweek's days for display
const weeks = computed(() => (sheet.value?.weeks ?? []).map(w => ({
  ...w,
  days: sheet.value.days.filter(d => weekStart(d.date, sheet.value.period.weekStartDay) === w.weekStart),
})))

async function load(date) {
  loading.value = true
  error.value   = null
  try {
    const params = date ? `?${new URLSearchParams({ date })}` : ''
    const res = await fetch(`/api/staff/timesheet${params}`, {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    sheet.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => load(null))
</script>

<style scoped>
.th             { @apply px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold; }
.td             { @apply px-5 py-2.5; }
.stat-card      { @apply bg-white rounded-xl border border-gray-200 p-5; }
.stat-label     { @apply text-gray-400 text-xs font-body uppercase tracking-wider mb-1; }
.stat-value     { @apply text-2xl font-display font-bold text-bark tabular-nums; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent; }
</style>
