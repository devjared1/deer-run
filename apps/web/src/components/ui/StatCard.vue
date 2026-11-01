<template>
  <Card :variant="variant" :to="loading ? null : to" :aria-busy="loading ? 'true' : undefined" class="h-full">
    <div v-if="loading" class="animate-pulse space-y-3" aria-hidden="true">
      <div class="h-4 w-24 rounded-full bg-surface-container-highest" />
      <div class="h-9 w-32 rounded-shape-sm bg-surface-container-highest" />
      <div class="h-4 w-20 rounded-full bg-surface-container-highest" />
    </div>
    <span v-if="loading" class="sr-only">Loading {{ label }}</span>

    <template v-else>
      <div class="flex items-start gap-3">
        <p class="flex-1 min-w-0 text-title-s text-on-surface-variant">{{ label }}</p>
        <span v-if="icon" class="flex items-center justify-center w-10 h-10 -mt-1 -mr-1 rounded-full bg-secondary-container text-on-secondary-container">
          <component :is="icon" class="w-6 h-6" aria-hidden="true" />
        </span>
      </div>

      <p class="mt-1 font-display text-headline-l text-on-surface break-words">
        <slot name="value">{{ value }}</slot>
      </p>

      <div v-if="trend || points?.length > 1" class="mt-2 flex items-end justify-between gap-3">
        <p v-if="trend" :class="['flex items-center gap-1 text-label-l', trendColor]">
          <component :is="TREND_ICONS[trend.direction] || IconFlat" class="w-5 h-5" aria-hidden="true" />
          <span class="sr-only">{{ TREND_WORDS[trend.direction] || 'No change' }}</span>
          <span>{{ trend.value }}</span>
          <span v-if="trend.label" class="text-body-m text-on-surface-variant">{{ trend.label }}</span>
        </p>
        <svg
          v-if="points?.length > 1"
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          class="ml-auto h-8 w-24 flex-shrink-0 text-primary"
          aria-hidden="true"
        >
          <polyline
            :points="polyline"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <span v-if="points?.length > 1" class="sr-only">{{ sparklineSummary }}</span>
      </div>
      <slot />
    </template>
  </Card>
</template>

<script setup>
// Dashboard stat: label, big value, optional icon, trend and sparkline.
//   <StatCard label="Rounds today" value="86" :icon="IconGolf"
//             :trend="{ value: '+12%', direction: 'up', good: true, label: 'vs last week' }" :points="[60, 72, 80, 86]" />
// trend.direction: up | down | flat (shown with an arrow icon and words, never color alone); trend.good colors it
// success (true) or error (false); leave it out for neutral. points: numbers for a tiny sparkline (aria-hidden, with an
// sr-only summary; `pointsLabel` names what they are, e.g. "Last 7 days"). `to` makes the card a link.
// `loading` shows a skeleton. Slots: value (rich value), default (extra content under the trend).
import { computed } from 'vue'
import Card from './Card.vue'
import IconUp from '~icons/material-symbols/trending-up-rounded'
import IconDown from '~icons/material-symbols/trending-down-rounded'
import IconFlat from '~icons/material-symbols/trending-flat-rounded'

const props = defineProps({
  label:       { type: String, required: true },
  value:       { type: [String, Number], default: '' },
  icon:        { type: [Object, Function], default: null },
  trend:       { type: Object, default: null },
  points:      { type: Array, default: null },
  pointsLabel: { type: String, default: 'Trend' },
  to:          { type: [String, Object], default: null },
  loading:     { type: Boolean, default: false },
  variant:     { type: String, default: 'elevated' },
})

const TREND_ICONS = { up: IconUp, down: IconDown, flat: IconFlat }
const TREND_WORDS = { up: 'Up', down: 'Down', flat: 'No change' }

const trendColor = computed(() => {
  if (props.trend?.good === true) return 'text-success'
  if (props.trend?.good === false) return 'text-error'
  return 'text-on-surface-variant'
})

// Points scaled into a 100×32 box with 2px of room top and bottom for the stroke
const polyline = computed(() => {
  const pts = props.points || []
  const min = Math.min(...pts)
  const range = Math.max(...pts) - min || 1
  return pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${30 - ((p - min) / range) * 28}`).join(' ')
})

const sparklineSummary = computed(() => {
  const pts = props.points || []
  return `${props.pointsLabel}: from ${pts[0]} to ${pts[pts.length - 1]}, low ${Math.min(...pts)}, high ${Math.max(...pts)}.`
})
</script>
