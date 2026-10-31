<template>
  <div class="max-w-6xl">
    <!-- Toolbar -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3 print:hidden">
      <div class="flex rounded-lg border border-gray-300 overflow-hidden">
        <button
          v-for="(v, key) in SCHEDULE_VIEWS"
          :key="key"
          type="button"
          :class="['px-3 py-2 text-sm font-body transition-colors', view === key ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
          @click="setQuery({ view: key })"
        >
          {{ v.label }}
        </button>
      </div>
      <div class="flex rounded-lg border border-gray-300 overflow-hidden">
        <button
          type="button"
          :class="['px-3 py-2 text-sm font-body transition-colors', !team ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
          @click="setQuery({ team: undefined })"
        >
          My shifts
        </button>
        <button
          type="button"
          :class="['px-3 py-2 text-sm font-body transition-colors', team ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
          @click="setQuery({ team: '1' })"
        >
          Whole team
        </button>
      </div>
      <div class="flex gap-2">
        <button class="btn-outline-sm" :disabled="!data" @click="setQuery({ date: data.period.prevStart })">
          ← Previous
        </button>
        <button class="btn-outline-sm" @click="setQuery({ date: undefined })">
          Today
        </button>
        <button class="btn-outline-sm" :disabled="!data" @click="setQuery({ date: data.period.nextStart })">
          Next →
        </button>
      </div>
      <button class="btn-outline-sm ml-auto" :disabled="!data" @click="printLandscape">
        🖨 Print
      </button>
    </div>

    <div v-if="data" class="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
      <h2 class="font-display font-bold text-bark text-xl">
        <span class="hidden print:inline">Deer Run Schedule · </span>{{ periodLabel }}
      </h2>
      <span class="text-sm text-gray-500 font-body">
        {{ team ? 'Whole team' : `${authStore.employee?.firstName} ${authStore.employee?.lastName}` }}
      </span>
      <span v-if="!team" class="text-sm text-gray-500 font-body">
        · {{ myShifts.length }} shift{{ myShifts.length === 1 ? '' : 's' }}, {{ myShifts.length ? totalHours(myShifts) : '0h' }}
      </span>
    </div>

    <div v-if="loading && !data" class="text-gray-400 text-sm">
      Loading…
    </div>
    <div v-else-if="error" class="text-red-500 text-sm">
      {{ error }}
    </div>

    <template v-else-if="data">
      <ScheduleMonth
        v-if="view === 'month'"
        :dates="dates"
        :month="data.period.start.slice(0, 7)"
        :employees="data.employees"
        :shifts="data.shifts"
        :time-off="data.timeOff"
        :highlight-employee-id="team ? data.employeeId : null"
      />

      <ScheduleGrid
        v-else-if="team"
        :dates="dates"
        :employees="data.employees"
        :shifts="data.shifts"
        :time-off="data.timeOff"
        :highlight-employee-id="data.employeeId"
      />

      <!-- My shifts, one row per day -->
      <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 print:rounded-none print:border-gray-400">
        <div
          v-for="d in dates"
          :key="d"
          :class="['flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 font-body', d === today ? 'bg-pine/5' : '']"
        >
          <div class="w-28 flex-shrink-0">
            <div :class="['font-semibold', d === today ? 'text-pine' : 'text-bark']">
              {{ formatLocalDate(d, { weekday: 'long' }) }}
            </div>
            <div class="text-xs text-gray-400">
              {{ formatLocalDate(d, { month: 'short', day: 'numeric' }) }}{{ d === today ? ' · Today' : '' }}
            </div>
          </div>
          <div class="flex-1 flex flex-wrap gap-2">
            <span
              v-if="timeOffOn(data.timeOff, data.employeeId, d)"
              class="text-xs border border-dashed border-gray-400 text-gray-500 rounded px-2 py-1"
            >
              {{ timeOffLabel(timeOffOn(data.timeOff, data.employeeId, d)) }}
            </span>
            <span
              v-for="s in myShifts.filter(s => s.date === d)"
              :key="s.id"
              :class="['text-sm border rounded px-3 py-1.5', shiftClasses(s, me)]"
            >
              <span class="font-semibold">{{ longTime(s.startTime) }} – {{ longTime(s.endTime) }}</span>
              <span class="opacity-70 ml-1">({{ totalHours([s]) }})</span>
              <span v-if="s.position && s.position !== me?.position" class="ml-2 opacity-80">{{ positionLabel(s.position) }}</span>
              <span v-if="s.notes" class="ml-2 opacity-70">· {{ s.notes }}</span>
            </span>
            <span
              v-if="!myShifts.some(s => s.date === d) && !timeOffOn(data.timeOff, data.employeeId, d)"
              class="text-sm text-gray-300"
            >Off</span>
          </div>
        </div>
      </div>

      <p class="text-gray-400 text-xs font-body mt-3 print:hidden">
        Schedules can change. If you can't work a shift, talk to your manager.
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiFetch } from '@/lib/api'
import { printLandscape } from '@/lib/print'
import { localDate, formatLocalDate, isValidYmd } from '@/lib/timeclock'
import { SCHEDULE_VIEWS, datesBetween, longTime } from '@/lib/schedule'
import { positionLabel, shiftClasses, timeOffOn, timeOffLabel, totalHours } from '@/components/schedule/scheduleDisplay'
import ScheduleGrid from '@/components/schedule/ScheduleGrid.vue'
import ScheduleMonth from '@/components/schedule/ScheduleMonth.vue'

const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()

const data    = ref(null)
const loading = ref(false)
const error   = ref(null)
const today   = localDate()

const view = computed(() => (SCHEDULE_VIEWS[route.query.view] ? route.query.view : 'week'))
const date = computed(() => (isValidYmd(route.query.date) ? route.query.date : null))
const team = computed(() => route.query.team === '1')

function setQuery(patch) {
  const query = { ...route.query, ...patch }
  for (const k of Object.keys(query)) if (query[k] === undefined) delete query[k]
  router.replace({ query })
}

const me       = computed(() => data.value?.employees.find(e => e.id === data.value.employeeId) ?? null)
const dates    = computed(() => {
  if (!data.value) return []
  const p = data.value.period
  return view.value === 'month' ? datesBetween(p.gridStart, p.gridEnd) : datesBetween(p.start, p.end)
})
const myShifts = computed(() => {
  if (!data.value) return []
  const p = data.value.period
  return data.value.shifts.filter(s => s.employeeId === data.value.employeeId && s.date >= p.start && s.date <= p.end)
})

const periodLabel = computed(() => {
  const p = data.value.period
  if (view.value === 'month') return formatLocalDate(p.start, { month: 'long', year: 'numeric' })
  return `${formatLocalDate(p.start, { month: 'short', day: 'numeric' })} – ${formatLocalDate(p.end, { month: 'short', day: 'numeric', year: 'numeric' })}`
})

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ view: view.value })
    if (date.value) params.set('date', date.value)
    if (team.value) params.set('team', '1')
    data.value = await apiFetch(`/api/staff/schedule?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(() => [view.value, date.value, team.value], load, { immediate: true })
</script>

<style scoped>
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent; }
</style>
