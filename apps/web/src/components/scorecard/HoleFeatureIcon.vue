<template>
  <span class="inline-flex items-center">
    <component :is="info.icon" :class="[info.color, 'flex-none']" aria-hidden="true" />
    <span :class="showLabel ? 'ml-1.5' : 'sr-only'">{{ label || info.label }}</span>
  </span>
</template>

<script>
import IconWater from '~icons/material-symbols/water-rounded'
import IconLandscape from '~icons/material-symbols/landscape-rounded'
import IconStar from '~icons/material-symbols/star-rounded'
import IconBunker from '~icons/deer/bunker'

const FEATURES = {
  water:     { icon: IconWater,     color: 'text-secondary', label: 'Water hazard' },
  bunker:    { icon: IconBunker,    color: 'text-gold-text', label: 'Bunkers' },
  mountain:  { icon: IconLandscape, color: 'text-primary',   label: 'Elevated terrain' },
  signature: { icon: IconStar,      color: 'text-gold-text', label: 'Signature hole' },
}

/** Legend order and labels, for the visible legend next to icon-only uses. */
export const FEATURE_LEGEND = Object.entries(FEATURES).map(([kind, f]) => ({ kind, label: f.label }))
</script>

<script setup>
// One hole feature (holeFeatures() in data/holes.js) as an icon with its label: for screen readers only, or visible
// with `show-label`. The icon is 1em: size it with the font size, or e.g. class="[&>svg]:w-5 [&>svg]:h-5".
//   <HoleFeatureIcon kind="water" />   <HoleFeatureIcon kind="bunker" label="3 bunkers" show-label />
import { computed } from 'vue'

const props = defineProps({
  kind:      { type: String, required: true, validator: v => ['water', 'bunker', 'mountain', 'signature'].includes(v) },
  label:     { type: String, default: '' },
  showLabel: { type: Boolean, default: false },
})

const info = computed(() => FEATURES[props.kind])
</script>
