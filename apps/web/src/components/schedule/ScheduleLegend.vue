<template>
  <div class="schedule-legend flex flex-wrap items-center gap-x-4 gap-y-2 text-body-s text-on-surface-variant font-body">
    <span class="text-label-m uppercase tracking-wider">Legend</span>
    <ul class="contents">
      <li v-for="d in DEPARTMENT_LEGEND" :key="d.department" class="inline-flex items-center gap-1.5">
        <span :class="['swatch inline-block w-4 h-4 rounded-shape-xs border', d.classes]" aria-hidden="true" />
        {{ d.department }}
      </li>
      <li v-if="timeOff" class="inline-flex items-center gap-1.5">
        <span :class="['swatch inline-block w-4 h-4 rounded-shape-xs border', TIME_OFF_CLASSES.APPROVED]" aria-hidden="true" />
        Off (approved time off)
      </li>
      <li v-if="timeOff" class="inline-flex items-center gap-1.5">
        <span :class="['swatch inline-block w-4 h-4 rounded-shape-xs border', TIME_OFF_CLASSES.PENDING]" aria-hidden="true" />
        Requested off (pending)
      </li>
      <li v-if="warnings" class="inline-flex items-center gap-1.5 print:hidden">
        <IconWarning class="w-4 h-4 text-error" aria-hidden="true" />
        Warning: overlap, time off or inactive employee
      </li>
    </ul>
  </div>
</template>

<script setup>
// The schedule's color key: one swatch per department (shift colors follow the position worked), time off
// approved/pending, and the warning icon.
//   <ScheduleLegend />   <ScheduleLegend :warnings="false" />   (staff pages without warnings)
import { DEPARTMENT_LEGEND, TIME_OFF_CLASSES } from './scheduleDisplay'
import IconWarning from '~icons/material-symbols/warning-rounded'

defineProps({
  timeOff:  { type: Boolean, default: true },
  warnings: { type: Boolean, default: true },
})
</script>

<style scoped>
@media print {
  .swatch { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
