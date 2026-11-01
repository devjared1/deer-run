<template>
  <div class="max-w-6xl space-y-3">
    <!-- Top app bar-style toolbar: period + chevrons, overflow menu -->
    <div class="print:hidden space-y-2">
      <div class="flex items-center gap-1">
        <DateStepper
          :model-value="stepperDate"
          :step="STEPS[view]"
          :format-title="stepperTitle"
          :disabled="!data"
          class="min-w-0"
          @update:model-value="onStep"
        />
        <div class="ml-auto flex items-center gap-1">
          <AppButton
            variant="text"
            class="hidden sm:inline-flex"
            :disabled="!data || showsToday"
            @click="goToday"
          >
            Today
          </AppButton>
          <AppButton
            variant="outlined"
            :icon="IconPrint"
            class="hidden md:inline-flex"
            :disabled="!data"
            @click="printLandscape"
          >
            Print
          </AppButton>
          <RowActionsMenu
            class="md:hidden"
            label="More schedule actions"
            :items="menuItems"
          />
        </div>
      </div>

      <!-- Chip row: period length · whose shifts -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ChipGroup
          :model-value="view"
          type="choice"
          label="Period"
          :options="viewOptions"
          @update:model-value="v => setQuery({ view: v })"
        />
        <span
          class="hidden min-[400px]:block w-px h-6 bg-outline-variant"
          aria-hidden="true"
        />
        <ChipGroup
          :model-value="team ? 'team' : 'mine'"
          type="choice"
          label="Whose shifts"
          :options="whoOptions"
          @update:model-value="v => setQuery({ team: v === 'team' ? '1' : undefined })"
        />
      </div>
    </div>

    <!-- Who and how much (and the period title on paper) -->
    <div
      v-if="data"
      class="flex flex-wrap items-baseline gap-x-3 gap-y-1"
    >
      <h2 class="hidden print:block font-display text-headline-s text-on-surface">
        Deer Run Schedule · {{ periodLabel }}
      </h2>
      <span class="text-body-m text-on-surface-variant">
        {{ team ? 'Whole team' : myName }}<template v-if="!team">
          · {{ myShifts.length }} shift{{ myShifts.length === 1 ? '' : 's' }}, {{ myShifts.length ? totalHours(myShifts) : '0h' }}
        </template>
      </span>
    </div>

    <Skeleton
      v-if="loading && !data"
      variant="rect"
      height="360px"
      label="Loading your schedule"
    />
    <ErrorBanner
      v-else-if="error"
      :message="error"
      :retrying="loading"
      @retry="load"
    />

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
      <Card
        v-else
        padding="none"
        class="overflow-hidden print:shadow-none print:border print:border-outline"
      >
        <!-- The list goes inside: Card wraps its default slot in a div, which a <ul> can't hold -->
        <ul class="divide-y divide-outline-variant">
          <li
            v-for="d in dates"
            :key="d"
            :class="['flex items-start sm:items-center gap-x-4 gap-y-1 px-4 py-3', d === today ? 'bg-primary-container/40' : '']"
            :aria-current="d === today ? 'date' : undefined"
          >
            <div class="w-24 sm:w-28 flex-none">
              <div :class="['text-title-s', d === today ? 'text-primary' : 'text-on-surface']">
                {{ formatLocalDate(d, { weekday: 'long' }) }}
              </div>
              <div class="text-body-s text-on-surface-variant">
                {{ formatLocalDate(d, { month: 'short', day: 'numeric' }) }}{{ d === today ? ' · Today' : '' }}
              </div>
            </div>
            <div class="flex-1 min-w-0 flex flex-wrap gap-2">
              <span
                v-if="timeOffOn(data.timeOff, data.employeeId, d)"
                :class="['inline-flex items-center gap-1.5 text-body-m border rounded-shape-sm px-2 py-1', timeOffClasses(timeOffOn(data.timeOff, data.employeeId, d))]"
              >
                <IconBeach
                  class="w-4 h-4"
                  aria-hidden="true"
                />
                {{ timeOffLabel(timeOffOn(data.timeOff, data.employeeId, d)) }}
              </span>
              <span
                v-for="s in myShifts.filter(s => s.date === d)"
                :key="s.id"
                :class="['w-full sm:w-auto text-body-m border rounded-shape-sm px-3 py-1.5', shiftClasses(s, me)]"
              >
                <span class="whitespace-nowrap"><span class="font-bold">{{ longTime(s.startTime) }} – {{ longTime(s.endTime) }}</span>
                  ({{ totalHours([s]) }})</span>
                <span
                  v-if="(s.position && s.position !== me?.position) || s.notes"
                  class="block sm:inline sm:ml-2"
                >{{ [s.position && s.position !== me?.position ? positionLabel(s.position) : null, s.notes].filter(Boolean).join(' · ') }}</span>
              </span>
              <span
                v-if="!myShifts.some(s => s.date === d) && !timeOffOn(data.timeOff, data.employeeId, d)"
                class="text-body-m text-on-surface-variant py-1"
              >Off</span>
            </div>
          </li>
        </ul>
      </Card>

      <ScheduleLegend
        v-if="team || view === 'month'"
        :warnings="false"
      />

      <p class="text-body-s text-on-surface-variant print:hidden">
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
import {
  positionLabel, shiftClasses, timeOffClasses, timeOffOn, timeOffLabel, totalHours,
} from '@/components/schedule/scheduleDisplay'
import ScheduleGrid from '@/components/schedule/ScheduleGrid.vue'
import ScheduleMonth from '@/components/schedule/ScheduleMonth.vue'
import ScheduleLegend from '@/components/schedule/ScheduleLegend.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import DateStepper from '@/components/ui/DateStepper.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import IconPrint from '~icons/material-symbols/print-rounded'
import IconToday from '~icons/material-symbols/today-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'

