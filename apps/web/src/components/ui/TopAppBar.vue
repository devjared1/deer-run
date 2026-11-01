<template>
  <div v-if="autoScroll" ref="sentinel" class="h-px -mb-px" aria-hidden="true" />
  <header
    v-bind="$attrs"
    :class="[
      'app-bar sticky top-0 z-app-bar print:hidden transition duration-short-4 ease-standard',
      tone === 'primary' ? 'app-bar-primary bg-primary text-on-primary' : 'text-on-surface',
      tone !== 'primary' && isScrolled ? 'bg-surface-container' : '',
      tone !== 'primary' && !isScrolled ? 'bg-surface' : '',
      isScrolled ? 'shadow-elevation-2' : 'shadow-none',
    ]"
  >
    <div class="h-16 flex items-center gap-1 px-1">
      <slot name="leading" :tone="tone">
        <button
          v-if="showNav"
          type="button"
          :aria-label="navLabel"
          :aria-expanded="navExpanded === null ? undefined : String(navExpanded)"
          :aria-controls="navControls || undefined"
          :class="[
            'state-layer w-12 h-12 flex-shrink-0 inline-flex items-center justify-center rounded-full cursor-pointer',
            tone === 'primary' ? 'text-on-primary' : 'text-on-surface',
            navClass,
          ]"
          @click="emit('nav', $event)"
        >
          <component :is="navIcon" class="w-6 h-6" aria-hidden="true" />
        </button>
      </slot>

      <div :class="['flex-1 min-w-0', hasLeading ? 'px-1' : 'px-3']">
        <component :is="titleTag" class="text-title-l font-body truncate">
          <slot name="title">{{ title }}</slot>
        </component>
        <div
          v-if="subtitle || $slots.subtitle"
          :class="['text-body-s truncate', tone === 'primary' ? 'text-inverse-primary' : 'text-on-surface-variant']"
        >
          <slot name="subtitle">{{ subtitle }}</slot>
        </div>
      </div>

      <div v-if="$slots.actions" class="flex items-center gap-1 flex-shrink-0">
        <slot name="actions" :tone="tone" />
      </div>
    </div>
    <slot name="bottom" />
  </header>
</template>

<script setup>
// MD3 small top app bar (64dp), sticky at the top of its scroll container, z-app-bar, hidden when printing.
//
// Props:
//   title        — the page title, rendered as `titleTag` (default h1) and truncated. Or use the #title slot.
//   titleTag     — 'h1' (default) | 'h2' | 'div'… (use h2 when the page already has an h1, e.g. the gallery).
//   subtitle     — small line under the title (or the #subtitle slot, e.g. breadcrumbs).
//   tone         — 'surface' (default) | 'primary' (pine, the brand anchor; the focus ring turns gold).
//   scrolled     — true/false to control the on-scroll state yourself; leave it null to detect it: a sentinel
//                  above the bar is watched with an IntersectionObserver (works in the window or a scroll box).
//                  Scrolled: surface → surface-container + elevation 2; primary → elevation 2.
//   showNav      — show the default leading navigation button (emits `nav`).
//   navIcon      — its icon (default menu; pass arrow-back for a back button), navLabel its aria-label.
//   navExpanded  — sets aria-expanded on it (bind the drawer's open state); navControls — aria-controls id.
//   navClass     — extra classes for it, e.g. "lg:hidden" when a standard drawer shows at lg+.
// Emits: nav (MouseEvent).
// Slots: #leading { tone } (replaces the nav button), #title, #subtitle, #actions { tone } (trailing icon buttons,
//   up to 3), #bottom (full-width row under the bar, e.g. tabs or chips).
// In tone="primary", standard IconButtons and text AppButtons inside the slots switch to on-primary text.
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import IconMenu from '~icons/material-symbols/menu-rounded'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  title:       { type: String, default: '' },
  titleTag:    { type: String, default: 'h1' },
  subtitle:    { type: String, default: '' },
  tone:        { type: String, default: 'surface', validator: v => ['surface', 'primary'].includes(v) },
  scrolled:    { type: Boolean, default: null },
  showNav:     { type: Boolean, default: false },
  navIcon:     { type: [Object, Function], default: () => IconMenu },
  navLabel:    { type: String, default: 'Open navigation menu' },
  navExpanded: { type: Boolean, default: null },
  navControls: { type: String, default: '' },
  navClass:    { type: [String, Array, Object], default: '' },
})

const emit = defineEmits(['nav'])
const slots = useSlots()

const hasLeading = computed(() => !!slots.leading || props.showNav)
const autoScroll = computed(() => props.scrolled === null)

const sentinel = ref(null)
const detected = ref(false)
const isScrolled = computed(() => (autoScroll.value ? detected.value : props.scrolled))

let observer = null
function observe() {
  observer?.disconnect()
  observer = null
  if (!autoScroll.value || !sentinel.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(([entry]) => { detected.value = !entry.isIntersecting })
  observer.observe(sentinel.value)
}

onMounted(observe)
watch(sentinel, observe, { flush: 'post' })
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
/* Slotted standard IconButtons / text buttons default to dark text; on pine they switch to on-primary */
.app-bar-primary :deep(.text-on-surface-variant),
.app-bar-primary :deep(.text-primary),
.app-bar-primary :deep(.text-on-surface) {
  color: rgb(var(--md-sys-color-on-primary));
}
</style>
