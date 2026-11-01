<template>
  <div
    :tabindex="editable ? undefined : 0"
    :role="editable ? undefined : 'region'"
    :aria-label="editable ? undefined : (caption || 'Schedule')"
    class="schedule-grid overflow-x-auto rounded-shape-md border border-outline-variant bg-surface-container-lowest print:overflow-visible print:rounded-none"
  >
    <!-- Read-only, the grid has nothing to focus: the scroll box takes focus so the keyboard can scroll it sideways -->
    <table class="w-full text-body-s font-body border-collapse">
      <caption v-if="caption" class="sr-only">{{ caption }}</caption>
      <thead>
        <tr class="bg-surface-container border-b border-outline-variant text-left">
          <th scope="col" class="name-col bg-surface-container px-4 py-2 text-label-m text-on-surface-variant uppercase tracking-wider">
            Employee
          </th>
          <th
            v-for="date in dates"
            :key="date"
            scope="col"
            :class="['px-2 py-2 text-label-m text-center whitespace-nowrap border-l border-outline-variant',
              date === today ? 'text-primary bg-primary/[.06]' : 'text-on-surface-variant']"
          >
            <div class="uppercase tracking-wider">{{ formatLocalDate(date, { weekday: 'short' }) }}</div>
            <div class="text-on-surface">
              {{ formatLocalDate(date, { month: 'short', day: 'numeric' }) }}<span v-if="date === today" class="sr-only"> (today)</span>
            </div>
          </th>
          <th scope="col" class="px-3 py-2 text-label-m text-on-surface-variant uppercase tracking-wider text-right border-l border-outline-variant">
            Hours
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="emp in employees"
          :key="emp.id"
          :class="['border-b border-outline-variant align-top', emp.id === highlightEmployeeId ? 'bg-gold-container/40' : '']"
        >
          <th
            scope="row"
            :class="['name-col px-4 py-2 text-left font-normal', emp.id === highlightEmployeeId ? 'bg-gold-container' : 'bg-surface-container-lowest']"
          >
            <div class="text-title-s text-on-surface whitespace-nowrap">
              {{ emp.firstName }} {{ emp.lastName }}
            </div>
            <div class="text-body-s text-on-surface-variant whitespace-nowrap">
              {{ positionLabel(emp.position) }}<span v-if="!emp.active" class="text-error"> · Inactive</span>
            </div>
          </th>
          <td
            v-for="date in dates"
            :key="date"
            :class="['day-cell px-1.5 py-1.5 border-l border-outline-variant', date === today ? 'bg-primary/[.04]' : '',
              editable ? 'cursor-pointer hover:bg-gold-container/50 print:cursor-auto' : '']"
            @click="editable && $emit('add', { employeeId: emp.id, date })"
          >
            <div
              v-if="timeOffOn(timeOff, emp.id, date)"
              :class="['time-off text-[11px] leading-tight rounded-shape-xs px-1.5 py-0.5 mb-1 border whitespace-nowrap',
                       timeOffClasses(timeOffOn(timeOff, emp.id, date))]"
            >
              {{ timeOffLabel(timeOffOn(timeOff, emp.id, date)) }}
            </div>
            <component
              :is="editable ? 'button' : 'div'"
              v-for="shift in cell(emp.id, date)"
              :key="shift.id"
              :type="editable ? 'button' : undefined"
              :class="['shift-chip block w-full text-left text-label-m leading-tight rounded-shape-xs border px-1.5 py-1 mb-1 last:mb-0',
                       shiftClasses(shift, emp), editable ? 'hover:ring-2 hover:ring-gold/60 cursor-pointer' : '',
                       warnings[shift.id] ? 'ring-1 ring-error print:ring-0' : '']"
              :title="shiftTitle(shift, emp)"
              @click.stop="editable && $emit('edit', shift)"
            >
              <!-- Named by its visible text plus sr-only context (an aria-label wouldn't contain "9a–5p") -->
              <span v-if="editable" class="sr-only">Edit shift for {{ emp.firstName }} {{ emp.lastName }}, {{ formatLocalDate(date, { weekday: 'long', month: 'short', day: 'numeric' }) }}: </span>
              <span class="flex items-center gap-0.5">
                <span class="font-bold whitespace-nowrap">{{ shortTime(shift.startTime) }}–{{ shortTime(shift.endTime) }}</span>
                <IconWarning v-if="warnings[shift.id]" class="w-3.5 h-3.5 flex-none text-error print:hidden" aria-hidden="true" />
                <span v-if="warnings[shift.id]" class="sr-only">Warning: {{ warnings[shift.id].join('; ') }}</span>
              </span>
              <span v-if="shift.position && shift.position !== emp.position" class="block text-[10px] truncate">
                {{ positionLabel(shift.position) }}
              </span>
              <span v-if="shift.notes" class="block text-[10px] truncate">{{ shift.notes }}</span>
            </component>
            <!-- An empty cell is one button, so the keyboard can reach it -->
            <button
              v-if="editable && !cell(emp.id, date).length"
              type="button"
              class="add-cell state-layer group flex items-center justify-center w-full min-h-10 rounded-shape-xs text-on-surface-variant print:hidden"
              :aria-label="`Add shift for ${emp.firstName} ${emp.lastName} on ${formatLocalDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}`"
              @click.stop="$emit('add', { employeeId: emp.id, date })"
            >
              <IconAdd class="w-5 h-5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
            </button>
          </td>
          <td class="px-3 py-2 text-right tabular-nums text-on-surface-variant whitespace-nowrap border-l border-outline-variant">
            {{ rowShifts(emp.id).length ? totalHours(rowShifts(emp.id)) : '—' }}
          </td>
        </tr>
        <tr v-if="!employees.length">
          <td :colspan="dates.length + 2">
            <EmptyState compact :icon="IconGroupOff" title="No employees to show" />
          </td>
        </tr>
      </tbody>
      <tfoot v-if="employees.length">
        <tr class="bg-surface-container text-label-m text-on-surface-variant">
          <th scope="row" class="name-col bg-surface-container px-4 py-2 text-left uppercase tracking-wider">
            Scheduled
          </th>
          <td v-for="date in dates" :key="date" class="px-2 py-2 text-center tabular-nums border-l border-outline-variant">
            {{ dayShifts(date).length ? totalHours(dayShifts(date)) : '' }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums text-on-surface border-l border-outline-variant">
            {{ visibleShifts.length ? totalHours(visibleShifts) : '' }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup>
// Week / two-week schedule grid: one row per employee (sticky name column), one column per day, hours per row and day.
//   <ScheduleGrid :dates :employees :shifts :time-off :warnings editable @add="({ employeeId, date }) => …" @edit="shift => …" />
// Props: dates ("YYYY-MM-DD"[]), employees, shifts, timeOff (requests), warnings ({ [shiftId]: string[] } from
// scheduleWarnings()), editable (shifts and empty cells become buttons; clicking a cell's free space adds a shift),
// highlightEmployeeId (the signed-in employee's row on the staff page), caption (screen reader table caption).
import { computed } from 'vue'
import { formatLocalDate, localDate } from '@/lib/timeclock'
import { shortTime, longTime } from '@/lib/schedule'
import EmptyState from '@/components/ui/EmptyState.vue'
import { positionLabel, shiftClasses, timeOffClasses, timeOffOn, timeOffLabel, totalHours, shiftHoursText } from './scheduleDisplay'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconGroupOff from '~icons/material-symbols/group-off-rounded'

const props = defineProps({
  dates:               { type: Array, required: true },
  employees:           { type: Array, required: true },
  shifts:              { type: Array, required: true },
  timeOff:             { type: Array, default: () => [] },
  warnings:            { type: Object, default: () => ({}) },
  editable:            { type: Boolean, default: false },
  highlightEmployeeId: { type: String, default: null },
  caption:             { type: String, default: '' },
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
  const day = formatLocalDate(shift.date, { weekday: 'short', month: 'short', day: 'numeric' })
  const lines = [`${emp.firstName} ${emp.lastName}, ${day}: ${longTime(shift.startTime)} – ${longTime(shift.endTime)} (${shiftHoursText(shift)})`]
  if (shift.position && shift.position !== emp.position) lines.push(`Working as ${positionLabel(shift.position)}`)
  if (shift.notes) lines.push(shift.notes)
  for (const w of props.warnings[shift.id] ?? []) lines.push(`Warning: ${w}`)
  return lines.join('\n')
}
</script>

<style scoped>
.name-col { @apply sticky left-0 z-10 min-w-[10rem]; }
.day-cell { min-width: 5.5rem; }

@media print {
  .schedule-grid table { font-size: 9pt; }
  .name-col { position: static; min-width: 0; }
  .day-cell { min-width: 0; }
  th, td { border: 1px solid rgb(var(--md-sys-color-outline)) !important; }
  .shift-chip, .time-off { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr { break-inside: avoid; }
}
</style>
