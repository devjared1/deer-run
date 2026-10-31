<template>
  <div class="schedule-grid overflow-x-auto bg-white rounded-xl border border-gray-200 print:overflow-visible print:border-gray-400 print:rounded-none">
    <table class="w-full text-sm font-body border-collapse">
      <thead>
        <tr class="bg-gray-50 border-b border-gray-200 text-left">
          <th class="name-col px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-semibold">
            Employee
          </th>
          <th
            v-for="date in dates"
            :key="date"
            :class="['px-2 py-2 text-xs font-semibold text-center whitespace-nowrap border-l border-gray-100',
              date === today ? 'text-pine bg-pine/5' : 'text-gray-500']"
          >
            <div class="uppercase tracking-wider">{{ formatLocalDate(date, { weekday: 'short' }) }}</div>
            <div class="text-bark">{{ formatLocalDate(date, { month: 'numeric', day: 'numeric' }) }}</div>
          </th>
          <th class="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider font-semibold text-right border-l border-gray-100">
            Hours
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="emp in employees"
          :key="emp.id"
          :class="['border-b border-gray-100 align-top', emp.id === highlightEmployeeId ? 'bg-amber/5' : '']"
        >
          <td class="name-col px-4 py-2">
            <div class="font-semibold text-bark whitespace-nowrap">
              {{ emp.firstName }} {{ emp.lastName }}
            </div>
            <div class="text-xs text-gray-400 whitespace-nowrap">
              {{ positionLabel(emp.position) }}<span v-if="!emp.active" class="text-red-500"> · inactive</span>
            </div>
          </td>
          <td
            v-for="date in dates"
            :key="date"
            :class="['day-cell px-1.5 py-1.5 border-l border-gray-100', date === today ? 'bg-pine/5' : '',
              editable ? 'cursor-pointer hover:bg-amber/10 print:cursor-auto' : '']"
            @click="editable && $emit('add', { employeeId: emp.id, date })"
          >
            <div
              v-if="timeOffOn(timeOff, emp.id, date)"
              :class="['time-off text-[11px] leading-tight rounded px-1.5 py-0.5 mb-1 border border-dashed whitespace-nowrap',
                timeOffOn(timeOff, emp.id, date).status === 'PENDING' ? 'border-amber text-amber-dark' : 'border-gray-400 text-gray-500 bg-gray-50']"
            >
              {{ timeOffLabel(timeOffOn(timeOff, emp.id, date)) }}
            </div>
            <button
              v-for="shift in cell(emp.id, date)"
              :key="shift.id"
              type="button"
              :class="['shift-chip block w-full text-left text-xs leading-tight rounded border px-1.5 py-1 mb-1 last:mb-0',
                shiftClasses(shift, emp), editable ? 'hover:ring-2 hover:ring-amber/60' : 'cursor-default',
                warnings[shift.id] ? 'ring-1 ring-red-400 print:ring-0' : '']"
              :title="shiftTitle(shift, emp)"
              @click.stop="editable && $emit('edit', shift)"
            >
              <span class="font-semibold whitespace-nowrap">{{ shortTime(shift.startTime) }}–{{ shortTime(shift.endTime) }}</span>
              <span v-if="warnings[shift.id]" class="text-red-500 ml-0.5 print:hidden">⚠</span>
              <span v-if="shift.position && shift.position !== emp.position" class="block text-[10px] opacity-80 truncate">
                {{ positionLabel(shift.position) }}
              </span>
              <span v-if="shift.notes" class="block text-[10px] opacity-70 truncate">{{ shift.notes }}</span>
            </button>
          </td>
          <td class="px-3 py-2 text-right tabular-nums text-gray-600 whitespace-nowrap border-l border-gray-100">
            {{ rowShifts(emp.id).length ? totalHours(rowShifts(emp.id)) : '—' }}
          </td>
        </tr>
        <tr v-if="!employees.length">
          <td :colspan="dates.length + 2" class="px-5 py-8 text-center text-gray-400">
            No employees to show.
          </td>
        </tr>
      </tbody>
      <tfoot v-if="employees.length">
        <tr class="bg-gray-50 text-xs text-gray-500">
          <td class="name-col px-4 py-2 font-semibold uppercase tracking-wider">
            Scheduled
          </td>
          <td v-for="date in dates" :key="date" class="px-2 py-2 text-center tabular-nums border-l border-gray-100">
            {{ dayShifts(date).length ? totalHours(dayShifts(date)) : '' }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums font-semibold text-bark border-l border-gray-100">
            {{ visibleShifts.length ? totalHours(visibleShifts) : '' }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatLocalDate, localDate } from '@/lib/timeclock'
import { shortTime, longTime, shiftMinutes } from '@/lib/schedule'
import { positionLabel, shiftClasses, timeOffOn, timeOffLabel, totalHours } from './scheduleDisplay'

const props = defineProps({
  dates:               { type: Array, required: true },
  employees:           { type: Array, required: true },
  shifts:              { type: Array, required: true },
  timeOff:             { type: Array, default: () => [] },
  warnings:            { type: Object, default: () => ({}) },
  editable:            { type: Boolean, default: false },
  highlightEmployeeId: { type: String, default: null },
})
defineEmits(['add', 'edit'])

const today = localDate()

const shown = computed(() => new Set(props.employees.map(e => e.id)))
const dateSet = computed(() => new Set(props.dates))
const visibleShifts = computed(() => props.shifts.filter(s => shown.value.has(s.employeeId) && dateSet.value.has(s.date)))

const byCell = computed(() => {
  const map = new Map()
  for (const s of visibleShifts.value) {
    const key = `${s.employeeId}|${s.date}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(s)
  }
  for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  return map
})

function cell(employeeId, date) {
  return byCell.value.get(`${employeeId}|${date}`) ?? []
}

function rowShifts(employeeId) {
  return visibleShifts.value.filter(s => s.employeeId === employeeId)
}

function dayShifts(date) {
  return visibleShifts.value.filter(s => s.date === date)
}

function shiftTitle(shift, emp) {
  const hours = (shiftMinutes(shift) / 60).toFixed(2).replace(/\.?0+$/, '')
  const lines = [`${emp.firstName} ${emp.lastName}: ${longTime(shift.startTime)} – ${longTime(shift.endTime)} (${hours}h)`]
  if (shift.notes) lines.push(shift.notes)
  for (const w of props.warnings[shift.id] ?? []) lines.push(`⚠ ${w}`)
  return lines.join('\n')
}
</script>

<style scoped>
.name-col { @apply sticky left-0 bg-white z-10 min-w-[10rem]; }
thead .name-col, tfoot .name-col { @apply bg-gray-50; }
.day-cell { min-width: 5.5rem; }

@media print {
  .schedule-grid table { font-size: 9pt; }
  .name-col { position: static; min-width: 0; }
  .day-cell { min-width: 0; }
  th, td { border: 1px solid #9ca3af !important; }
  .shift-chip, .time-off { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr { break-inside: avoid; }
}
</style>
