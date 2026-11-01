<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to || undefined"
    :type="to ? undefined : type"
    :disabled="to || focusableWhenDisabled ? undefined : disabled"
    :aria-disabled="disabled && focusableWhenDisabled ? 'true' : undefined"
    :aria-label="label"
    :aria-pressed="toggle ? String(!!selected) : undefined"
    :title="tooltip ? label : undefined"
    :class="[
      'state-layer inline-flex items-center justify-center rounded-full flex-shrink-0 transition-colors duration-short-4',
      SIZES[size],
      disabled ? 'text-on-surface/[.38] cursor-not-allowed' : `${variantClass} cursor-pointer`,
    ]"
    @click.capture="blockWhenDisabled"
  >
    <component :is="icon" :class="ICON_SIZES[size]" aria-hidden="true" />
  </component>
</template>

<script setup>
// MD3 icon button: 48×48 touch target, required aria-label. variant: standard | filled | tonal | outlined |
// inherit (current text color, for dark surfaces). `toggle` + `selected` for on/off buttons. `tooltip` shows the label on hover.
// `focusableWhenDisabled`: disabled through aria-disabled (clicks blocked) so it keeps focus, e.g. a − / + stepper
// whose button disables itself at the limit while it has focus.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  icon:     { type: [Object, Function], required: true },
  label:    { type: String, required: true },
  variant:  { type: String, default: 'standard', validator: v => ['standard', 'filled', 'tonal', 'outlined', 'inherit'].includes(v) },
  size:     { type: String, default: 'md', validator: v => ['sm', 'md', 'lg'].includes(v) },
  type:     { type: String, default: 'button' },
  to:       { type: [String, Object], default: null },
  disabled: { type: Boolean, default: false },
  toggle:   { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  tooltip:  { type: Boolean, default: false },
  focusableWhenDisabled: { type: Boolean, default: false },
})

// Capture phase on the button itself runs before the parent's @click
function blockWhenDisabled(event) {
  if (!props.disabled || !props.focusableWhenDisabled) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

// sm is for dense tables only (still 40px); md and lg meet the 48dp target
const SIZES = { sm: 'w-10 h-10 touch-target', md: 'w-12 h-12', lg: 'w-14 h-14' }
const ICON_SIZES = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' }

const variantClass = computed(() => {
  const on = props.toggle && props.selected
  switch (props.variant) {
    case 'filled': return on || !props.toggle ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-primary'
    case 'tonal': return on ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'
    case 'outlined': return on ? 'bg-inverse-surface text-inverse-on-surface' : 'border border-outline text-on-surface-variant'
    // Takes the surrounding text color: for dark surfaces (pine app bars, heroes)
    case 'inherit': return 'text-current'
    default: return on ? 'text-primary' : 'text-on-surface-variant'
  }
})
</script>
