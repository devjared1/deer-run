<template>
  <label :class="['inline-flex items-start font-body select-none', disabled ? 'cursor-not-allowed' : 'cursor-pointer']">
    <span class="relative flex-none flex items-center justify-center w-12 h-12">
      <input
        :id="inputId"
        ref="input"
        type="checkbox"
        class="peer absolute inset-0 w-full h-full m-0 opacity-0 cursor-[inherit]"
        :checked="isChecked"
        :value="value ?? undefined"
        :disabled="disabled"
        :aria-describedby="helper ? helperId : undefined"
        :aria-invalid="error ? 'true' : undefined"
        @change="onChange"
      >
      <!-- 40px state layer around the 18px box; the native input above it takes the clicks and focus -->
      <span
        :class="[
          'pointer-events-none flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-short-2',
          'peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-0 peer-focus-visible:outline-[rgb(var(--focus-ring))]',
          disabled ? '' : 'peer-hover:bg-on-surface/[.08] peer-active:bg-primary/[.1]',
        ]"
      >
        <span :class="['flex items-center justify-center w-[18px] h-[18px] rounded-[2px] transition-colors duration-short-4', boxClass]">
          <IconRemove v-if="indeterminate" class="w-4 h-4" aria-hidden="true" />
          <IconCheck v-else-if="isChecked" class="w-4 h-4" aria-hidden="true" />
        </span>
      </span>
    </span>
    <span v-if="label || $slots.default || helper" class="min-w-0 py-3 pr-2">
      <span :class="['block text-body-l', disabled ? 'text-on-surface/[.38]' : 'text-on-surface']"><slot>{{ label }}</slot></span>
      <span
        v-if="helper"
        :id="helperId"
        :class="['block text-body-m', disabled ? 'text-on-surface/[.38]' : error ? 'text-error' : 'text-on-surface-variant']"
      >{{ helper }}</span>
    </span>
  </label>
</template>

<script>
let uid = 0
</script>

<script setup>
// MD3 checkbox: 18px box in a 48px target; the label (prop or default slot) and helper text are clickable.
//   <Checkbox v-model="ownCart" label="Own cart" />
//   <Checkbox v-model="selectedIds" :value="item.id" :label="item.name" />   (array v-model: adds/removes value)
// Props: modelValue (Boolean, or an Array with `value`), value, label, helper, error (Boolean: error colors),
// indeterminate, disabled, id.
import { computed, onMounted, ref, watch } from 'vue'
import IconCheck from '~icons/material-symbols/check-rounded'
import IconRemove from '~icons/material-symbols/remove-rounded'

const props = defineProps({
  modelValue:    { type: [Boolean, Array], default: false },
  value:         { type: [String, Number, Boolean, Object], default: null },
  label:         { type: String, default: '' },
  helper:        { type: String, default: '' },
  error:         { type: Boolean, default: false },
  indeterminate: { type: Boolean, default: false },
  disabled:      { type: Boolean, default: false },
  id:            { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const n = ++uid
const inputId = computed(() => props.id || `checkbox-${n}`)
const helperId = `checkbox-${n}-helper`
const input = ref(null)

const isChecked = computed(() => (Array.isArray(props.modelValue) ? props.modelValue.includes(props.value) : props.modelValue))
const on = computed(() => isChecked.value || props.indeterminate)

const boxClass = computed(() => {
  if (props.disabled) return on.value ? 'bg-on-surface/[.38] text-surface' : 'border-2 border-on-surface/[.38]'
  if (props.error) return on.value ? 'bg-error text-on-error' : 'border-2 border-error'
  return on.value ? 'bg-primary text-on-primary' : 'border-2 border-on-surface-variant'
})

function onChange(e) {
  const checked = e.target.checked
  if (Array.isArray(props.modelValue)) {
    const rest = props.modelValue.filter(v => v !== props.value)
    emit('update:modelValue', checked ? [...rest, props.value] : rest)
  } else {
    emit('update:modelValue', checked)
  }
}

const syncIndeterminate = () => { if (input.value) input.value.indeterminate = props.indeterminate }
watch(() => props.indeterminate, syncIndeterminate)
onMounted(syncIndeterminate)
</script>
