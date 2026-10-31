<template>
  <div class="schedule-month bg-white rounded-xl border border-gray-200 overflow-hidden print:rounded-none print:border-gray-400">
    <div class="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
      <div
        v-for="date in dates.slice(0, 7)"
        :key="date"
        class="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider font-semibold text-center"
      >
        {{ formatLocalDate(date, { weekday: 'short' }) }}
      </div>
    </div>
    <div class="grid grid-cols-7">
      <div
        v-for="date in dates"
        :key="date"
        :class="['day min-h-[7rem] border-b border-r border-gray-100 p-1.5',
          inMonth(date) ? '' : 'bg-gray-50/70 text-gray-300',
          date === today ? 'bg-pine/5' : '',
          editable && inMonth(date) ? 'cursor-pointer hover:bg-amber/10 print:cursor-auto' : '']"
        @click="editable && inMonth(date) && $emit('add', { employeeId: null, date })"
      >
        <div :class="['text-xs font-semibold mb-1', date === today ? 'text-pine' : inMonth(date) ? 'text-bark' : 'text-gray-300']">
          {{ Number(date.slice(8)) }}
        </div>
        <template v-if="inMonth(date)">
          <div
            v-for="r in dayTimeOff(date)"
            :key="r.id"
            class="time-off text-[10px] leading-tight text-gray-500 border border-dashed border-gray-400 rounded px-1 mb-0.5 truncate"
          >
            {{ name(r.employeeId) }} · {{ timeOffLabel(r) }}
          </div>
          <button
            v-for="shift in dayShifts(date)"
            :key="shift.id"
            type="button"
            :class="['shift-chip block w-full text-left text-[11px] leading-tight rounded border px-1 py-0.5 mb-0.5 truncate',
              shiftClasses(shift, employeeById.get(shift.employeeId)),
              shift.employeeId === highlightEmployeeId ? 'font-bold' : '',
              editable ? 'hover:ring-2 hover:ring-amber/60' : 'cursor-default',
              warnings[shift.id] ? 'ring-1 ring-red-400 print:ring-0' : '']"
            :title="(warnings[shift.id] ?? []).map(w => `⚠ ${w}`).join('\n') || shift.notes || ''"
            @click.stop="editable && $emit('edit', shift)"
          >
            <span class="font-semibold">{{ shortTime(shift.startTime) }}–{{ shortTime(shift.endTime) }}</span>
            {{ name(shift.employeeId) }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatLocalDate, localDate } from '@/lib/timeclock'
import { shortTime } from '@/lib/schedule'
import { shiftClasses, timeOffLabel } from './scheduleDisplay'

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
  .day { min-height: 0; border: 1px solid #9ca3af !important; break-inside: avoid; }
  .shift-chip, .time-off { white-space: normal; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
