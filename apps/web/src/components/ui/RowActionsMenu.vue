<template>
  <Menu as="div" class="inline-flex">
    <div ref="anchor" class="inline-flex">
      <MenuButton :as="IconButton" :icon="IconMoreVert" :label="label" :size="size" />
    </div>
    <Transition
      enter-active-class="transition duration-short-4 ease-emphasized-decelerate"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition-opacity duration-short-2 ease-standard"
      leave-to-class="opacity-0"
      @enter="onEnter"
      @after-leave="onAfterLeave"
    >
      <MenuItems
        class="fixed top-0 left-0 z-dialog min-w-[160px] max-w-[280px] max-h-[calc(100dvh-16px)] overflow-y-auto py-2 rounded-shape-xs bg-surface-container shadow-elevation-2 focus:outline-none"
      >
        <MenuItem v-for="(item, i) in items" :key="i" v-slot="{ active, disabled }" :disabled="!!item.disabled">
          <button
            type="button"
            :class="[
              'state-layer flex items-center gap-3 w-full min-h-12 px-3 text-left text-body-l whitespace-nowrap',
              disabled ? 'text-on-surface/[.38] cursor-not-allowed' : item.danger ? 'text-error' : 'text-on-surface',
              active && !disabled ? 'before:opacity-[.08]' : '',
            ]"
            @click="item.onClick?.()"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              :class="['w-6 h-6', disabled ? '' : item.danger ? 'text-error' : 'text-on-surface-variant']"
              aria-hidden="true"
            />
            <span class="truncate">{{ item.label }}</span>
          </button>
        </MenuItem>
      </MenuItems>
    </Transition>
  </Menu>
</template>

<script setup>
// Row overflow menu: a more_vert icon button opening a Headless UI Menu (arrow keys, Home/End, type-ahead, Esc,
// focus returns to the button).
//
//   <RowActionsMenu :label="`Actions for ${e.name}`" :items="[
//     { label: 'Edit', icon: IconEdit, onClick: () => edit(e) },
//     { label: 'Deactivate', icon: IconBlock, danger: true, disabled: !e.active, onClick: () => deactivate(e) },
//   ]" />
//
// Props: items [{ label, icon?, onClick, danger?, disabled? }], label (the button's aria-label, required),
// align 'end' (default: menu's right edge on the button's) | 'start', size (IconButton size, default md; sm in dense
// tables). The menu is position: fixed and kept inside the viewport (flips above the button when there's no room
// below), so a scrolling table doesn't clip it.
import { onBeforeUnmount, ref } from 'vue'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import IconButton from './IconButton.vue'
import IconMoreVert from '~icons/material-symbols/more-vert'

const props = defineProps({
  items: { type: Array, required: true },
  label: { type: String, required: true },
  align: { type: String, default: 'end', validator: v => ['start', 'end'].includes(v) },
  size:  { type: String, default: 'md', validator: v => ['sm', 'md'].includes(v) },
})

const anchor = ref(null)
let menuEl = null
const GAP = 4
const MARGIN = 8

function place() {
  if (!menuEl || !anchor.value) return
  const r = anchor.value.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const w = menuEl.offsetWidth
  const h = menuEl.offsetHeight

  let left = props.align === 'start' ? r.left : r.right - w
  left = Math.min(Math.max(left, MARGIN), vw - w - MARGIN)

  const below = vh - r.bottom - GAP - MARGIN
  const above = r.top - GAP - MARGIN
  const up = h > below && above > below
  let top = up ? r.top - GAP - h : r.bottom + GAP
  top = Math.min(Math.max(top, MARGIN), vh - h - MARGIN)

  menuEl.style.left = `${left}px`
  menuEl.style.top = `${top}px`
  menuEl.style.transformOrigin = `${props.align === 'start' ? 'left' : 'right'} ${up ? 'bottom' : 'top'}`
}

// Positioned once it's in the DOM (before paint) and kept in place while the page scrolls or resizes
function onEnter(el) {
  menuEl = el
  place()
  window.addEventListener('scroll', place, { capture: true, passive: true })
  window.addEventListener('resize', place)
}
function onAfterLeave() {
  menuEl = null
  window.removeEventListener('scroll', place, { capture: true })
  window.removeEventListener('resize', place)
}
onBeforeUnmount(onAfterLeave)
</script>
