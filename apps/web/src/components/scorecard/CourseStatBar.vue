<template>
  <dl class="grid grid-cols-4 rounded-shape-md bg-surface-container-low shadow-elevation-1 divide-x divide-outline-variant">
    <div v-for="s in stats" :key="s.label" class="flex flex-col-reverse items-center justify-center px-1 py-3 text-center min-w-0">
      <dt class="text-label-m text-on-surface-variant uppercase tracking-wider">{{ s.label }}</dt>
      <dd class="font-display text-headline-s sm:text-headline-m text-on-surface tabular-nums">{{ s.value }}</dd>
    </div>
  </dl>
</template>

<script setup>
// Compact course stats for one tee set: par and yards computed from data/holes.js (not the tee set's published
// total), course rating and slope from data/teeSets.js.
import { computed } from 'vue'
import { totalPar, totalYards } from '@/data/holes'
import { teeSets } from '@/data/teeSets'

const props = defineProps({
  teeIndex: { type: Number, required: true },
})

const stats = computed(() => {
  const tee = teeSets[props.teeIndex]
  return [
    { label: 'Par', value: totalPar() },
    { label: 'Yards', value: totalYards(props.teeIndex).toLocaleString('en-US') },
    { label: 'Rating', value: tee.rating },
    { label: 'Slope', value: tee.slope },
  ]
})
</script>
