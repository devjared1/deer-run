<template>
  <component
    :is="tag"
    v-bind="linkAttrs"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' ? isDisabled : undefined"
    :aria-disabled="tag !== 'button' && isDisabled ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :class="classes"
  >
    <ProgressIndicator v-if="loading" :size="iconSize" class="-ml-1" />
    <component :is="icon" v-else-if="icon" :class="['-ml-1', iconClass]" aria-hidden="true" />
    <span class="truncate"><slot /></span>
    <component :is="trailingIcon" v-if="trailingIcon && !loading" :class="['-mr-1', iconClass]" aria-hidden="true" />
  </component>
</template>

<script setup>
// MD3 common button. variant: filled (pine) | gold (the brand call to action) | tonal | outlined | text | danger.
// size: md (40px; still a 48px touch target through padding of the hit area) | lg (48px) | xl (64px, POS).
// `to` renders a RouterLink, `href` an <a>. `loading` shows a spinner and disables the button.
// Icons: pass a component, e.g. :icon="IconAdd" (import IconAdd from '~icons/material-symbols/add-rounded').
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ProgressIndicator from './ProgressIndicator.vue'

const props = defineProps({
  variant:      { type: String, default: 'filled', validator: v => ['filled', 'gold', 'tonal', 'outlined', 'text', 'danger'].includes(v) },
  size:         { type: String, default: 'md', validator: v => ['md', 'lg', 'xl'].includes(v) },
  type:         { type: String, default: 'button' },
  to:           { type: [String, Object], default: null },
  href:         { type: String, default: null },
  icon:         { type: [Object, Function], default: null },
  trailingIcon: { type: [Object, Function], default: null },
  loading:      { type: Boolean, default: false },
  disabled:     { type: Boolean, default: false },
  block:        { type: Boolean, default: false },
})

const isDisabled = computed(() => props.disabled || props.loading)
const tag = computed(() => (props.to && !isDisabled.value ? RouterLink : props.href ? 'a' : 'button'))
const linkAttrs = computed(() => (props.to && !isDisabled.value ? { to: props.to } : props.href ? { href: props.href } : {}))

const SIZES = {
  md: 'h-10 px-6 text-label-l gap-2 touch-target',
  lg: 'h-12 px-6 text-label-l gap-2',
  xl: 'h-16 px-8 text-title-m gap-3',
}
const ICON = { md: 'w-[18px] h-[18px]', lg: 'w-5 h-5', xl: 'w-6 h-6' }
const iconClass = computed(() => ICON[props.size])
const iconSize = computed(() => ({ md: 18, lg: 20, xl: 24 })[props.size])

const VARIANTS = {
  filled:   'bg-primary text-on-primary hover:shadow-elevation-1',
  gold:     'bg-gold text-on-gold hover:shadow-elevation-1',
  tonal:    'bg-secondary-container text-on-secondary-container hover:shadow-elevation-1',
  outlined: 'border border-outline text-primary bg-transparent',
  text:     'text-primary bg-transparent px-3',
  danger:   'bg-error text-on-error hover:shadow-elevation-1',
}
// MD3 disabled: content 38%, container 12%
const DISABLED = {
  filled: 'bg-on-surface/[.12] text-on-surface/[.38]',
  gold: 'bg-on-surface/[.12] text-on-surface/[.38]',
  tonal: 'bg-on-surface/[.12] text-on-surface/[.38]',
  outlined: 'border border-on-surface/[.12] text-on-surface/[.38]',
  text: 'text-on-surface/[.38] px-3',
  danger: 'bg-on-surface/[.12] text-on-surface/[.38]',
}

const classes = computed(() => [
  'state-layer inline-flex items-center justify-center rounded-full font-body select-none whitespace-nowrap',
  'transition-shadow duration-short-4 ease-standard no-underline',
  SIZES[props.size],
  props.block ? 'w-full' : '',
  isDisabled.value ? `${DISABLED[props.variant]} cursor-not-allowed shadow-none` : `${VARIANTS[props.variant]} cursor-pointer`,
])
</script>
