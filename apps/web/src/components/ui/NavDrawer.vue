<template>
  <Teleport to="body" :disabled="!teleported">
    <!-- Scrim (modal only) -->
    <Transition
      enter-active-class="transition-opacity duration-medium-2 ease-standard"
      leave-active-class="transition-opacity duration-short-4 ease-standard"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isModal && open"
        :class="[contained ? 'absolute' : 'fixed', 'inset-0 z-drawer bg-scrim/[.32] print:hidden']"
        aria-hidden="true"
        @click="close"
      />
    </Transition>

    <Transition
      :enter-active-class="isModal ? 'transition-transform duration-medium-2 ease-emphasized-decelerate' : ''"
      :leave-active-class="isModal ? 'transition-transform duration-short-4 ease-emphasized-accelerate' : ''"
      :enter-from-class="isModal ? '-translate-x-full' : ''"
      :leave-to-class="isModal ? '-translate-x-full' : ''"
    >
      <div
        v-show="!isModal || open"
        ref="panel"
        v-bind="$attrs"
        :role="isModal ? 'dialog' : undefined"
        :aria-modal="isModal ? 'true' : undefined"
        :aria-label="isModal ? label : undefined"
        :tabindex="isModal ? -1 : undefined"
        :class="[
          'flex flex-col overflow-hidden print:hidden',
          tone === 'primary' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface',
          isModal
            ? 'inset-y-0 left-0 z-drawer w-80 max-w-[calc(100%-56px)] rounded-r-shape-lg shadow-elevation-1 outline-none'
            : 'w-72 flex-shrink-0',
          isModal && contained ? 'absolute' : '',
          isModal && !contained ? 'fixed' : '',
          !isModal && contained ? 'h-full' : '',
          !isModal && !contained ? 'sticky top-0 h-screen' : '',
          variant === 'responsive' && !isModal ? 'hidden lg:flex' : '',
        ]"
        @keydown="onKeydown"
      >
        <div v-if="$slots.header || isModal" class="flex items-center gap-2 min-h-16 pl-4 pr-2 pt-3 pb-2 flex-shrink-0">
          <div class="flex-1 min-w-0">
            <slot name="header" :tone="tone" :modal="isModal" :close="close" />
          </div>
          <button
            v-if="isModal"
            type="button"
            :aria-label="closeLabel"
            :class="[
              'state-layer w-12 h-12 flex-shrink-0 inline-flex items-center justify-center rounded-full cursor-pointer',
              tone === 'primary' ? 'text-on-primary' : 'text-on-surface-variant',
            ]"
            @click="close"
          >
            <IconClose class="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        <nav :aria-label="label" class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3">
          <div v-for="(section, si) in allSections" :key="section.title ?? `section-${si}`">
            <div
              v-if="si > 0"
              :class="['mx-4 my-2 border-t', tone === 'primary' ? 'border-on-primary/[.16]' : 'border-outline-variant']"
              aria-hidden="true"
            />
            <h2
              v-if="section.title"
              :id="`${uid}-s${si}`"
              :class="['px-4 pt-3 pb-2 text-title-s', tone === 'primary' ? 'text-inverse-primary' : 'text-on-surface-variant']"
            >
              {{ section.title }}
            </h2>
            <ul :aria-labelledby="section.title ? `${uid}-s${si}` : undefined" class="space-y-0.5">
              <li v-for="(item, ii) in section.items" :key="itemKey(item, ii)">
                <RouterLink v-if="!isActionItem(item)" v-slot="{ href, navigate }" :to="item.to" custom>
                  <a
                    :href="href"
                    :aria-current="isActive(item) ? 'page' : undefined"
                    :class="itemClass(item)"
                    @click="onItemClick($event, item, navigate)"
                  >
                    <component :is="item.icon" v-if="item.icon" class="w-6 h-6" aria-hidden="true" />
                    <span class="flex-1 min-w-0 truncate">{{ item.label }}</span>
                    <template v-if="hasBadge(item)">
                      <span v-if="isDotBadge(item)" class="w-2 h-2 rounded-full bg-error flex-shrink-0" aria-hidden="true" />
                      <span v-else :class="badgeClass" aria-hidden="true">{{ badgeText(item) }}</span>
                      <span class="sr-only">, {{ badgeA11yLabel(item) }}</span>
                    </template>
                  </a>
                </RouterLink>
                <button
                  v-else
                  type="button"
                  :aria-expanded="typeof item.expanded === 'boolean' ? String(item.expanded) : undefined"
                  :class="[itemClass(item), 'w-full text-left']"
                  @click="onItemClick($event, item)"
                >
                  <component :is="item.icon" v-if="item.icon" class="w-6 h-6" aria-hidden="true" />
                  <span class="flex-1 min-w-0 truncate">{{ item.label }}</span>
                  <template v-if="hasBadge(item)">
                    <span v-if="isDotBadge(item)" class="w-2 h-2 rounded-full bg-error flex-shrink-0" aria-hidden="true" />
                    <span v-else :class="badgeClass" aria-hidden="true">{{ badgeText(item) }}</span>
                    <span class="sr-only">, {{ badgeA11yLabel(item) }}</span>
                  </template>
                </button>
              </li>
            </ul>
          </div>
        </nav>

        <div
          v-if="$slots.footer || footerItems.length"
          :class="['flex-shrink-0 px-3 pt-2 pb-3 border-t', tone === 'primary' ? 'border-on-primary/[.16]' : 'border-outline-variant']"
        >
          <slot name="footer" :tone="tone" :modal="isModal" :close="close" />
          <ul v-if="footerItems.length" class="space-y-0.5">
            <li v-for="(item, ii) in footerItems" :key="itemKey(item, ii)">
              <RouterLink v-if="!isActionItem(item)" v-slot="{ href, navigate }" :to="item.to" custom>
                <a
                  :href="href"
                  :aria-current="isActive(item) ? 'page' : undefined"
                  :class="itemClass(item)"
                  @click="onItemClick($event, item, navigate)"
                >
                  <component :is="item.icon" v-if="item.icon" class="w-6 h-6" aria-hidden="true" />
                  <span class="flex-1 min-w-0 truncate">{{ item.label }}</span>
                </a>
              </RouterLink>
              <button v-else type="button" :class="[itemClass(item), 'w-full text-left']" @click="onItemClick($event, item)">
                <component :is="item.icon" v-if="item.icon" class="w-6 h-6" aria-hidden="true" />
                <span class="flex-1 min-w-0 truncate">{{ item.label }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
// MD3 navigation drawer.
//
// variant:
//   'responsive' (default) — standard drawer at lg+ (1024px), modal drawer below; v-model:open drives the modal.
//   'modal'    — always a modal drawer: Teleported to <body>, scrim, slides in, focus trap, Esc / scrim / close
//                button / item click / route change close it, page scroll locked while open.
//   'standard' — always a permanent drawer (sticky, full height) for a flex row next to the content.
// Props:
//   open (v-model:open), items OR sections [{ title, items }] (item shape: see ./navItems.js),
//   footerItems  — items under the footer slot (Back to site, Sign out as `{ label, icon, action: 'sign-out' }`),
//   label        — aria-label of the <nav> landmark and the modal dialog (default "Main"),
//   tone         — 'surface' (default) | 'primary' (pine background, gold-container active indicator),
//   closeLabel   — aria-label of the modal close button,
//   contained    — render inside the nearest positioned ancestor instead of the viewport (the /dev/ui gallery):
//                  no Teleport, no scroll lock, `absolute` instead of `fixed`, full height of the parent.
// Emits: update:open, select (item, event — every item click; button items only do this; call
//   event.preventDefault() to cancel a link's navigation).
// Slots: #header { tone, modal, close } (logo), #footer { tone, modal, close } (account, sign out).
// Other attributes (id, class) go on the drawer panel, so a menu button can point aria-controls at its id.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import IconClose from '~icons/material-symbols/close-rounded'
import {
  badgeA11yLabel, badgeText, hasBadge, isActionItem, isActiveRoute, isDotBadge, itemKey, toSections,
} from './navItems.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  open:        { type: Boolean, default: false },
  variant:     { type: String, default: 'responsive', validator: v => ['responsive', 'modal', 'standard'].includes(v) },
  items:       { type: Array, default: () => [] },
  sections:    { type: Array, default: null },
  footerItems: { type: Array, default: () => [] },
  label:       { type: String, default: 'Main' },
  tone:        { type: String, default: 'surface', validator: v => ['surface', 'primary'].includes(v) },
  closeLabel:  { type: String, default: 'Close navigation menu' },
  contained:   { type: Boolean, default: false },
})

