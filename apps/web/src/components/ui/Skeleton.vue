<template>
  <div :role="label ? 'status' : undefined" :class="variant === 'text' ? 'space-y-2' : ''">
    <span v-if="label" class="sr-only">{{ label }}</span>

    <template v-if="variant === 'text'">
      <div
        v-for="n in lines"
        :key="n"
        class="skeleton h-3.5 rounded-shape-xs"
        :style="{ width: n === lines && lines > 1 ? '60%' : width }"
        aria-hidden="true"
      />
    </template>

    <div v-else-if="variant === 'circle'" class="skeleton rounded-full" :style="{ width: size, height: size }" aria-hidden="true" />

    <div v-else-if="variant === 'card'" class="rounded-shape-md bg-surface-container-low p-4 space-y-4" aria-hidden="true">
      <div class="flex items-center gap-3">
        <div class="skeleton w-10 h-10 rounded-full flex-shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="skeleton h-4 w-1/2 rounded-shape-xs" />
          <div class="skeleton h-3 w-1/3 rounded-shape-xs" />
        </div>
      </div>
      <div class="space-y-2">
        <div class="skeleton h-3.5 rounded-shape-xs" />
        <div class="skeleton h-3.5 rounded-shape-xs" />
        <div class="skeleton h-3.5 w-3/5 rounded-shape-xs" />
      </div>
    </div>

    <div v-else class="skeleton rounded-shape-md" :style="{ width, height }" aria-hidden="true" />
  </div>
</template>

<script setup>
// Loading placeholder with a shimmer (static under reduced motion).
//   <Skeleton variant="text" :lines="3" label="Loading bookings" />
//   <Skeleton variant="rect" height="160px" />   <Skeleton variant="circle" size="40px" />   <Skeleton variant="card" />
// Props: variant text | rect | circle | card, lines (text; the last is shorter), width / height (rect, CSS sizes;
// width also sets text line width), size (circle), label (wraps it in role="status" with sr-only text; set it on
// one skeleton per loading region, the shapes themselves are aria-hidden).
defineProps({
  variant: { type: String, default: 'text', validator: v => ['text', 'rect', 'circle', 'card'].includes(v) },
  lines:   { type: Number, default: 3 },
  width:   { type: String, default: '100%' },
  height:  { type: String, default: '96px' },
  size:    { type: String, default: '40px' },
  label:   { type: String, default: '' },
})
</script>

<style scoped>
.skeleton {
  position: relative;
  overflow: hidden;
  background: rgb(var(--md-sys-color-surface-container-highest));
}
.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(var(--md-sys-color-surface-container-lowest) / .6), transparent);
  animation: skeleton-shimmer 1.6s var(--md-sys-motion-easing-standard) infinite;
}
@keyframes skeleton-shimmer {
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton::after { display: none; }
}
</style>