const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()

const data    = ref(null)
const loading = ref(false)
const error   = ref(null)
const today   = localDate()

const STEPS = { week: 'week', biweek: 14, month: 'month' }
const VIEW_LABELS = { week: 'Week', biweek: '2 weeks', month: 'Month' }
const viewOptions = Object.keys(SCHEDULE_VIEWS).map(value => ({ value, label: VIEW_LABELS[value] ?? SCHEDULE_VIEWS[value].label }))
const whoOptions = [{ value: 'mine', label: 'Mine' }, { value: 'team', label: 'Team' }]

const view = computed(() => (SCHEDULE_VIEWS[route.query.view] ? route.query.view : 'week'))
const date = computed(() => (isValidYmd(route.query.date) ? route.query.date : null))
const team = computed(() => route.query.team === '1')

function setQuery(patch) {
  const query = { ...route.query, ...patch }
  for (const k of Object.keys(query)) if (query[k] === undefined) delete query[k]
  router.replace({ query })
}

const me       = computed(() => data.value?.employees.find(e => e.id === data.value.employeeId) ?? null)
const myName   = computed(() => `${authStore.employee?.firstName ?? ''} ${authStore.employee?.lastName ?? ''}`.trim())
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

// The stepper moves from the period's first day; the server snaps any date to its period
const stepperDate = computed(() => data.value?.period.start ?? date.value ?? today)
const showsToday = computed(() => !!data.value && data.value.period.start <= today && today <= data.value.period.end)

// Compact so it fits next to the arrows on a phone: "Nov 1 – 7", "Oct 25 – Nov 7", "Nov 2026"
function stepperTitle() {
  if (!data.value) return 'Loading…'
  const { start, end } = data.value.period
  if (view.value === 'month') return formatLocalDate(start, { month: 'short', year: 'numeric' })
  const thisYear = start.slice(0, 4) === today.slice(0, 4) && end.slice(0, 4) === start.slice(0, 4)
  const y = thisYear ? {} : { year: 'numeric' }
  const to = start.slice(0, 7) === end.slice(0, 7) && thisYear
    ? formatLocalDate(end, { day: 'numeric' })
    : formatLocalDate(end, { month: 'short', day: 'numeric', ...y })
  return `${formatLocalDate(start, { month: 'short', day: 'numeric', ...y })} – ${to}`
}

function onStep(d) {
  setQuery({ date: d === today ? undefined : d })
}
function goToday() {
  setQuery({ date: undefined })
}

const menuItems = computed(() => [
  { label: 'Go to today', icon: IconToday, disabled: !data.value || showsToday.value, onClick: goToday },
  { label: 'Print', icon: IconPrint, disabled: !data.value, onClick: printLandscape },
])

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