const emit = defineEmits(['update:open', 'select'])

const route = useRoute()
const uid = `nav-drawer-${useId()}`
const panel = ref(null)

const allSections = computed(() => toSections(props.items, props.sections))

// lg breakpoint for the responsive variant
const LG = '(min-width: 1024px)'
const isWide = ref(typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(LG).matches : true)
let mql = null
function onMedia(e) { isWide.value = e.matches }

const isModal = computed(() => props.variant === 'modal' || (props.variant === 'responsive' && !isWide.value))
const teleported = computed(() => isModal.value && !props.contained)

function isActive(item) {
  return isActiveRoute(route, item)
}

function close() {
  if (props.open) emit('update:open', false)
}

function onItemClick(event, item, navigate) {
  // A `select` listener can call event.preventDefault() to stop the navigation (RouterLink's navigate honors it)
  emit('select', item, event)
  if (navigate) navigate(event)
  if (isModal.value) close()
}

const ITEM_BASE = 'state-layer flex items-center gap-3 h-14 pl-4 pr-6 rounded-full text-label-l no-underline cursor-pointer select-none'
function itemClass(item) {
  const active = isActive(item)
  if (props.tone === 'primary') {
    return [ITEM_BASE, active ? 'bg-gold-container text-on-gold-container' : 'text-on-primary']
  }
  return [ITEM_BASE, active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant']
}
const badgeClass = 'min-w-[24px] h-6 px-2 rounded-full bg-error text-on-error text-label-m inline-flex items-center justify-center flex-shrink-0'

// ── Focus trap, Esc, scroll lock, restore focus ──
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
let returnFocus = null

function focusables() {
  return panel.value ? [...panel.value.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null) : []
}

function onKeydown(e) {
  if (!isModal.value || !props.open) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
    return
  }
  if (e.key !== 'Tab') return
  const els = focusables()
  if (!els.length) { e.preventDefault(); return }
  const first = els[0]
  const last = els[els.length - 1]
  if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

// Esc also works if focus somehow left the panel
function onDocKeydown(e) {
  if (e.key === 'Escape' && isModal.value && props.open && !panel.value?.contains(e.target)) close()
}

let lockedOverflow = null
function lockScroll(lock) {
  const el = document.documentElement
  if (lock && lockedOverflow === null) {
    lockedOverflow = el.style.overflow
    el.style.overflow = 'hidden'
  } else if (!lock && lockedOverflow !== null) {
    el.style.overflow = lockedOverflow
    lockedOverflow = null
  }
}

watch(
  () => isModal.value && props.open,
  async (shown) => {
    if (typeof document === 'undefined') return
    if (!props.contained) lockScroll(shown)
    if (shown) {
      returnFocus = document.activeElement
      document.addEventListener('keydown', onDocKeydown)
      await nextTick()
      const target = panel.value?.querySelector('[aria-current="page"]') || focusables()[0] || panel.value
      target?.focus({ preventScroll: true })
    } else {
      document.removeEventListener('keydown', onDocKeydown)
      // Back to the menu button, unless focus already moved somewhere else on purpose
      const active = document.activeElement
      const focusWasInDrawer = !active || active === document.body || panel.value?.contains(active)
      if (returnFocus && document.contains(returnFocus) && focusWasInDrawer) returnFocus.focus({ preventScroll: true })
      returnFocus = null
    }
  },
)

// Close on navigation, and when the responsive drawer becomes permanent
watch(() => route?.fullPath, close)
watch(isModal, modal => { if (!modal) close() })

onMounted(() => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    mql = window.matchMedia(LG)
    isWide.value = mql.matches
    mql.addEventListener('change', onMedia)
  }
  if (isModal.value && props.open && !props.contained) lockScroll(true)
})

onBeforeUnmount(() => {
  mql?.removeEventListener('change', onMedia)
  document.removeEventListener('keydown', onDocKeydown)
  lockScroll(false)
})
</script>
