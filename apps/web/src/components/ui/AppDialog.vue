<template>
  <TransitionRoot appear :show="open" as="template" @after-leave="emit('after-leave')">
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

      <div
        :class="fullscreenOnMobile
          ? 'fixed inset-0 flex items-stretch justify-center sm:items-center sm:p-6'
          : 'fixed inset-0 flex items-center justify-center p-4 sm:p-6'"
      >
        <TransitionChild
          as="template"
          enter="transition duration-medium-4 ease-emphasized-decelerate"
          enter-from="opacity-0 scale-[.92] -translate-y-4"
          enter-to="opacity-100 scale-100 translate-y-0"
          leave="transition duration-short-4 ease-emphasized-accelerate"
          leave-from="opacity-100 scale-100"
          leave-to="opacity-0 scale-[.96]"
        >
          <DialogPanel ref="panel" :class="panelClass">
            <!-- Header: on phones a full-screen dialog gets a top app bar (close · title · confirm) -->
            <div
              v-if="title || $slots.title || icon || fullscreenOnMobile"
              :class="fullscreenOnMobile
                ? 'flex items-center gap-1 h-14 px-1 border-b border-outline-variant sm:h-auto sm:border-0 sm:px-6 sm:pt-6 sm:pb-4'
                : icon ? 'flex flex-col items-center text-center px-6 pt-6 pb-4' : 'px-6 pt-6 pb-4'"
            >
              <IconButton v-if="fullscreenOnMobile" :icon="IconClose" label="Close" class="sm:hidden" @click="close" />
              <component :is="icon" v-if="icon" class="w-6 h-6 mb-4 text-secondary" aria-hidden="true" />
              <DialogTitle
                v-if="title || $slots.title"
                as="h2"
                :class="fullscreenOnMobile
                  ? 'flex-1 min-w-0 truncate px-3 text-title-l text-on-surface sm:px-0 sm:whitespace-normal sm:font-display sm:text-headline-s'
                  : 'font-display text-headline-s text-on-surface'"
              >
                <slot name="title">{{ title }}</slot>
              </DialogTitle>
              <AppButton
                v-if="fullscreenOnMobile && confirmLabel"
                variant="text"
                class="mr-1 sm:hidden"
                :loading="confirmLoading"
                :disabled="confirmDisabled"
                @click="emit('confirm')"
              >
                {{ confirmLabel }}
              </AppButton>
            </div>

            <div :class="['flex-1 overflow-y-auto px-6 text-body-m text-on-surface-variant', $slots.actions ? '' : 'pb-6', fullscreenOnMobile ? 'pt-4 sm:pt-0' : '']">
              <slot />
            </div>

            <div
              v-if="$slots.actions"
              :class="[
                'flex flex-wrap items-center justify-end gap-2 px-6 pt-4 pb-6',
                fullscreenOnMobile && confirmLabel ? 'hidden sm:flex' : '',
              ]"
            >
              <slot name="actions" :close="close" />
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
// MD3 dialog (Headless UI Dialog: portal to <body>, focus trap, scroll lock, role="dialog" + aria-modal, labelled
// by the title). Open/close with v-model:open; it also emits `close` whenever it asks to close.
//
//   <AppDialog v-model:open="editing" title="Edit employee" persistent fullscreen-on-mobile confirm-label="Save" @confirm="save">
//     …form…
//     <template #actions="{ close }">
//       <AppButton variant="text" @click="close">Cancel</AppButton>
//       <AppButton @click="save">Save</AppButton>
//     </template>
//   </AppDialog>
//
// Props: title (or #title slot; without one pass aria-label), icon (component, centers the header), size sm | md | lg,
// persistent (Esc and backdrop taps don't close: use it whenever the dialog holds typed input), initialFocus (a CSS
// selector inside the dialog, or an element; else the first [data-autofocus] element, else the first focusable).
// fullscreenOnMobile: full screen below `sm` with a top bar (close icon, title, optional confirmLabel button that emits
// `confirm`); when confirmLabel is set the #actions row is hidden on phones, so keep only Cancel/Save there.
// Emits: update:open, close, confirm, after-leave (the exit animation has finished).
import { computed, ref } from 'vue'
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import AppButton from './AppButton.vue'
import IconButton from './IconButton.vue'
import IconClose from '~icons/material-symbols/close-rounded'

const props = defineProps({
  open:               { type: Boolean, default: false },
  title:              { type: String, default: '' },
  ariaLabel:          { type: String, default: undefined },
  icon:               { type: [Object, Function], default: null },
  size:               { type: String, default: 'md', validator: v => ['sm', 'md', 'lg'].includes(v) },
  persistent:         { type: Boolean, default: false },
  initialFocus:       { type: [String, Object], default: null },
  fullscreenOnMobile: { type: Boolean, default: false },
  confirmLabel:       { type: String, default: '' },
  confirmDisabled:    { type: Boolean, default: false },
  confirmLoading:     { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'close', 'confirm', 'after-leave'])

const panel = ref(null)

function close() {
  emit('update:open', false)
  emit('close')
}
// Esc and backdrop taps
function dismiss() {
  if (!props.persistent) close()
}

// Headless UI focuses this element when it opens (it re-checks when the panel ref resolves)
const initialFocusEl = computed(() => {
  const root = panel.value?.$el ?? panel.value
  const target = props.initialFocus
  if (target && typeof target !== 'string') return target.$el ?? target
  if (!(root instanceof HTMLElement)) return null
  return root.querySelector(target || '[data-autofocus]')
})

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
const SIZES_FROM_SM = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

const panelClass = computed(() => [
  'relative flex flex-col w-full bg-surface-container-high text-on-surface shadow-elevation-3 origin-top',
  props.fullscreenOnMobile
    ? `h-full max-h-full rounded-none sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:rounded-shape-xl ${SIZES_FROM_SM[props.size]}`
    : `max-h-[calc(100dvh-32px)] sm:max-h-[calc(100dvh-48px)] rounded-shape-xl ${SIZES[props.size]}`,
])
</script>
