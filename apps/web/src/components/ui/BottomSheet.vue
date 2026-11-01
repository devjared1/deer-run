<template>
  <TransitionRoot appear :show="open" as="template" @after-leave="onAfterLeave">
    <Dialog
      as="div"
      class="relative z-dialog print:hidden"
      :initial-focus="initialFocusEl"
      :aria-label="title || $slots.title ? undefined : ariaLabel"
      @close="dismiss"
    >
      <TransitionChild
        as="template"
        enter="transition-opacity duration-medium-2 ease-standard"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="transition-opacity duration-short-4 ease-standard"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-scrim/[.32]" aria-hidden="true" />
      </TransitionChild>

      <div :class="dialogOnDesktop ? 'fixed inset-0 flex items-end justify-center md:items-center md:p-6' : 'fixed inset-0 flex items-end justify-center'">
        <TransitionChild
          as="template"
          enter="transition duration-medium-4 ease-emphasized-decelerate"
          :enter-from="dialogOnDesktop ? 'translate-y-full md:translate-y-4 md:opacity-0 md:scale-95' : 'translate-y-full'"
          enter-to="translate-y-0 opacity-100 scale-100"
          leave="transition duration-short-4 ease-emphasized-accelerate"
          leave-from="translate-y-0 opacity-100 scale-100"
          :leave-to="dialogOnDesktop ? 'translate-y-full md:translate-y-0 md:opacity-0 md:scale-95' : 'translate-y-full'"
        >
          <DialogPanel
            ref="panel"
            :class="[
              'relative flex flex-col w-full max-h-[90dvh] bg-surface-container-low text-on-surface shadow-elevation-1 rounded-t-shape-xl',
              settling ? 'transition-transform duration-short-4 ease-standard' : '',
              dialogOnDesktop ? 'md:max-w-lg md:rounded-shape-xl md:shadow-elevation-3 md:bg-surface-container-high' : 'max-w-[640px]',
            ]"
            :style="dragY ? { transform: `translateY(${dragY}px)` } : undefined"
          >
            <!-- Drag handle: drag down (or tap) to close -->
            <div
              :class="['flex justify-center touch-none', dialogOnDesktop ? 'md:hidden' : '']"
              @pointerdown="dragStart"
              @pointermove="dragMove"
              @pointerup="dragEnd"
              @pointercancel="dragEnd"
            >
              <span v-if="persistent" class="flex items-center justify-center w-12 h-9" aria-hidden="true">
                <span class="block w-8 h-1 rounded-full bg-on-surface-variant/40" />
              </span>
              <button
                v-else
                type="button"
                class="state-layer flex items-center justify-center w-12 h-9 rounded-full text-on-surface-variant"
                aria-label="Close"
                @click="onHandleClick"
              >
                <span class="block w-8 h-1 rounded-full bg-on-surface-variant/40" aria-hidden="true" />
              </button>
            </div>

            <DialogTitle
              v-if="title || $slots.title"
              as="h2"
              :class="['px-6 pb-4 text-title-l text-on-surface', dialogOnDesktop ? 'md:pt-6 md:font-display md:text-headline-s' : '']"
            >
              <slot name="title">{{ title }}</slot>
            </DialogTitle>

            <div :class="['flex-1 overflow-y-auto overscroll-contain px-6 text-body-m text-on-surface-variant', $slots.actions ? '' : 'pb-6']">
              <slot />
            </div>

            <div v-if="$slots.actions" class="flex flex-wrap items-center justify-end gap-2 px-6 pt-4 pb-6">
              <slot name="actions" :close="close" />
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
// MD3 modal bottom sheet for phones (filters, On Course updates). Same API as AppDialog: v-model:open (also emits
// `close`), title / #title, aria-label, persistent, initialFocus, #actions="{ close }", after-leave.
// Scrim, Esc, focus trap and scroll lock come from Headless UI Dialog; drag the handle down (or tap it) to close.
// The body scrolls inside a 90vh max height. dialogOnDesktop (default true): from `md` up it's a centered dialog.
import { computed, ref } from 'vue'
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { useFocusReturn } from './useFocusReturn'

const props = defineProps({
  open:            { type: Boolean, default: false },
  title:           { type: String, default: '' },
  ariaLabel:       { type: String, default: undefined },
  persistent:      { type: Boolean, default: false },
  initialFocus:    { type: [String, Object], default: null },
  dialogOnDesktop: { type: Boolean, default: true },
})
const emit = defineEmits(['update:open', 'close', 'after-leave'])

const panel = ref(null)

function close() {
  emit('update:open', false)
  emit('close')
}
function dismiss() {
  if (!props.persistent) close()
}

const initialFocusEl = computed(() => {
  const root = panel.value?.$el ?? panel.value
  const target = props.initialFocus
  if (target && typeof target !== 'string') return target.$el ?? target
  if (!(root instanceof HTMLElement)) return null
  return root.querySelector(target || '[data-autofocus]')
})

// Drag to dismiss: follow the pointer down; past 96px slide off and close, otherwise snap back
// (`settling` adds a transform transition only for the release, so it doesn't fight the enter/leave transitions)
const dragY = ref(0)
const settling = ref(false)
let startY = null
let moved = false
function dragStart(e) {
  if (props.persistent) return
  startY = e.clientY
  moved = false
  settling.value = false
  e.currentTarget.setPointerCapture(e.pointerId)
}
function dragMove(e) {
  if (startY == null) return
  dragY.value = Math.max(0, e.clientY - startY)
  if (dragY.value > 4) moved = true
}
function dragEnd() {
  if (startY == null) return
  startY = null
  if (!dragY.value) return
  settling.value = true
  if (dragY.value > 96) {
    dragY.value = window.innerHeight
    close()
  } else {
    dragY.value = 0
    setTimeout(() => { settling.value = false }, 250)
  }
}
// A drag that ends over the handle also fires click: only a real tap closes
function onHandleClick() {
  if (!moved) dismiss()
  moved = false
}
// Focus goes back to what had it when the sheet opened (see useFocusReturn.js)
const restoreFocus = useFocusReturn(() => props.open)
function onAfterLeave() {
  dragY.value = 0
  settling.value = false
  restoreFocus()
  emit('after-leave')
}
</script>
