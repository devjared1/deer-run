<template>
  <component
    :is="rootTag"
    v-bind="linkAttrs"
    :type="rootTag === 'button' ? 'button' : undefined"
    :class="[
      'flex flex-col rounded-shape-md overflow-hidden text-left text-on-surface font-body',
      VARIANTS[variant],
      interactive ? `state-layer w-full no-underline cursor-pointer transition-shadow duration-short-4 ease-standard ${HOVER[variant]}` : '',
    ]"
  >
    <div v-if="$slots.media" class="flex-shrink-0">
      <slot name="media" />
    </div>
    <div v-if="$slots.header" :class="['flex items-start gap-3', PAD[padding], $slots.default ? 'pb-0' : '']">
      <slot name="header" />
    </div>
    <div v-if="$slots.default" :class="['flex-1 min-w-0', PAD[padding]]">
      <slot />
    </div>
    <div v-if="$slots.footer" :class="['flex flex-wrap items-center justify-end gap-2', PAD[padding], $slots.default || $slots.header ? 'pt-0' : '']">
      <slot name="footer" />
    </div>
  </component>
</template>

<script setup>
// MD3 card, 12dp corners. variant: elevated (surface-container-low + elevation 1) | filled | outlined.
// padding: none | sm (12px) | md (16px, default) | lg (24px), applied to header, body and footer.
// Slots: media (edge to edge, top), header, default (body), footer (right-aligned actions).
// Interactive cards: `to` (RouterLink), `href` (<a>) or `clickable` (a <button>; listen with @click) get a state layer,
// hover elevation and the focus ring. Don't put buttons or links inside an interactive card.
// `tag` sets the element of a static card (e.g. 'section', 'article', 'li').
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  variant:   { type: String, default: 'elevated', validator: v => ['elevated', 'filled', 'outlined'].includes(v) },
  padding:   { type: String, default: 'md', validator: v => ['none', 'sm', 'md', 'lg'].includes(v) },
  to:        { type: [String, Object], default: null },
  href:      { type: String, default: null },
  clickable: { type: Boolean, default: false },
  tag:       { type: String, default: 'div' },
})
// @click falls through to the root element (not declared as an emit on purpose)

const interactive = computed(() => !!(props.to || props.href || props.clickable))
const rootTag = computed(() => (props.to ? RouterLink : props.href ? 'a' : props.clickable ? 'button' : props.tag))
const linkAttrs = computed(() => (props.to ? { to: props.to } : props.href ? { href: props.href } : {}))

const VARIANTS = {
  elevated: 'bg-surface-container-low shadow-elevation-1',
  filled:   'bg-surface-container-highest',
  outlined: 'bg-surface border border-outline-variant',
}
const HOVER = {
  elevated: 'hover:shadow-elevation-2',
  filled:   'hover:shadow-elevation-1',
  outlined: 'hover:shadow-elevation-1',
}
const PAD = { none: 'p-0', sm: 'p-3', md: 'p-4', lg: 'p-6' }
</script>
