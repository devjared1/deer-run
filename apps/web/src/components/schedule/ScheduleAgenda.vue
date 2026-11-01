<template>
  <ol class="schedule-agenda rounded-shape-md border border-outline-variant bg-surface-container-lowest divide-y divide-outline-variant font-body">
    <li v-for="date in days" :key="date" :class="['px-4 py-3', date === today ? 'bg-primary/[.04]' : '']">
      <div class="flex items-center gap-2 min-h-10">
        <h3 :class="['flex-1 text-title-s', date === today ? 'text-primary' : 'text-on-surface']">
          {{ formatLocalDate(date, { weekday: 'long', month: 'short', day: 'numeric' }) }}
          <span v-if="date === today" class="text-label-m text-primary"> · Today</span>
        </h3>
        <span v-if="dayShifts(date).length" class="text-body-s text-on-surface-variant tabular-nums">
          {{ dayShifts(date).length }} shift{{ dayShifts(date).length === 1 ? '' : 's' }} · {{ totalHours(dayShifts(date)) }}
        </span>
        <IconButton
          v-if="editable"
          :icon="IconAdd"
          size="sm"
          :label="`Add shift on ${formatLocalDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}`"
          @click="$emit('add', { employeeId: null, date })"
        />
      </div>

      <ul v-if="dayTimeOff(date).length || dayShifts(date).length" class="mt-1 space-y-1.5">
        <li
          v-for="r in dayTimeOff(date)"
          :key="r.id"
          :class="['flex items-center gap-2 text-body-s rounded-shape-xs border px-3 py-1.5', timeOffClasses(r)]"
        >
          <IconBeach class="w-4 h-4 flex-none" aria-hidden="true" />
          <span class="truncate">{{ fullName(r.employeeId) }} · {{ timeOffLabel(r) }}</span>
        </li>
        <li v-for="shift in dayShifts(date)" :key="shift.id">
          <component
            :is="editable ? 'button' : 'div'"
            :type="editable ? 'button' : undefined"
            :class="['block w-full text-left rounded-shape-xs border px-3 py-2', shiftClasses(shift, employeeById.get(shift.employeeId)),
                     editable ? 'state-layer cursor-pointer' : '', warnings[shift.id] ? 'ring-1 ring-error' : '']"
            :aria-label="editable ? `Edit ${fullName(shift.employeeId)}'s shift, ${longTime(shift.startTime)} to ${longTime(shift.endTime)}` : undefined"
            @click="editable && $emit('edit', shift)"
          >
            <span class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-label-l whitespace-nowrap">{{ longTime(shift.startTime) }} – {{ longTime(shift.endTime) }}</span>
              <span :class="['text-body-m', shift.employeeId === highlightEmployeeId ? 'font-bold' : '']">
                {{ fullName(shift.employeeId) }}<span v-if="shift.employeeId === highlightEmployeeId"> (you)</span>
              </span>
            </span>
            <span class="block text-body-s">
              {{ positionLabel(shiftPosition(shift, employeeById.get(shift.employeeId))) }} · {{ shiftHoursText(shift) }}<template v-if="shift.notes"> · {{ shift.notes }}</template>
            </span>
            <span v-for="w in warnings[shift.id] ?? []" :key="w" class="mt-1 flex items-start gap-1 text-body-s text-error">
              <IconWarning class="w-4 h-4 mt-px flex-none" aria-hidden="true" />
              <span><span class="sr-only">Warning: </span>{{ w }}</span>
            </span>
          </component>
        </li>
      </ul>
      <p v-else class="text-body-s text-on-surface-variant">
        No shifts
      </p>
    </li>
  </ol>
</template>

<script setup>
// Day-by-day list of shifts and time off: the month schedule on phones (ScheduleMonth switches to it below md).
//   <ScheduleAgenda :dates :month="'2026-11'" :employees :shifts :time-off :warnings editable @add @edit />
// Same props and events as ScheduleMonth; `month` limits the days to that month (padding days of the grid are dropped).
import { computed } from 'vue'
import { formatLocalDate, localDate } from '@/lib/timeclock'
import { longTime } from '@/lib/schedule'
import IconButton from '@/components/ui/IconButton.vue'
import { positionLabel, shiftClasses, shiftPosition, timeOffClasses, timeOffLabel, totalHours, shiftHoursText } from './scheduleDisplay'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'

const props = defineProps({
  dates:               { type: Array, required: true },
  month:               { type: String, default: '' }, // "YYYY-MM"
  employees:           { type: Array, required: true },
  shifts:              { type: Array, required: true },
  timeOff:             { type: Array, default: () => [] },
  warnings:            { type: Object, default: () => ({}) },
  editable:            { type: Boolean, default: false },
  highlightEmployeeId: { type: String, default: null },
})
defineEmits(['add', 'edit'])

const today = localDate()

const days = computed(() => (props.month ? props.dates.filter(d => d.startsWith(props.month)) : props.dates))
const employeeById = computed(() => new Map(props.employees.map(e => [e.id, e])))

function fullName(employeeId) {
  const e = employeeById.value.get(employeeId)
  return e ? `${e.firstName} ${e.lastName}` : ''
}

function dayShifts(date) {
  return props.shifts
    .filter(s => s.date === date && employeeById.value.has(s.employeeId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || fullName(a.employeeId).localeCompare(fullName(b.employeeId)))
}

function dayTimeOff(date) {
  return props.timeOff.filter(r => employeeById.value.has(r.employeeId) && r.startDate <= date && date <= r.endDate)
}
</script>
