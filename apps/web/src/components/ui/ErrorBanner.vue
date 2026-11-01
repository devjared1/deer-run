<template>
  <div :role="tone === 'warning' ? 'status' : 'alert'" :class="['flex flex-wrap items-start gap-x-3 gap-y-1 rounded-shape-md pl-4 pr-1 py-1', tone === 'warning' ? 'bg-warning-container text-on-warning-container' : 'bg-error-container text-on-error-container']">
    <component :is="icon || (tone === 'warning' ? IconWarning : IconError)" class="w-6 h-6 mt-3 flex-shrink-0" aria-hidden="true" />
    <div class="flex-1 min-w-[12rem] py-3 text-body-m">
      <p v-if="title" class="text-title-s">{{ title }}</p>
      <slot>{{ message }}</slot>
    </div>
    <div v-if="showRetry || showDismiss" class="flex items-center ml-auto self-center">
      <button
        v-if="showRetry"
        type="button"
        class="state-layer touch-target inline-flex items-center gap-2 h-10 px-3 rounded-full text-label-l text-current disabled:cursor-not-allowed"
        :disabled="retrying"
        :aria-busy="retrying ? 'true' : undefined"
        @click="onRetry?.()"
      >
        <ProgressIndicator v-if="retrying" :size="18" />
        <IconRefresh v-else class="w-[18px] h-[18px]" aria-hidden="true" />
        {{ retryLabel }}
      </button>
      <button
        v-if="showDismiss"
        type="button"
        class="state-layer inline-flex items-center justify-center flex-shrink-0 w-12 h-12 rounded-full text-current"
        aria-label="Dismiss"
        @click="onDismiss?.()"
      >
        <IconClose class="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup>
// Inline error message (role="alert"), e.g. above a form's buttons or in place of a table that failed to load.
//   <ErrorBanner :message="error" @retry="load" />
//   <ErrorBanner v-if="saveError" :message="saveError" @dismiss="saveError = ''" />
// Props: message (or the default slot), title, tone (error | warning), icon (default by tone), retryLabel ('Retry'), retrying (spinner).
// A Retry button shows when there's a @retry listener, a dismiss (✕) button when there's a @dismiss listener.
// (They're declared as onRetry/onDismiss props so the component can tell whether a listener was passed.)
import { computed } from 'vue'
import ProgressIndicator from './ProgressIndicator.vue'
import IconError from '~icons/material-symbols/error-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconRefresh from '~icons/material-symbols/refresh-rounded'
import IconClose from '~icons/material-symbols/close-rounded'

const props = defineProps({
  message:    { type: String, default: '' },
  title:      { type: String, default: '' },
  icon:       { type: [Object, Function], default: null },
  // error (default, role=alert) | warning (warning colors, role=status), e.g. a save that went through with a caveat
  tone:       { type: String, default: 'error', validator: v => ['error', 'warning'].includes(v) },
  retryLabel: { type: String, default: 'Retry' },
  retrying:   { type: Boolean, default: false },
  onRetry:    { type: Function, default: null },
  onDismiss:  { type: Function, default: null },
})

const showRetry = computed(() => !!props.onRetry)
const showDismiss = computed(() => !!props.onDismiss)
</script>
