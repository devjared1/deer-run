<template>
  <fieldset
    class="m-0 p-0 border-0 min-w-0 font-body"
    :disabled="disabled"
    :aria-describedby="supportText ? supportId : undefined"
  >
    <legend v-if="label" :class="['p-0 mb-1 text-label-l', disabled ? 'text-on-surface/[.38]' : error ? 'text-error' : 'text-on-surface-variant']">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </legend>

    <div :class="inline ? 'flex flex-wrap gap-x-4' : 'flex flex-col'">
      <label
        v-for="(o, i) in options"
        :key="String(o.value)"
        :class="['inline-flex items-start select-none', isDisabled(o) ? 'cursor-not-allowed' : 'cursor-pointer']"
      >
        <span class="relative flex-none flex items-center justify-center w-12 h-12">
          <input
            type="radio"
            class="peer absolute inset-0 w-full h-full m-0 opacity-0 cursor-[inherit]"
            :name="groupName"
            :value="String(o.value)"
            :checked="modelValue === o.value"
            :disabled="isDisabled(o)"
            :required="required"
            :aria-describedby="o.description ? `${groupName}-${i}-desc` : undefined"
            @change="emit('update:modelValue', o.value)"
          >
          <span
            :class="[
              'pointer-events-none flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-short-2',
              'peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-0 peer-focus-visible:outline-[rgb(var(--focus-ring))]',
              isDisabled(o) ? '' : 'peer-hover:bg-on-surface/[.08] peer-active:bg-primary/[.1]',
            ]"
          >
            <span :class="['flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors duration-short-4', ringClass(o)]">
              <span
                :class="[
                  'w-2.5 h-2.5 rounded-full transition-transform duration-short-4 ease-standard',
                  modelValue === o.value ? 'scale-100' : 'scale-0',
                  isDisabled(o) ? 'bg-on-surface/[.38]' : error ? 'bg-error' : 'bg-primary',
                ]"
              />
            </span>
          </span>
        </span>
        <span class="min-w-0 py-3 pr-2">
          <span :class="['block text-body-l', isDisabled(o) ? 'text-on-surface/[.38]' : 'text-on-surface']">{{ o.label }}</span>
          <span
            v-if="o.description"
            :id="`${groupName}-${i}-desc`"
            :class="['block text-body-m', isDisabled(o) ? 'text-on-surface/[.38]' : 'text-on-surface-variant']"
          >{{ o.description }}</span>
        </span>
      </label>
    </div>

    <p
      v-if="supportText"
      :id="supportId"
      :class="['px-3 pt-1 text-body-s', typeof error === 'string' && error ? 'text-error' : disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant']"
    >{{ supportText }}</p>
  </fieldset>
</template>

<script>
let uid = 0
</script>

<script setup>
// MD3 radio group: a <fieldset> + <legend> of native radios (arrow keys move the selection), 48px targets,
// clickable labels with optional descriptions.
//   <RadioGroup v-model="refundTo" label="Refund to" :options="[{ value: 'CARD', label: 'Card', description: 'Back to the card used' }]" />
// Props: modelValue, options [{ value, label, description?, disabled? }], label (legend), helper, error (string shows
// the message; true marks it), required, disabled, inline (one wrapping row), name (default generated).
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: null },
  options:    { type: Array, default: () => [] },
  label:      { type: String, default: '' },
  helper:     { type: String, default: '' },
  error:      { type: [String, Boolean], default: '' },
  required:   { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
  inline:     { type: Boolean, default: false },
  name:       { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const n = ++uid
const groupName = computed(() => props.name || `radio-group-${n}`)
const supportId = `radio-group-${n}-support`
const supportText = computed(() => (typeof props.error === 'string' && props.error) || props.helper)

const isDisabled = o => props.disabled || !!o.disabled
function ringClass(o) {
  if (isDisabled(o)) return 'border-on-surface/[.38]'
  if (props.error) return 'border-error'
  return props.modelValue === o.value ? 'border-primary' : 'border-on-surface-variant'
}
</script>
