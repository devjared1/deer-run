<template>
  <!-- Calendar-page date: month, day, year. The text is for sighted users; `label` is what screen readers hear. -->
  <div
    :class="[
      'flex-shrink-0 inline-flex flex-col items-center justify-center text-center rounded-shape-sm',
      size === 'lg' ? 'w-20 py-3' : 'w-16 py-2',
      muted ? 'bg-surface-container-highest text-on-surface' : 'bg-primary text-on-primary shadow-elevation-1',
    ]"
    role="img"
    :aria-label="label"
  >
    <span :class="['text-label-m uppercase tracking-widest', muted ? 'text-on-surface-variant' : 'text-gold-container']">{{ month }}</span>
    <span :class="['font-display font-bold leading-none', size === 'lg' ? 'text-display-s' : 'text-headline-m']">{{ day }}</span>
    <span :class="['text-label-s', muted ? 'text-on-surface-variant' : 'text-on-primary']">{{ year }}</span>
  </div>
</template>

<script setup>
// The pine date block on event cards and the event page. `muted` for past events (neutral surface, still AA).
//   <EventDateBlock month="Mar" day="20" year="2027" label="Saturday, March 20, 2027" />
defineProps({
  month: { type: String, required: true },
  day:   { type: String, required: true },
  year:  { type: String, default: '' },
  label: { type: String, default: '' },
  size:  { type: String, default: 'md', validator: v => ['md', 'lg'].includes(v) },
  muted: { type: Boolean, default: false },
})
</script>
