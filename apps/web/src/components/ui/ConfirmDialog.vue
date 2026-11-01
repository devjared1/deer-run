<template>
  <AppDialog
    v-if="isHost && current"
    :open="open"
    :title="current.title"
    :aria-label="current.title ? undefined : current.message"
    :icon="current.icon"
    size="sm"
    @close="answer(false)"
    @after-leave="next"
  >
    <p class="whitespace-pre-line">{{ current.message }}</p>
    <template #actions>
      <AppButton variant="text" :data-autofocus="current.destructive ? '' : undefined" @click="answer(false)">
        {{ current.cancelLabel }}
      </AppButton>
      <AppButton
        :variant="current.destructive ? 'danger' : 'filled'"
        :data-autofocus="current.destructive ? undefined : ''"
        @click="answer(true)"
      >
        {{ current.confirmLabel }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// The single host for useConfirm() (composables/useConfirm.js). Mount it once, in App.vue; no props.
// If several are mounted, only the first one renders.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppDialog from './AppDialog.vue'
import AppButton from './AppButton.vue'
import { confirmHost, confirmQueue } from '@/composables/useConfirm.js'

const id = Symbol('confirm-host')
const isHost = computed(() => confirmHost.value === id)
onMounted(() => { if (!confirmHost.value) confirmHost.value = id })
onBeforeUnmount(() => { if (isHost.value) confirmHost.value = null })

const current = computed(() => confirmQueue[0] ?? null)
const open = ref(false)

watch(current, request => { if (request) open.value = true }, { immediate: true })

function answer(value) {
  if (!open.value) return
  current.value.resolve(value)
  open.value = false
}
// After the exit animation: drop the answered request; the watcher opens the next one
function next() {
  confirmQueue.shift()
}
</script>
