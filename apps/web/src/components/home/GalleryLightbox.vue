<template>
  <TransitionRoot appear :show="index !== null" as="template">
    <Dialog as="div" class="relative z-dialog print:hidden" :initial-focus="closeButton" @close="close">
      <TransitionChild
        as="template"
        enter="transition-opacity duration-medium-2 ease-standard"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="transition-opacity duration-short-4 ease-standard"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-pine-deep" aria-hidden="true" />
      </TransitionChild>

      <TransitionChild
        as="template"
        enter="transition duration-medium-4 ease-emphasized-decelerate"
        enter-from="opacity-0 scale-[.96]"
        enter-to="opacity-100 scale-100"
        leave="transition duration-short-4 ease-emphasized-accelerate"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <DialogPanel
          class="on-dark fixed inset-0 flex flex-col text-on-primary"
          @keydown.left.prevent="step(-1)"
          @keydown.right.prevent="step(1)"
          @pointerdown="onPointerDown"
          @pointerup="onPointerUp"
        >
          <div class="flex items-center gap-2 h-16 px-2 sm:px-4 flex-shrink-0">
            <DialogTitle class="flex-1 min-w-0 px-2 text-title-m truncate">
              Course gallery
              <span class="text-body-m font-normal ml-2">{{ (index ?? 0) + 1 }} of {{ photos.length }}</span>
            </DialogTitle>
            <button
              ref="closeButton"
              type="button"
              aria-label="Close gallery"
              class="state-layer inline-flex items-center justify-center w-12 h-12 rounded-full text-on-primary"
              @click="close"
            >
              <IconClose class="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          <figure v-if="current" class="flex-1 min-h-0 flex flex-col items-center justify-center px-4 sm:px-20 pb-4">
            <div class="relative flex-1 min-h-0 w-full flex items-center justify-center">
              <ResponsivePicture
                :key="current.name"
                :name="current.name"
                sizes="100vw"
                priority
                img-class="max-w-full max-h-[calc(100dvh-220px)] sm:max-h-[calc(100dvh-160px)] w-auto h-auto object-contain rounded-shape-sm select-none"
              />
            </div>
            <figcaption class="mt-3 text-body-m text-center max-w-2xl" aria-live="polite">{{ current.alt }}</figcaption>
          </figure>

          <!-- Previous / next: on the sides from sm, under the photo on phones -->
          <div class="flex justify-center gap-4 pb-6 sm:pb-0 sm:contents">
            <IconButton
              :icon="IconChevronLeft"
              label="Previous photo"
              variant="inherit"
              size="lg"
              class="bg-on-primary/10 sm:absolute sm:left-4 sm:top-1/2 sm:-translate-y-1/2"
              @click="step(-1)"
            />
            <IconButton
              :icon="IconChevronRight"
              label="Next photo"
              variant="inherit"
              size="lg"
              class="bg-on-primary/10 sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2"
              @click="step(1)"
            />
          </div>
        </DialogPanel>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
// Full-screen photo viewer for the Home gallery (Headless UI Dialog: focus trap, scroll lock, Esc closes, focus
// returns to the photo that opened it). Arrow keys, the previous/next buttons and a horizontal swipe move through
// the photos; v-model:index is the open photo (null = closed). photos: [{ name, alt }] (names from src/data/photos.js).
import IconButton from '@/components/ui/IconButton.vue'
import ResponsivePicture from '@/components/ui/ResponsivePicture.vue'
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { computed, ref } from 'vue'
import IconChevronLeft from '~icons/material-symbols/chevron-left-rounded'
import IconChevronRight from '~icons/material-symbols/chevron-right-rounded'
import IconClose from '~icons/material-symbols/close-rounded'

const props = defineProps({
  photos: { type: Array, required: true },
  index:  { type: Number, default: null },
})
const emit = defineEmits(['update:index'])

const closeButton = ref(null)
const current = computed(() => (props.index === null ? null : props.photos[props.index]))

function close() {
  emit('update:index', null)
}
function step(n) {
  if (props.index === null) return
  emit('update:index', (props.index + n + props.photos.length) % props.photos.length)
}

// Swipe: a mostly horizontal drag of 50px or more
let start = null
function onPointerDown(e) {
  start = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY }
}
function onPointerUp(e) {
  if (!start) return
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  start = null
  if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
}
</script>
