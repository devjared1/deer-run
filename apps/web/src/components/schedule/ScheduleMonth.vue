<template>
  <div>
    <!-- Calendar grid at md+ (and when printing) -->
    <div class="schedule-month hidden md:block print:block rounded-shape-md border border-outline-variant bg-surface-container-lowest overflow-hidden print:rounded-none">
      <div class="grid grid-cols-7 bg-surface-container border-b border-outline-variant" aria-hidden="true">
        <div
          v-for="date in dates.slice(0, 7)"
          :key="date"
          class="px-2 py-2 text-label-m text-on-surface-variant uppercase tracking-wider text-center"
        >
          {{ formatLocalDate(date, { weekday: 'short' }) }}
        </div>
      </div>
      <div class="grid grid-cols-7">
        <div
          v-for="date in dates"
          :key="date"
          :class="['day group/day min-h-[7rem] border-b border-r border-outline-variant p-1.5 min-w-0',
                   inMonth(date) ? '' : 'bg-surface-container-low',
                   date === today ? 'bg-primary/[.04]' : '',
                   editable && inMonth(date) ? 'cursor-pointer hover:bg-gold-container/50 print:cursor-auto' : '']"
          @click="editable && inMonth(date) && $emit('add', { employeeId: null, date })"
        >
          <div class="flex items-center justify-between gap-1 mb-1">
            <span
              :class="['text-label-m', date === today ? 'text-primary font-bold' : inMonth(date) ? 'text-on-surface' : 'text-on-surface-variant']"
              :aria-hidden="inMonth(date) ? undefined : 'true'"
            >
              <span class="sr-only">{{ formatLocalDate(date, { weekday: 'long', month: 'long' }) }} </span>{{ Number(date.slice(8)) }}
            </span>
            <button
              v-if="editable && inMonth(date)"
              type="button"
              class="state-layer inline-flex items-center justify-center w-6 h-6 rounded-full text-on-surface-variant opacity-0 group-hover/day:opacity-100 focus-visible:opacity-100 print:hidden"
              :aria-label="`Add shift on ${formatLocalDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}`"
              @click.stop="$emit('add', { employeeId: null, date })"
            >
              <IconAdd class="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <template v-if="inMonth(date)">
            <div
              v-for="r in dayTimeOff(date)"
              :key="r.id"
              :class="['time-off text-[10px] leading-tight border rounded-shape-xs px-1 mb-0.5 truncate', timeOffClasses(r)]"
            >
              {{ name(r.employeeId) }} · {{ timeOffLabel(r) }}
            </div>
            <component
              :is="editable ? 'button' : 'div'"
              v-for="shift in dayShifts(date)"
              :key="shift.id"
              :type="editable ? 'button' : undefined"
              :class="['shift-chip flex items-center gap-0.5 w-full text-left text-[11px] leading-tight rounded-shape-xs border px-1 py-0.5 mb-0.5',
                       shiftClasses(shift, employeeById.get(shift.employeeId)),
                       shift.employeeId === highlightEmployeeId ? 'font-bold' : '',
                       editable ? 'hover:ring-2 hover:ring-gold/60 cursor-pointer' : '',
                       warnings[shift.id] ? 'ring-1 ring-error print:ring-0' : '']"
              :title="chipTitle(shift)"
              @click.stop="editable && $emit('edit', shift)"
            >
              <!-- Named by the visible text (label in name), with "Edit shift" and any warning for screen readers -->
              <span v-if="editable" class="sr-only">Edit shift: </span>
              <span class="truncate"><span class="font-bold">{{ shortTime(shift.startTime) }}–{{ shortTime(shift.endTime) }}</span> {{ name(shift.employeeId) }}</span>
              <IconWarning v-if="warnings[shift.id]" class="w-3 h-3 flex-none text-error print:hidden" aria-hidden="true" />
              <span v-if="warnings[shift.id]" class="sr-only">. Warning: {{ warnings[shift.id].join('; ') }}</span>
            </component>
          </template>
        </div>
      </div>
    </div>

    <!-- Phones: a day-by-day list instead of the grid -->
    <ScheduleAgenda
      class="md:hidden print:hidden"
      :dates="dates"
      :month="month"
      :employees="employees"
      :shifts="shifts"
      :time-off="timeOff"
      :warnings="warnings"
      :editable="editable"
      :highlight-employee-id="highlightEmployeeId"
      @add="$emit('add', $event)"
      @edit="$emit('edit', $event)"
    />
  </div>
</template>

<script setup>
// Month schedule: a calendar grid at md+ (and in print), the ScheduleAgenda day list below md.
//   <ScheduleMonth :dates :month="'2026-11'" :employees :shifts :time-off :warnings editable @add @edit />
// Props: dates (whole weeks covering the month), month ("YYYY-MM"), employees, shifts, timeOff, warnings
// ({ [shiftId]: string[] }), editable (days and shifts become buttons), highlightEmployeeId (bold on the staff page).
// Emits add({ employeeId: null, date }) and edit(shift).
import { computed } from 'vue'
import { formatLocalDate, localDate } from '@/lib/timeclock'
import { shortTime, longTime } from '@/lib/schedule'
import ScheduleAgenda from './ScheduleAgenda.vue'
import { shiftClasses, timeOffClasses, timeOffLabel } from './scheduleDisplay'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconAdd from '~icons/material-symbols/add-rounded'

const props = defineProps({
  dates:               { type: Array, required: true }, // whole weeks covering the month
  month:               { type: String, required: true }, // "YYYY-MM"
  employees:           { type: Array, required: true },
  shifts:              { type: Array, required: true },
  timeOff:             { type: Array, default: () => [] },
  warnings:            { type: Object, default: () => ({}) },
  editable:            { type: Boolean, default: false },
  highlightEmployeeId: { type: String, default: null },
})
defineEmits(['add', 'edit'])

const today = localDate()

const employeeById = computed(() => new Map(props.employees.map(e => [e.id, e])))

function inMonth(date) {
  return date.startsWith(props.month)
}

function name(employeeId) {
  const e = employeeById.value.get(employeeId)
  return e ? `${e.firstName} ${e.lastName.charAt(0)}.` : ''
}

function chipTitle(shift) {
  const e = employeeById.value.get(shift.employeeId)
  const lines = [`${e ? `${e.firstName} ${e.lastName}` : ''}: ${longTime(shift.startTime)} – ${longTime(shift.endTime)}`]
  if (shift.notes) lines.push(shift.notes)
  for (const w of props.warnings[shift.id] ?? []) lines.push(`Warning: ${w}`)
  return lines.join('\n')
}

function dayShifts(date) {
  return props.shifts
    .filter(s => s.date === date && employeeById.value.has(s.employeeId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || name(a.employeeId).localeCompare(name(b.employeeId)))
}

function dayTimeOff(date) {
  return props.timeOff.filter(r => employeeById.value.has(r.employeeId) && r.startDate <= date && date <= r.endDate)
}
</script>

<style scoped>
@media print {
  .schedule-month { font-size: 8pt; }
  .day { min-height: 0; border: 1px solid rgb(var(--md-sys-color-outline)) !important; break-inside: avoid; }
  .shift-chip, .time-off { white-space: normal; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .shift-chip .truncate { white-space: normal; }
}
</style>
