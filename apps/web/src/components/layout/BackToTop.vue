<template>
  <Transition
    enter-active-class="transition duration-short-4 ease-emphasized-decelerate"
    enter-from-class="opacity-0 scale-75"
    leave-active-class="transition duration-short-2 ease-standard"
    leave-to-class="opacity-0 scale-75"
  >
    <button
      v-if="visible"
      type="button"
      aria-label="Back to top"
      title="Back to top"
      class="state-layer fixed right-4 bottom-[calc(max(var(--bottom-bar-height,0px),env(safe-area-inset-bottom))+16px)] md:right-6 md:bottom-6 z-app-bar inline-flex items-center justify-center w-12 h-12 rounded-shape-md bg-surface-container-high text-primary shadow-elevation-3 hover:shadow-elevation-4 cursor-pointer print:hidden"
      @click="toTop"
    >
      <IconArrowUpward
        class="w-6 h-6"
        aria-hidden="true"
      />
    </button>
  </Transition>
</template>

<script setup>
// Public site only (App.vue leaves it out of the admin/staff portals). Shows once the page is scrolled a screen
// down; on phones it sits above AppNav's "Book a tee time" bar (--bottom-bar-height). Hidden on /book, where the
// wizard's sticky Continue bar has the bottom-right corner.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import IconArrowUpward from '~icons/material-symbols/arrow-upward-rounded'

const HIDE_ON = ['/book']

const route    = useRoute()
const scrolled = ref(false)
const visible  = computed(() => scrolled.value && !HIDE_ON.includes(route.path))

let frame = 0
function update() {
  frame = 0
  scrolled.value = window.scrollY > window.innerHeight
}
function onScroll() {
  if (!frame) frame = requestAnimationFrame(update)
}

// Smooth unless prefers-reduced-motion. Focus moves to <main> (as after a navigation, App.vue) so keyboard and
// screen reader users continue from the top instead of from a button that just disappeared.
function toTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  document.getElementById('main')?.focus({ preventScroll: true })
}

onMounted(() => {
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>
