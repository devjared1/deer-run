<template>
  <div class="flex items-center gap-1 font-body min-w-0">
    <IconButton :icon="IconPrev" :label="`Previous ${unit}`" :disabled="!canPrev || disabled" @click="go(-1)" />

    <div class="relative min-w-0">
      <button
        type="button"
        :disabled="disabled"
        :aria-label="`${title}. Choose a date`"
        :class="[
          'state-layer flex items-center gap-2 h-12 px-4 rounded-full text-title-m min-w-0 max-w-full',
          disabled ? 'text-on-surface/[.38] cursor-not-allowed' : 'text-on-surface cursor-pointer',
        ]"
        @click="openPicker"
      >
        <IconCalendar class="w-5 h-5 flex-none text-on-surface-variant" aria-hidden="true" />
        <span class="truncate" aria-live="polite">{{ title }}</span>
      </button>
      <!-- The native picker, hidden behind the title so it opens anchored there -->
      <input
        ref="picker"
        type="date"
        tabindex="-1"
        aria-hidden="true"
        class="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
        :value="modelValue"
        :min="min || undefined"
        :max="max || undefined"
        @change="onPick"
      >
    </div>

    <IconButton :icon="IconNext" :label="`Next ${unit}`" :disabled="!canNext || disabled" @click="go(1)" />
    <AppButton v-if="today" variant="text" :disabled="disabled || isToday" class="ml-1" @click="emit('update:modelValue', clamp(todayYmd()))">
      Today
    </AppButton>
  </div>
</template>

<script setup>
// Date navigation: ‹ previous / tappable title (opens the native date picker) / next ›, plus an optional Today button.
//   <DateStepper v-model="date" today />          <DateStepper v-model="weekOf" step="week" />
// Props: modelValue ("YYYY-MM-DD", course-local), step (days as a Number, default 1, or 'week' | 'month'),
// formatTitle (fn: ymd → title; default "Sun, Nov 1", "Week of Nov 1" or "November 2026"), min / max
// ("YYYY-MM-DD"), today (show the Today button), disabled.
import { computed, ref } from 'vue'
import AppButton from './AppButton.vue'
import IconButton from './IconButton.vue'
import { addDays, formatLocalDate, isValidYmd, localDate } from '../../lib/timeclock.js'
import IconPrev from '~icons/material-symbols/chevron-left-rounded'
import IconNext from '~icons/material-symbols/chevron-right-rounded'
import IconCalendar from '~icons/material-symbols/calendar-today-rounded'

const props = defineProps({
  modelValue:  { type: String, required: true },
  step:        { type: [Number, String], default: 1, validator: v => typeof v === 'number' || ['week', 'month'].includes(v) },
  formatTitle: { type: Function, default: null },
  min:         { type: String, default: '' },
  max:         { type: String, default: '' },
  today:       { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const picker = ref(null)

const todayYmd = () => localDate()
const isToday = computed(() => props.modelValue === todayYmd())
const unit = computed(() => (props.step === 'week' ? 'week' : props.step === 'month' ? 'month' : props.step === 1 ? 'day' : `${props.step} days`))

/** Same day n months later, clamped to the month's length (Jan 31 + 1 → Feb 28) */
function addMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, last))
  return first.toISOString().slice(0, 10)
}

function shift(ymd, dir) {
  if (props.step === 'month') return addMonths(ymd, dir)
  return addDays(ymd, dir * (props.step === 'week' ? 7 : props.step))
}

const clamp = ymd => (props.min && ymd < props.min ? props.min : props.max && ymd > props.max ? props.max : ymd)
const canPrev = computed(() => !props.min || shift(props.modelValue, -1) >= props.min)
const canNext = computed(() => !props.max || shift(props.modelValue, 1) <= props.max)

const title = computed(() => {
  if (!isValidYmd(props.modelValue)) return 'Choose a date'
  if (props.formatTitle) return props.formatTitle(props.modelValue)
  if (props.step === 'month') return formatLocalDate(props.modelValue, { month: 'long', year: 'numeric' })
  const sameYear = props.modelValue.slice(0, 4) === todayYmd().slice(0, 4)
  const opts = sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  if (props.step === 'week') return `Week of ${formatLocalDate(props.modelValue, opts)}`
  return formatLocalDate(props.modelValue, { weekday: 'short', ...opts })
})

function go(dir) {
  emit('update:modelValue', clamp(shift(props.modelValue, dir)))
}

function openPicker() {
  const el = picker.value
  if (!el) return
  try {
    if (el.showPicker) return el.showPicker()
  } catch { /* not allowed here (e.g. inside a cross-origin frame): fall back */ }
  el.focus()
  el.click()
}

function onPick(e) {
  if (isValidYmd(e.target.value)) emit('update:modelValue', clamp(e.target.value))
}
</script>
