<template>
  <span
    v-if="variant === 'circular'"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="value ?? undefined"
    aria-valuemin="0"
    aria-valuemax="100"
    class="inline-block flex-shrink-0"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg viewBox="0 0 48 48" :class="['w-full h-full', value == null ? 'animate-spin [animation-duration:1.2s]' : '-rotate-90']" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="5" />
      <circle
        cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"
        :stroke-dasharray="CIRC"
        :stroke-dashoffset="value == null ? CIRC * 0.7 : CIRC * (1 - Math.min(100, Math.max(0, value)) / 100)"
      />
    </svg>
  </span>
  <div
    v-else
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="value ?? undefined"
    aria-valuemin="0"
    aria-valuemax="100"
    class="relative h-1 w-full overflow-hidden rounded-full bg-primary/20"
  >
    <div
      v-if="value != null"
      class="h-full rounded-full bg-primary transition-[width] duration-medium-2 ease-standard"
      :style="{ width: `${value}%` }"
    />
    <div v-else class="progress-indeterminate absolute inset-y-0 w-2/5 rounded-full bg-primary" />
  </div>
</template>

<script setup>
// MD3 progress indicator: circular (default; inherits the text color) or linear (primary). Leave `value` null for
// indeterminate. The spinner inside buttons uses this.
defineProps({
  variant: { type: String, default: 'circular', validator: v => ['circular', 'linear'].includes(v) },
  value:   { type: Number, default: null },
  size:    { type: Number, default: 24 },
  label:   { type: String, default: 'Loading' },
})
const CIRC = 2 * Math.PI * 20
</script>

<style scoped>
.progress-indeterminate { animation: progress-slide 1.4s var(--md-sys-motion-easing-standard) infinite; }
@keyframes progress-slide {
  from { left: -40%; }
  to   { left: 100%; }
}
</style>
