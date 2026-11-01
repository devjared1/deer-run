<template>
  <div
    :class="[
      'w-20 flex-shrink-0 flex flex-col items-center gap-1 pt-2 pb-4 overflow-y-auto print:hidden',
      tone === 'primary' ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface',
      contained ? 'h-full' : 'sticky top-0 h-screen',
    ]"
  >
    <button
      v-if="showMenu"
      type="button"
      :aria-label="menuLabel"
      :aria-expanded="menuExpanded === null ? undefined : String(menuExpanded)"
      :aria-controls="menuControls || undefined"
      :class="[
        'state-layer w-12 h-12 flex-shrink-0 inline-flex items-center justify-center rounded-full cursor-pointer',
        tone === 'primary' ? 'text-on-primary' : 'text-on-surface-variant',
      ]"
      @click="emit('menu', $event)"
    >
      <component :is="menuIcon" class="w-6 h-6" aria-hidden="true" />
    </button>

    <div v-if="$slots.header" class="flex flex-col items-center gap-2 pt-1 pb-2">
      <slot name="header" :tone="tone" />
    </div>
    <div v-if="$slots.fab" class="pt-1 pb-3">
      <slot name="fab" :tone="tone" />
    </div>

    <nav :aria-label="label" :class="['w-full flex-1', align === 'center' ? 'flex flex-col justify-center' : '']">
      <ul class="flex flex-col gap-3 pt-1">
        <li v-for="(item, ii) in items" :key="itemKey(item, ii)">
          <RouterLink v-if="!isActionItem(item)" v-slot="{ href, navigate }" :to="item.to" custom>
            <a
              :href="href"
              :aria-current="isActive(item) ? 'page' : undefined"
              :class="destClass(item)"
              @click="onItemClick($event, item, navigate)"
            >
              <span :class="pillClass(item)">
                <component :is="item.icon" v-if="item.icon" class="w-6 h-6" aria-hidden="true" />
                <template v-if="hasBadge(item)">
                  <span v-if="isDotBadge(item)" class="absolute top-1 left-[34px] w-1.5 h-1.5 rounded-full bg-error" aria-hidden="true" />
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
            :class="destClass(item)"
            @click="onItemClick($event, item)"
          >
            <span :class="pillClass(item)">
              <component :is="item.icon" v-if="item.icon" class="w-6 h-6" aria-hidden="true" />
              <template v-if="hasBadge(item)">
                <span v-if="isDotBadge(item)" class="absolute top-1 left-[34px] w-1.5 h-1.5 rounded-full bg-error" aria-hidden="true" />
                <span v-else :class="BADGE" aria-hidden="true">{{ badgeText(item) }}</span>
              </template>
            </span>
            <span :class="labelClass(item)">{{ item.label }}</span>
            <span v-if="hasBadge(item)" class="sr-only">, {{ badgeA11yLabel(item) }}</span>
          </button>
        </li>
      </ul>
    </nav>

    <div v-if="$slots.footer" class="flex flex-col items-center gap-1 pt-2">
      <slot name="footer" :tone="tone" />
    </div>
  </div>
</template>

<script setup>
// MD3 navigation rail (80dp wide) for tablets: sticky, full height, next to the content in a flex row.
//
// Props:
//   items        — the destinations (3–7; item shape: see ./navItems.js). Labels show under the icon, so keep
//                  them short ("Tee sheet", not "Tee Sheet Management").
//   label        — aria-label of the <nav> landmark (default "Main").
//   tone         — 'surface' (default) | 'primary' (pine, gold-container active indicator).
//   align        — 'top' (default) | 'center' (MD3 allows either for the destinations).
//   showMenu     — show the menu button at the top (emits `menu`, e.g. to open a modal NavDrawer with everything);
//                  menuIcon / menuLabel / menuExpanded (aria-expanded) / menuControls (aria-controls).
//   contained    — fill the parent's height instead of the viewport (the /dev/ui gallery).
// Emits: menu (MouseEvent), select (item, event — every item click; event.preventDefault() cancels a link),
//   more (event — a `{ action: 'more' }` item).
// Slots: #header { tone } (e.g. <BrandLogo variant="mark" :size="40" />), #fab { tone } (a FAB under the menu),
//   #footer { tone } (bottom: account, sign out icon buttons).
import { RouterLink, useRoute } from 'vue-router'
import IconMenu from '~icons/material-symbols/menu-rounded'
import { badgeA11yLabel, badgeText, hasBadge, isActionItem, isActiveRoute, isDotBadge, itemKey } from './navItems.js'

const props = defineProps({
  items:        { type: Array, default: () => [] },
  label:        { type: String, default: 'Main' },
  tone:         { type: String, default: 'surface', validator: v => ['surface', 'primary'].includes(v) },
  align:        { type: String, default: 'top', validator: v => ['top', 'center'].includes(v) },
  showMenu:     { type: Boolean, default: false },
  menuIcon:     { type: [Object, Function], default: () => IconMenu },
  menuLabel:    { type: String, default: 'Open navigation menu' },
  menuExpanded: { type: Boolean, default: null },
  menuControls: { type: String, default: '' },
  contained:    { type: Boolean, default: false },
})

const emit = defineEmits(['menu', 'select', 'more'])
const route = useRoute()

function isActive(item) {
  return isActiveRoute(route, item)
}

function onItemClick(event, item, navigate) {
  emit('select', item, event)
  if (item.action === 'more') emit('more', event)
  if (navigate) navigate(event)
}

// The whole destination is the target (≥ 56px tall); the state layer shows on the indicator pill (scoped CSS below)
function destClass() {
  // Inset focus ring: the rail scrolls, so an outside ring would be clipped at its edges
  return 'nav-dest w-full flex flex-col items-center gap-1 py-1 rounded-shape-md no-underline cursor-pointer select-none outline-offset-[-3px]'
}

function pillClass(item) {
  const active = isActive(item)
  const base = 'state-layer relative w-14 h-8 rounded-full inline-flex items-center justify-center transition-colors duration-short-4 ease-standard'
  if (props.tone === 'primary') return [base, active ? 'bg-gold-container text-on-gold-container' : 'text-on-primary']
  return [base, active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant']
}

function labelClass(item) {
  const active = isActive(item)
  const base = 'text-label-m text-center px-1 leading-4 break-words max-w-full'
  if (props.tone === 'primary') return [base, 'text-on-primary']
  return [base, active ? 'text-on-surface' : 'text-on-surface-variant']
}

const BADGE = 'absolute -top-1 left-[30px] min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-label-s inline-flex items-center justify-center'
</script>

<style scoped>
/* Hover / focus / press anywhere on the destination lights the state layer on its indicator pill */
.nav-dest:hover .state-layer::before { opacity: var(--md-sys-state-hover); }
.nav-dest:focus-visible .state-layer::before,
.nav-dest:active .state-layer::before { opacity: var(--md-sys-state-pressed); }
</style>
