<template>
  <div
    ref="root"
    :role="multiple ? 'group' : 'radiogroup'"
    :aria-label="label || undefined"
    :class="[block ? 'flex w-full' : 'inline-flex max-w-full', 'font-body']"
    @keydown="onKeydown"
  >
    <button
      v-for="(o, i) in options"
      :key="String(o.value)"
      type="button"
      :role="multiple ? undefined : 'radio'"
      :aria-checked="multiple ? undefined : String(isSelected(o))"
      :aria-pressed="multiple ? String(isSelected(o)) : undefined"
      :tabindex="multiple || i === tabIndexAt ? 0 : -1"
      :disabled="isDisabled(o)"
      :class="[
        'state-layer inline-flex items-center justify-center gap-2 px-3 border text-label-l whitespace-nowrap',
        'transition-colors duration-short-4 ease-standard focus-visible:z-10',
        size === 'lg' ? 'h-12' : 'h-10 touch-target',
        block ? 'flex-1 min-w-0' : 'min-w-12',
        i === 0 ? 'rounded-l-full pl-4' : '-ml-px',
        i === options.length - 1 ? 'rounded-r-full pr-4' : '',
        isDisabled(o) ? 'border-on-surface/[.12] text-on-surface/[.38] cursor-not-allowed' : 'border-outline cursor-pointer',
        !isDisabled(o) && isSelected(o) ? 'bg-secondary-container text-on-secondary-container' : '',
        !isDisabled(o) && !isSelected(o) ? 'text-on-surface' : '',
      ]"
      @click="toggle(o)"
    >
      <IconCheck v-if="isSelected(o)" class="w-[18px] h-[18px] -ml-1" aria-hidden="true" />
      <component :is="o.icon" v-else-if="o.icon" class="w-[18px] h-[18px] -ml-1" aria-hidden="true" />
      <span class="truncate">{{ o.label }}</span>
    </button>
  </div>
</template>

<script setup>
// MD3 segmented button. Single select (default) is a radiogroup: one tab stop, arrow keys / Home / End move the
// selection. `multiple` makes a group of toggle buttons (aria-pressed) and v-model an array.
//   <SegmentedButton v-model="view" label="View" :options="[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]" />
// Props: modelValue (value, or array with `multiple`), options [{ value, label, icon?, disabled? }], multiple,
// label (accessible name of the group), block (fill the width), size md (40px, 48px target) | lg (48px, POS), disabled.
import { computed, nextTick, ref } from 'vue'
import IconCheck from '~icons/material-symbols/check-rounded'

const props = defineProps({
  modelValue: { type: [String, Number, Boolean, Array], default: null },
  options:    { type: Array, default: () => [] },
  multiple:   { type: Boolean, default: false },
  label:      { type: String, default: '' },
  block:      { type: Boolean, default: false },
  size:       { type: String, default: 'md', validator: v => ['md', 'lg'].includes(v) },
  disabled:   { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null)

const isDisabled = o => props.disabled || !!o.disabled
const isSelected = o => (props.multiple ? (props.modelValue || []).includes(o.value) : props.modelValue === o.value)

// Roving tabindex: the selected option, else the first enabled one
const tabIndexAt = computed(() => {
  const sel = props.options.findIndex(o => isSelected(o) && !isDisabled(o))
  return sel >= 0 ? sel : props.options.findIndex(o => !isDisabled(o))
})

function toggle(o) {
  if (isDisabled(o)) return
  if (!props.multiple) return emit('update:modelValue', o.value)
  const list = props.modelValue || []
  emit('update:modelValue', list.includes(o.value) ? list.filter(v => v !== o.value) : [...list, o.value])
}

function onKeydown(e) {
  if (props.multiple) return
  const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'first', End: 'last' }
  const move = keys[e.key]
  if (move === undefined) return
  e.preventDefault()
  const enabled = props.options.map((o, i) => i).filter(i => !isDisabled(props.options[i]))
  if (!enabled.length) return
  const current = enabled.indexOf(tabIndexAt.value)
  const next = move === 'first' ? enabled[0]
    : move === 'last' ? enabled[enabled.length - 1]
      : enabled[(current + move + enabled.length) % enabled.length]
  emit('update:modelValue', props.options[next].value)
  nextTick(() => root.value?.children[next]?.focus())
}
</script>
