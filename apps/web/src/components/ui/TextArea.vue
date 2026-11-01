<template>
  <TextField
    :id="id"
    :model-value="modelValue"
    :label="label"
    :helper="helper"
    :error="error"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    :counter="counterText"
  >
    <template #control="{ bind }">
      <textarea
        ref="area"
        v-bind="bind"
        :value="modelValue ?? ''"
        :rows="autoGrow ? Math.max(1, rows) : rows"
        :maxlength="maxlength || undefined"
        :class="['py-4 resize-none', autoGrow ? 'overflow-hidden' : '']"
        @input="onInput"
      />
    </template>
  </TextField>
</template>

<script setup>
// MD3 outlined multi-line text field.
//   <TextArea v-model="notes" label="Notes" :maxlength="500" counter auto-grow />
// Props: modelValue, label, helper, error, required, disabled, readonly, id, rows (default 3; the starting height
// with autoGrow), autoGrow (grows with the text instead of scrolling), maxlength, counter (shows "n / maxlength").
// Other attributes (name, placeholder, autocomplete…) go to the <textarea>.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import TextField from './TextField.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label:      { type: String, default: '' },
  helper:     { type: String, default: '' },
  error:      { type: [String, Boolean], default: '' },
  required:   { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
  readonly:   { type: Boolean, default: false },
  id:         { type: String, default: '' },
  rows:       { type: Number, default: 3 },
  autoGrow:   { type: Boolean, default: false },
  maxlength:  { type: Number, default: null },
  counter:    { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const area = ref(null)

const counterText = computed(() => {
  if (!props.counter) return ''
  const len = (props.modelValue ?? '').length
  return props.maxlength ? `${len} / ${props.maxlength}` : String(len)
})

function resize() {
  const el = area.value
  if (!props.autoGrow || !el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onInput(e) {
  emit('update:modelValue', e.target.value)
  resize()
}

watch(() => props.modelValue, () => nextTick(resize))
onMounted(resize)
</script>
