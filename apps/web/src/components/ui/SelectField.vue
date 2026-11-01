<template>
  <TextField
    :id="id"
    :model-value="hasValue ? String(modelValue) : ''"
    :label="label"
    :helper="helper"
    :error="error"
    :required="required"
    :disabled="disabled"
    :leading-icon="leadingIcon"
    :float-label="!!placeholder"
  >
    <template #control="{ bind }">
      <select
        v-bind="bind"
        v-model="model"
        :class="[
          'absolute inset-0 w-full h-full pr-12 appearance-none',
          leadingIcon ? 'pl-[52px]' : 'pl-4',
          disabled ? '' : 'cursor-pointer',
        ]"
      >
        <option v-if="placeholder || !required" :value="null" :disabled="required">{{ placeholder }}</option>
        <slot>
          <option v-for="o in options" :key="String(o.value)" :value="o.value" :disabled="o.disabled">{{ o.label }}</option>
        </slot>
      </select>
      <IconArrowDrop
        :class="['absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none', disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant']"
        aria-hidden="true"
      />
    </template>
    <!-- No error icon: the <select> fills the box absolutely, so the icon would sit over the text. The red outline and
         message carry the error. -->
    <template #trailing />
  </TextField>
</template>

<script setup>
// MD3 outlined select with a native <select> underneath (the OS picker is best on touch and for screen readers).
//   <SelectField v-model="position" label="Position" :options="[{ value: 'PRO_SHOP', label: 'Pro shop' }]" />
// Props: modelValue (any value, null = none), options [{ value, label, disabled? }] (or <option>s in the default
// slot), placeholder (text of the empty option; floats the label), label, helper, error, required (the empty option
// can't be picked back), disabled, leadingIcon, id. Other attributes (name, autocomplete…) go to the <select>.
import { computed } from 'vue'
import TextField from './TextField.vue'
import IconArrowDrop from '~icons/material-symbols/arrow-drop-down-rounded'

const props = defineProps({
  modelValue:  { type: [String, Number, Boolean, Object], default: null },
  options:     { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  label:       { type: String, default: '' },
  helper:      { type: String, default: '' },
  error:       { type: [String, Boolean], default: '' },
  required:    { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },
  leadingIcon: { type: [Object, Function], default: null },
  id:          { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const hasValue = computed(() => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '')
</script>
