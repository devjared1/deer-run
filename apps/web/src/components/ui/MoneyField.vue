<template>
  <TextField
    ref="field"
    :model-value="text"
    :label="label"
    :helper="helper"
    :error="error || (touched ? localError : '')"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    prefix="$"
    inputmode="decimal"
    autocomplete="off"
    @update:model-value="onInput"
    @focus="onFocus"
    @blur="onBlur"
  />
</template>

<script setup>
// Dollar amount field with v-model in integer cents (Number, or null when empty).
//   <MoneyField v-model="priceCents" label="Price" :min="0" :max="100000" required />
// Accepts "12", "12.5", "$1,234.56"; shows "1,234.56" when blurred; selects its text on focus so typing replaces it.
// Props: modelValue (cents | null), label, helper, error (from the parent; wins over the field's own), min / max
// (cents), required, disabled, readonly. An unreadable amount or one out of range shows a message after blur and
// sets the input's custom validity, so a surrounding <form> won't submit. Other attributes go to the <input>.
// Exposes focus() and select().
import { computed, ref, watch } from 'vue'
import TextField from './TextField.vue'

const props = defineProps({
  modelValue: { type: Number, default: null },
  label:      { type: String, default: '' },
  helper:     { type: String, default: '' },
  error:      { type: [String, Boolean], default: '' },
  min:        { type: Number, default: null },
  max:        { type: Number, default: null },
  required:   { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
  readonly:   { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const field = ref(null)
const focused = ref(false)
const touched = ref(false)

const format = cents => (cents === null || cents === undefined || Number.isNaN(cents)
  ? ''
  : (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const usd = cents => `$${format(cents)}`

const text = ref(format(props.modelValue))

/** "$1,234.5" → 123450; "" → null; unreadable → NaN */
function parse(value) {
  const s = String(value).replace(/[$,\s]/g, '')
  if (s === '') return null
  if (!/^-?(\d+\.?\d{0,2}|\.\d{1,2})$/.test(s)) return NaN
  return Math.round(Number(s) * 100)
}

const localError = computed(() => {
  const cents = parse(text.value)
  if (Number.isNaN(cents)) return 'Enter an amount like 12.50'
  if (cents === null) return ''
  if (cents < 0 && !(props.min !== null && props.min < 0)) return 'Enter an amount like 12.50'
  if (props.min !== null && cents < props.min) return `Must be at least ${usd(props.min)}`
  if (props.max !== null && cents > props.max) return `Must be ${usd(props.max)} or less`
  return ''
})

const input = () => field.value?.$el?.querySelector('input')
watch(localError, msg => input()?.setCustomValidity(msg))

function onInput(value) {
  text.value = value
  const cents = parse(value)
  if (!Number.isNaN(cents) && cents !== props.modelValue) emit('update:modelValue', cents)
}

function onFocus() {
  focused.value = true
  // After the click's mouseup, which would otherwise collapse the selection in Safari
  setTimeout(() => { if (focused.value) field.value?.select() })
}

function onBlur() {
  focused.value = false
  touched.value = true
  const cents = parse(text.value)
  if (!Number.isNaN(cents)) text.value = format(cents)
}

// Outside changes: reformat when blurred; while typing, only replace text that doesn't already mean this amount
watch(() => props.modelValue, cents => {
  if (!focused.value || parse(text.value) !== cents) text.value = format(cents)
})

defineExpose({
  focus: () => field.value?.focus(),
  select: () => field.value?.select(),
})
</script>
