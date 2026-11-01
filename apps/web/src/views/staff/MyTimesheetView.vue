<template>
  <div class="max-w-4xl space-y-4">
    <!-- Pay period navigation -->
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <DateStepper
        :model-value="stepperDate"
        :step="sheet?.period.lengthDays ?? 14"
        :format-title="periodTitle"
        :max="currentStart || ''"
        :disabled="!sheet"
        class="max-w-full"
        @update:model-value="load"
      />
      <AppButton
        v-if="sheet && !isCurrent"
        variant="text"
        :disabled="loading"
        @click="load(null)"
      >
        Current period
      </AppButton>
    </div>

    <template v-if="loading && !sheet">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          v-for="n in 3"
          :key="n"
          label="Hours"
          loading
          :class="n === 1 ? 'col-span-2 sm:col-span-1' : ''"
        />
      </div>
      <Skeleton
        variant="rect"
        height="320px"
        label="Loading your timesheet"
      />
    </template>
    <ErrorBanner
      v-else-if="error"
      :message="error"
      :retrying="loading"
      @retry="load(sheet?.period.start ?? null)"
    />

    <template v-else-if="sheet">
      <!-- Totals -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total"
          :icon="IconSchedule"
          class="col-span-2 sm:col-span-1"
        >
          <template #value>
            <span class="tabular-nums">{{ formatMinutes(sheet.workedMinutes) }}</span>
          </template>
        </StatCard>
        <StatCard label="Regular">
          <template #value>
            <span class="text-headline-s sm:text-headline-l tabular-nums">{{ formatMinutes(sheet.regular) }}</span>
          </template>
        </StatCard>
        <StatCard label="Overtime">
          <template #value>
            <span :class="['text-headline-s sm:text-headline-l tabular-nums', sheet.overtime > 0 ? 'text-error' : '']">
              {{ formatMinutes(sheet.overtime) }}
            </span>
          </template>
        </StatCard>
      </div>

      <!-- One section per workweek -->
      <section
        v-for="week in weeks"
        :key="week.weekStart"
        :aria-labelledby="`week-${week.weekStart}`"
        class="space-y-2"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 pt-2">
          <h2
            :id="`week-${week.weekStart}`"
            class="text-title-m text-on-surface"
          >
            Week of {{ formatLocalDate(week.weekStart, { month: 'short', day: 'numeric' }) }}
          </h2>
          <span class="text-body-m text-on-surface-variant tabular-nums">
            {{ formatMinutes(week.workedMinutes) }}
            <span
              v-if="week.overtime > 0"
              class="text-error"
            >· {{ formatMinutes(week.overtime) }} overtime</span>
          </span>
        </div>

        <!-- Phones: a card per day -->
        <ul class="sm:hidden space-y-2">
          <li
            v-for="day in week.days"
            :key="day.date"
          >
            <Card
              :variant="day.entries.length ? 'elevated' : 'outlined'"
              padding="sm"
            >
              <div class="flex items-center justify-between gap-3">
                <div :class="['text-title-s', day.entries.length ? 'text-on-surface' : 'text-on-surface-variant']">
                  {{ formatLocalDate(day.date) }}
                </div>
                <div
                  v-if="day.entries.length"
                  class="text-title-s text-on-surface tabular-nums"
                >
                  {{ formatMinutes(day.workedMinutes) }}
                </div>
                <div
                  v-else
                  class="text-body-m text-on-surface-variant"
                >
                  No time
                </div>
              </div>
              <div
                v-for="entry in day.entries"
                :key="entry.id"
                class="mt-1 flex flex-wrap items-center gap-x-2 text-body-m text-on-surface-variant"
              >
                <span class="text-on-surface">
                  {{ formatClockTime(entry.clockIn) }} –
                  <template v-if="entry.clockOut">{{ formatClockTime(entry.clockOut) }}</template>
                  <span
                    v-else
                    class="text-primary"
                  >on the clock</span>
                </span>
                <span v-if="entry.breakMinutes">· {{ formatMinutes(entry.breakMinutes) }} break</span>
                <span
                  v-if="entry.editedAt"
                  class="inline-flex items-center gap-1"
                >
                  · <IconEdit
                    class="w-4 h-4"
                    aria-hidden="true"
                  />Edited by a manager
                </span>
              </div>
            </Card>
          </li>
        </ul>

        <!-- sm+: a table -->
        <Card
          padding="none"
          class="hidden sm:block overflow-hidden"
        >
          <table class="w-full table-fixed text-body-m">
            <caption class="sr-only">
              Punches for the week of {{ formatLocalDate(week.weekStart, { month: 'long', day: 'numeric' }) }}
            </caption>
            <thead>
              <tr class="bg-surface-container text-left">
                <th
                  scope="col"
                  class="th w-[24%]"
                >
                  Day
                </th>
                <th
                  scope="col"
                  class="th w-[16%]"
                >
                  In
                </th>
                <th
                  scope="col"
                  class="th w-[28%]"
                >
                  Out
                </th>
                <th
                  scope="col"
                  class="th w-[14%]"
                >
                  Breaks
                </th>
                <th
                  scope="col"
                  class="th text-right"
                >
                  Hours
                </th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="day in week.days"
                :key="day.date"
              >
                <tr
                  v-if="!day.entries.length"
                  class="border-t border-outline-variant"
                >
                  <th
                    scope="row"
                    class="td text-left font-normal text-on-surface-variant"
                  >
                    {{ formatLocalDate(day.date) }}
                  </th>
                  <td
                    class="td text-on-surface-variant"
                    colspan="4"
                  >
                    <span aria-hidden="true">—</span><span class="sr-only">No time</span>
                  </td>
                </tr>
                <tr
                  v-for="(entry, i) in day.entries"
                  :key="entry.id"
                  :class="i === 0 ? 'border-t border-outline-variant' : ''"
                >
                  <th
                    scope="row"
                    class="td text-left text-title-s text-on-surface"
                  >
                    <template v-if="i === 0">
                      {{ formatLocalDate(day.date) }}
                    </template>
                    <!-- Later punches on the same day: the date for screen readers only (no empty row header) -->
                    <span v-else class="sr-only">{{ formatLocalDate(day.date) }}</span>
                  </th>
                  <td class="td text-on-surface">
                    {{ formatClockTime(entry.clockIn) }}
                  </td>
                  <td class="td text-on-surface">
                    <span v-if="entry.clockOut">{{ formatClockTime(entry.clockOut) }}</span>
                    <span
                      v-else
                      class="text-primary"
                    >On the clock</span>
                    <span
                      v-if="entry.editedAt"
                      class="ml-2 inline-flex items-center gap-1 text-body-s text-on-surface-variant"
                    >
                      <IconEdit
                        class="w-4 h-4"
                        aria-hidden="true"
                      />Edited
                    </span>
                  </td>
                  <td class="td text-on-surface-variant tabular-nums">
                    {{ entry.breakMinutes ? formatMinutes(entry.breakMinutes) : '—' }}
                  </td>
                  <td class="td text-right text-on-surface tabular-nums">
                    {{ formatMinutes(entry.workedMinutes) }}
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </Card>
      </section>

      <p class="text-body-s text-on-surface-variant">
        Hours count toward the day you clocked in. Overtime is time over 40 hours in a workweek.
        If a punch is wrong, ask a manager to correct it.
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import {
  localDate, formatMinutes, formatClockTime, formatLocalDate, weekStart,
} from '@/lib/timeclock'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import DateStepper from '@/components/ui/DateStepper.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatCard from '@/components/ui/StatCard.vue'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'

