<template>
  <nav
    ref="root"
    :aria-label="label"
    :class="[
      'inset-x-0 bottom-0 z-app-bar pb-[env(safe-area-inset-bottom)] print:hidden',
      contained ? 'absolute' : 'fixed',
      tone === 'primary' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface',
      elevated ? 'shadow-elevation-2' : '',
    ]"
  >
    <ul class="h-20 flex items-stretch justify-around gap-2 px-2">
      <li v-for="(item, ii) in items" :key="itemKey(item, ii)" class="flex-1 min-w-0 max-w-[168px] flex">
        <RouterLink v-if="!isActionItem(item)" v-slot="{ href, navigate }" :to="item.to" custom>
          <a
            :href="href"
            :aria-current="isActive(item) ? 'page' : undefined"
            :class="DEST"
            @click="onItemClick($event, item, navigate)"
          >
            <span :class="pillClass(item)">
              <component :is="item.icon" v-if="item.icon" class="w-6 h-6" aria-hidden="true" />
              <template v-if="hasBadge(item)">
                <span v-if="isDotBadge(item)" class="absolute top-1 left-[38px] w-1.5 h-1.5 rounded-full bg-error" aria-hidden="true" />
                <span v-else :class="BADGE" aria-hidden="true">{{ badgeText(item) }}</span>
              </template>
            </span>
            <span :class="labelClass(item)">{{ item.label }}</span>
            <span v-if="hasBadge(item)" class="sr-only">, {{ badgeA11yLabel(item) }}</span>
          </a>
        </RouterLink>
        <button
          v-else
          type="button"
          :aria-expanded="typeof item.expanded === 'boolean' ? String(item.expanded) : undefined"
          :aria-haspopup="item.action === 'more' ? 'true' : undefined"
          :class="DEST"
          @click="onItemClick($event, item)"
        >
          <span :class="pillClass(item)">
            <component :is="item.icon" v-if="item.icon" class="w-6 h-6" aria-hidden="true" />
            <template v-if="hasBadge(item)">
              <span v-if="isDotBadge(item)" class="absolute top-1 left-[38px] w-1.5 h-1.5 rounded-full bg-error" aria-hidden="true" />
              <span v-else :class="BADGE" aria-hidden="true">{{ badgeText(item) }}</span>
            </template>
          </span>
          <span :class="labelClass(item)">{{ item.label }}</span>
          <span v-if="hasBadge(item)" class="sr-only">, {{ badgeA11yLabel(item) }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<script setup>
// MD3 navigation bar for phones: 80dp tall, fixed to the bottom with safe-area padding, z-app-bar, hidden when
// printing. 3–5 destinations, each an icon in a 64×32 indicator pill with a label under it.
//
// Props:
//   items     — 3–5 items (shape: see ./navItems.js). A `{ label: 'More', icon, action: 'more' }` item renders a
//               button that emits `more` (open a drawer or sheet with the rest; set `expanded` while it's open and
//               `active` while the current page is one of the overflow pages).
//   label     — aria-label of the <nav> landmark (default "Main").
//   tone      — 'surface' (default, surface-container) | 'primary' (pine, gold-container active indicator).
//   elevated  — add elevation 2 (MD3 bars are flat; use it when content scrolls under without a divider).
//   contained — position inside the nearest positioned ancestor (the /dev/ui gallery) and leave
//               --snackbar-offset alone.
// While mounted and visible it sets `--snackbar-offset` on :root to its height + 16px (incl. the safe area), so
// snackbars clear it; hiding it with CSS (md:hidden) resets the offset, and unmounting removes it.
// Emits: select (item, event — every item click; event.preventDefault() cancels a link), more (event).
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { badgeA11yLabel, badgeText, hasBadge, isActionItem, isActiveRoute, isDotBadge, itemKey } from './navItems.js'

const props = defineProps({
  items:     { type: Array, default: () => [], validator: v => v.length <= 5 },
  label:     { type: String, default: 'Main' },
  tone:      { type: String, default: 'surface', validator: v => ['surface', 'primary'].includes(v) },
  elevated:  { type: Boolean, default: false },
  contained: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'more'])
const route = useRoute()
const root = ref(null)

function isActive(item) {
  return isActiveRoute(route, item)
}

function onItemClick(event, item, navigate) {
  emit('select', item, event)
  if (item.action === 'more') emit('more', event)
  if (navigate) navigate(event)
}

const DEST = 'nav-dest w-full flex flex-col items-center justify-center gap-1 pt-3 pb-4 rounded-shape-md no-underline cursor-pointer select-none outline-offset-[-3px]'

function pillClass(item) {
  const active = isActive(item)
  const base = 'state-layer relative w-16 h-8 rounded-full inline-flex items-center justify-center flex-shrink-0 transition-colors duration-short-4 ease-standard'
  if (props.tone === 'primary') return [base, active ? 'bg-gold-container text-on-gold-container' : 'text-on-primary']
  return [base, active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant']
}

function labelClass(item) {
  const active = isActive(item)
  const base = 'text-label-m text-center truncate max-w-full px-1'
  if (props.tone === 'primary') return [base, 'text-on-primary']
  return [base, active ? 'text-on-surface' : 'text-on-surface-variant']
}

const BADGE = 'absolute -top-1 left-[34px] min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-label-s inline-flex items-center justify-center'

// ── --snackbar-offset: clear the bar while it's on screen ──
let resizeObserver = null
function setOffset(height) {
  const style = document.documentElement.style
  if (height > 0) style.setProperty('--snackbar-offset', `${Math.ceil(height) + 16}px`)
  else style.removeProperty('--snackbar-offset')
}

onMounted(() => {
  if (props.contained || !root.value) return
  setOffset(root.value.offsetHeight)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => setOffset(root.value?.offsetHeight ?? 0))
    resizeObserver.observe(root.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (!props.contained) setOffset(0)
})
</script>

<style scoped>
/* Hover / focus / press anywhere on the destination lights the state layer on its indicator pill */
.nav-dest:hover .state-layer::before { opacity: var(--md-sys-state-hover); }
.nav-dest:focus-visible .state-layer::before,
.nav-dest:active .state-layer::before { opacity: var(--md-sys-state-pressed); }
</style>
