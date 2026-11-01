<template>
  <div v-if="isHost" class="print:hidden">
    <!-- Announcements go through persistent live regions; the visible snackbar is ordinary content so its buttons
         stay reachable without being read twice -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">{{ announce.polite }}</div>
    <div class="sr-only" aria-live="assertive" aria-atomic="true">{{ announce.assertive }}</div>

    <div class="fixed inset-x-0 bottom-[var(--snackbar-offset,16px)] z-snackbar flex justify-center px-4 pointer-events-none">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-short-4 ease-emphasized-decelerate"
        enter-from-class="opacity-0 translate-y-4"
        leave-active-class="transition-opacity duration-short-2 ease-standard"
        leave-to-class="opacity-0"
      >
        <div
          v-if="current"
          :key="current.id"
          class="on-dark pointer-events-auto flex items-center w-full max-w-[560px] min-h-12 pl-4 pr-1 gap-1 rounded-shape-xs bg-inverse-surface text-inverse-on-surface shadow-elevation-3 sm:w-auto sm:min-w-[344px]"
          @mouseenter="pause"
          @mouseleave="resume"
          @focusin="pause"
          @focusout="resume"
        >
          <component
            :is="current.icon || (current.tone === 'error' ? IconError : null)"
            v-if="current.icon || current.tone === 'error'"
            :class="['w-5 h-5 mr-2', current.tone === 'error' ? 'text-error-container' : '']"
            aria-hidden="true"
          />
          <p class="flex-1 min-w-0 py-3.5 pr-2 text-body-m">{{ current.message }}</p>
          <button
            v-if="current.actionLabel"
            type="button"
            class="state-layer touch-target h-10 px-3 rounded-full text-label-l text-inverse-primary whitespace-nowrap"
            @click="runAction"
          >
            {{ current.actionLabel }}
          </button>
          <button
            type="button"
            class="state-layer inline-flex items-center justify-center flex-shrink-0 w-12 h-12 rounded-full text-inverse-on-surface"
            aria-label="Dismiss"
            @click="close"
          >
            <IconClose class="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
// The single host for useSnackbar() (composables/useSnackbar.js). Mount it once, in App.vue; no props.
// Sits bottom-center, 16px up; a layout with a bottom nav bar raises it with `--snackbar-offset` (e.g. 96px).
// The timer pauses while the pointer or focus is on the snackbar.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { dismissSnackbar, snackbarHost, snackbarQueue } from '@/composables/useSnackbar.js'
import IconClose from '~icons/material-symbols/close-rounded'
import IconError from '~icons/material-symbols/error-rounded'

const id = Symbol('snackbar-host')
const isHost = computed(() => snackbarHost.value === id)
onMounted(() => { if (!snackbarHost.value) snackbarHost.value = id })
onBeforeUnmount(() => {
  stop()
  if (isHost.value) snackbarHost.value = null
})

const current = computed(() => (isHost.value ? snackbarQueue[0] ?? null : null))
const announce = reactive({ polite: '', assertive: '' })

let timer = null
let remaining = 0
let startedAt = 0
let paused = false

function stop() {
  clearTimeout(timer)
  timer = null
}
function start(ms) {
  stop()
  if (ms <= 0) return
  remaining = ms
  startedAt = Date.now()
  timer = setTimeout(close, ms)
}
function pause() {
  if (!timer || paused) return
  paused = true
  stop()
  remaining -= Date.now() - startedAt
}
function resume() {
  if (!paused) return
  paused = false
  // Give people a moment to read it again after moving away
  if (current.value) start(Math.max(remaining, 1500))
}

watch(() => current.value?.id, async () => {
  paused = false
  stop()
  announce.polite = ''
  announce.assertive = ''
  const item = current.value
  if (!item) return
  start(item.duration)
  await nextTick() // clear first, so the same message twice in a row is announced again
  announce[item.tone === 'error' ? 'assertive' : 'polite'] = item.message
}, { immediate: true })

function close() {
  if (current.value) dismissSnackbar(current.value.id)
}
function runAction() {
  const item = current.value
  close()
  item?.onAction?.()
}
</script>