const sheet   = ref(null)
const loading = ref(false)
const error   = ref(null)
// Start of the current pay period (from the first load), so the stepper can't go past it
const currentStart = ref(null)

const isCurrent = computed(() => {
  if (!sheet.value) return true
  const today = localDate()
  return sheet.value.period.start <= today && today <= sheet.value.period.end
})

const stepperDate = computed(() => sheet.value?.period.start ?? localDate())

// "Oct 25 – Nov 7" (the year only when it isn't this year)
function periodTitle() {
  if (!sheet.value) return 'Loading…'
  const { start, end } = sheet.value.period
  const thisYear = start.slice(0, 4) === localDate().slice(0, 4) && end.slice(0, 4) === start.slice(0, 4)
  const opts = { month: 'short', day: 'numeric', ...(thisYear ? {} : { year: 'numeric' }) }
  return `${formatLocalDate(start, opts)} – ${formatLocalDate(end, opts)}`
}

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
    sheet.value = await apiFetch(`/api/staff/timesheet${params}`)
    if (isCurrent.value) currentStart.value = sheet.value.period.start
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => load(null))
</script>

<style scoped>
.th { @apply px-4 py-3 text-label-m text-on-surface-variant uppercase tracking-wider; }
.td { @apply px-4 py-2.5; }
</style>
