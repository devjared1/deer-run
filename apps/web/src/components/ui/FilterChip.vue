<template>
  <button
    type="button"
    :role="kind === 'choice' ? 'radio' : undefined"
    :aria-checked="kind === 'choice' ? String(selected) : undefined"
    :aria-pressed="kind === 'filter' ? String(selected) : undefined"
    :disabled="disabled"
    :class="[
      'state-layer inline-flex flex-none items-center justify-center gap-2 rounded-full border font-body whitespace-nowrap select-none',
      'transition-colors duration-short-4 ease-standard',
      size === 'lg' ? 'h-12 px-5 text-label-l' : 'h-8 px-4 text-label-l touch-target',
      showIcon ? (size === 'lg' ? 'pl-3' : 'pl-2') : '',
      stateClass,
    ]"
  >
    <IconCheck v-if="selected && kind === 'filter'" :class="iconClass" aria-hidden="true" />
    <component :is="icon" v-else-if="icon" :class="iconClass" aria-hidden="true" />
    <span class="truncate"><slot>{{ label }}</slot></span>
  </button>
</template>

<script setup>
// MD3 filter chip (toggle, aria-pressed, check icon when selected) or choice chip (kind="choice": role=radio, used
// by ChipGroup for single select). Rounded-full per the design brief. size md (32px, 48px target) | lg (48px, POS).
//   <FilterChip :selected="onlyOpen" label="Open only" @click="onlyOpen = !onlyOpen" />
// Props: selected, label (or default slot), icon (component), kind 'filter' | 'choice', size, disabled.
// Emits the native click (the parent flips `selected`).
import { computed } from 'vue'
import IconCheck from '~icons/material-symbols/check-rounded'

const props = defineProps({
  selected: { type: Boolean, default: false },
  label:    { type: String, default: '' },
  icon:     { type: [Object, Function], default: null },
  kind:     { type: String, default: 'filter', validator: v => ['filter', 'choice'].includes(v) },
  size:     { type: String, default: 'md', validator: v => ['md', 'lg'].includes(v) },
  disabled: { type: Boolean, default: false },
})

const showIcon = computed(() => (props.selected && props.kind === 'filter') || !!props.icon)
const iconClass = computed(() => (props.size === 'lg' ? 'w-5 h-5' : 'w-[18px] h-[18px]'))
const stateClass = computed(() => {
  if (props.disabled) {
    return props.selected
      ? 'border-transparent bg-on-surface/[.12] text-on-surface/[.38] cursor-not-allowed'
      : 'border-on-surface/[.12] text-on-surface/[.38] cursor-not-allowed'
  }
  return props.selected
    ? 'border-transparent bg-secondary-container text-on-secondary-container cursor-pointer'
    : 'border-outline text-on-surface-variant cursor-pointer'
})
</script>
