<template>
  <div class="font-body">
    <div class="flex items-center justify-between gap-2 mb-2">
      <IconButton :icon="IconChevronLeft" label="Previous month" :disabled="!canPrev" @click="shiftMonth(-1)" />
      <h3 :id="captionId" class="text-title-m text-on-surface" aria-live="polite">{{ monthLabel }}</h3>
      <IconButton :icon="IconChevronRight" label="Next month" :disabled="!canNext" @click="shiftMonth(1)" />
    </div>

    <table
      ref="grid"
      role="grid"
      :aria-labelledby="captionId"
      class="w-full table-fixed border-separate border-spacing-1"
      @keydown="onKeydown"
    >
      <thead>
        <tr>
          <th
            v-for="d in WEEKDAYS"
            :key="d.short"
            scope="col"
            :abbr="d.long"
            class="pb-1 text-label-m text-on-surface-variant font-normal"
          >
            {{ d.short }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, w) in weeks" :key="w">
          <td
            v-for="cell in week"
            :key="cell.key"
            :role="cell.ymd ? 'gridcell' : undefined"
            :aria-selected="cell.ymd ? String(cell.ymd === modelValue) : undefined"
            class="p-0 align-top"
          >
            <button
              v-if="cell.ymd"
              type="button"
              :data-date="cell.ymd"
              :tabindex="cell.ymd === focusDate ? 0 : -1"
              :aria-disabled="cell.disabled ? 'true' : undefined"
              :aria-current="cell.ymd === today ? 'date' : undefined"
              :aria-label="cell.aria"
              :class="[
                'state-layer w-full h-16 rounded-shape-sm flex flex-col items-center justify-center gap-0.5',
                'transition-colors duration-short-4 ease-standard',
                cell.disabled ? 'text-on-surface/[.38] cursor-not-allowed'
                : cell.ymd === modelValue ? 'bg-primary text-on-primary cursor-pointer'
                  : 'bg-surface-container-lowest text-on-surface border border-outline-variant cursor-pointer',
                cell.ymd === today && cell.ymd !== modelValue && !cell.disabled ? 'ring-2 ring-inset ring-primary' : '',
              ]"
              @click="pick(cell)"
            >
              <span class="text-title-m tabular-nums">{{ cell.day }}</span>
              <span
                v-if="cell.inWindow && cell.hint"
                :class="[
                  'text-label-s',
                  cell.ymd === modelValue ? 'text-on-primary' : cell.disabled ? '' : 'text-on-surface-variant',
                ]"
                aria-hidden="true"
              >{{ cell.hint }}</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
// Month calendar for the booking Date step (md and up). An ARIA grid: one tab stop; arrows move a day / a week,
// Home / End go to the start / end of the week, PageUp / PageDown a month; Enter or Space picks the day. Movement
// stays inside [min, max] (the booking window). `dayInfo(ymd)` → { hint, disabled, aria } (availability).
import IconButton from '@/components/ui/IconButton.vue'
import { addDays, dayOfWeek, formatLocalDate, localDate } from '@/lib/timeclock'
import { computed, nextTick, ref, watch } from 'vue'
import IconChevronLeft from '~icons/material-symbols/chevron-left-rounded'
import IconChevronRight from '~icons/material-symbols/chevron-right-rounded'

const props = defineProps({
  modelValue: { type: String, default: null },
  min:        { type: String, required: true },
  max:        { type: String, required: true },
  dayInfo:    { type: Function, required: true },
})
const emit = defineEmits(['select'])

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  .map(long => ({ long, short: long.slice(0, 3) }))
const captionId = `booking-cal-${Math.random().toString(36).slice(2, 8)}`
const today = localDate()
const grid = ref(null)

const clamp = ymd => (ymd < props.min ? props.min : ymd > props.max ? props.max : ymd)
const firstEnabled = () => {
  for (let d = props.min; d <= props.max; d = addDays(d, 1)) if (!props.dayInfo(d).disabled) return d
  return props.min
}
const focusDate = ref(props.modelValue && props.modelValue >= props.min && props.modelValue <= props.max ? props.modelValue : firstEnabled())
const viewMonth = ref(focusDate.value.slice(0, 7)) // "YYYY-MM"

watch(() => props.modelValue, (v) => { if (v && v >= props.min && v <= props.max) focusDate.value = v })

const monthLabel = computed(() => formatLocalDate(`${viewMonth.value}-01`, { month: 'long', year: 'numeric' }))
const canPrev = computed(() => viewMonth.value > props.min.slice(0, 7))
const canNext = computed(() => viewMonth.value < props.max.slice(0, 7))

const weeks = computed(() => {
  const first = `${viewMonth.value}-01`
  const cells = []
  for (let i = 0; i < dayOfWeek(first); i++) cells.push({ key: `lead-${i}` })
  for (let d = first; d.slice(0, 7) === viewMonth.value; d = addDays(d, 1)) {
    const inWindow = d >= props.min && d <= props.max
    const info = inWindow ? props.dayInfo(d) : {}
    const label = formatLocalDate(d, { weekday: 'long', month: 'long', day: 'numeric' })
    cells.push({
      key: d,
      ymd: d,
      day: Number(d.slice(8)),
      inWindow,
      hint: info.hint,
      disabled: !inWindow || !!info.disabled,
      aria: inWindow ? [label, info.aria].filter(Boolean).join(', ') : `${label}, not bookable online yet`,
    })
  }
  while (cells.length % 7) cells.push({ key: `trail-${cells.length}` })
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
})

function pick(cell) {
  if (cell.disabled) return
  focusDate.value = cell.ymd
  emit('select', cell.ymd)
}

function moveTo(ymd) {
  const target = clamp(ymd)
  focusDate.value = target
  viewMonth.value = target.slice(0, 7)
  nextTick(() => grid.value?.querySelector(`[data-date="${target}"]`)?.focus())
}

function addMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return `${first.toISOString().slice(0, 8)}${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

function shiftMonth(n) {
  const month = addMonths(`${viewMonth.value}-01`, n).slice(0, 7)
  viewMonth.value = month
  // Keep the tab stop on a day of the shown month
  const start = clamp(`${month}-01`)
  focusDate.value = start.slice(0, 7) === month ? start : focusDate.value
}

function onKeydown(e) {
  const from = focusDate.value
  const dow = dayOfWeek(from)
  const moves = {
    ArrowLeft: () => addDays(from, -1),
    ArrowRight: () => addDays(from, 1),
    ArrowUp: () => addDays(from, -7),
    ArrowDown: () => addDays(from, 7),
    Home: () => addDays(from, -dow),
    End: () => addDays(from, 6 - dow),
    PageUp: () => addMonths(from, -1),
    PageDown: () => addMonths(from, 1),
  }
  if (!moves[e.key]) return
  e.preventDefault()
  moveTo(moves[e.key]())
}
</script>
