<template>
  <fieldset class="m-0 p-0 border-0 min-w-0 font-body" :disabled="disabled">
    <legend v-if="label" :class="['p-0 text-label-l', disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant']">{{ label }}</legend>

    <ChipGroup
      v-if="presetOptions.length"
      :model-value="activePreset"
      :options="presetOptions"
      type="choice"
      scroll
      :disabled="disabled"
      :label="label ? `${label} presets` : 'Date presets'"
      @update:model-value="applyPreset"
    />

    <div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 mt-2">
      <TextField
        type="date"
        label="From"
        :model-value="modelValue.from || ''"
        :min="min || undefined"
        :max="modelValue.to || max || undefined"
        :disabled="disabled"
        :required="required"
        :error="typeof error === 'string' ? !!error : error"
        @update:model-value="v => update({ from: v })"
      />
      <TextField
        type="date"
        label="To"
        :model-value="modelValue.to || ''"
        :min="modelValue.from || min || undefined"
        :max="max || undefined"
        :disabled="disabled"
        :required="required"
        :error="rangeError"
        @update:model-value="v => update({ to: v })"
      />
    </div>
  </fieldset>
</template>

<script>
// Module scope so defineProps can use it
const PRESETS = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  last7: 'Last 7 days',
  thisPayPeriod: 'This pay period',
  thisMonth: 'This month',
  lastMonth: 'Last month',
}
</script>

<script setup>
// A from/to date range (course-local "YYYY-MM-DD") with preset chips: Today, Yesterday, This week, Last 7 days,
// This pay period, This month, Last month. The chip matching the current range shows as selected.
//   <DateRangeField v-model="range" label="Dates" :pay-period="{ anchor: settings.payPeriodAnchor, lengthDays: settings.payPeriodDays }" />
// Props: modelValue { from, to }, label (legend), presets (keys to show, in order; [] hides them: today, yesterday,
// thisWeek, last7, thisPayPeriod, thisMonth, lastMonth), payPeriod { anchor, lengthDays } (default
// DEFAULT_PAY_PERIOD; weeks start on the anchor's weekday, like the workweek), min / max, required, disabled,
// error (string: message under To; true: both marked). "To before From" shows its own error.
import { computed } from 'vue'
import ChipGroup from './ChipGroup.vue'
import TextField from './TextField.vue'
import { DEFAULT_PAY_PERIOD, addDays, dayOfWeek, localDate, payPeriodContaining, weekStart } from '../../lib/timeclock.js'

const props = defineProps({
  modelValue: { type: Object, default: () => ({ from: '', to: '' }) },
  label:      { type: String, default: '' },
  presets:    { type: Array, default: () => Object.keys(PRESETS) },
  payPeriod:  { type: Object, default: () => DEFAULT_PAY_PERIOD },
  min:        { type: String, default: '' },
  max:        { type: String, default: '' },
  required:   { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
  error:      { type: [String, Boolean], default: '' },
})
const emit = defineEmits(['update:modelValue'])

const monthStart = ymd => `${ymd.slice(0, 7)}-01`
const monthEnd = ymd => addDays(monthStart(addDays(monthStart(ymd), 32)), -1)

function rangeFor(key, today = localDate()) {
  switch (key) {
    case 'today': return { from: today, to: today }
    case 'yesterday': { const y = addDays(today, -1); return { from: y, to: y } }
    case 'thisWeek': { const s = weekStart(today, dayOfWeek(props.payPeriod.anchor)); return { from: s, to: addDays(s, 6) } }
    case 'last7': return { from: addDays(today, -6), to: today }
    case 'thisPayPeriod': { const p = payPeriodContaining(today, props.payPeriod); return { from: p.start, to: p.end } }
    case 'thisMonth': return { from: monthStart(today), to: monthEnd(today) }
    case 'lastMonth': { const d = addDays(monthStart(today), -1); return { from: monthStart(d), to: d } }
    default: return null
  }
}

const presetOptions = computed(() => props.presets.filter(k => PRESETS[k]).map(k => ({ value: k, label: PRESETS[k] })))
const activePreset = computed(() => {
  const today = localDate()
  const hit = props.presets.find(k => {
    const r = rangeFor(k, today)
    return r && r.from === props.modelValue.from && r.to === props.modelValue.to
  })
  return hit ?? null
})

const rangeError = computed(() => {
  const { from, to } = props.modelValue
  if (from && to && to < from) return 'Ends before it starts'
  return props.error
})

function update(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
function applyPreset(key) {
  const r = rangeFor(key)
  if (r) emit('update:modelValue', r)
}
</script>
