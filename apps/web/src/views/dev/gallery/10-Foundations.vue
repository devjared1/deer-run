<template>
  <div class="space-y-8">
    <div>
      <h3 class="text-title-m mb-3">Color roles</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div v-for="c in colors" :key="c.name" :class="['rounded-shape-md p-3 h-24 flex flex-col justify-end border border-outline-variant', c.cls]">
          <span class="text-label-m">{{ c.name }}</span>
        </div>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">Type scale</h3>
      <div class="space-y-2">
        <div v-for="t in typeScale" :key="t" class="flex items-baseline gap-4">
          <span class="w-28 flex-shrink-0 text-label-m text-on-surface-variant">{{ t }}</span>
          <span :class="[TYPE_CLASSES[t], t.startsWith('display') || t.startsWith('headline') ? 'font-display' : '']">Deer Run Golf</span>
        </div>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">Shape and elevation</h3>
      <div class="flex flex-wrap gap-4">
        <div v-for="s in shapes" :key="s" :class="['w-28 h-20 bg-surface-container-lowest flex items-center justify-center text-label-m', s]">{{ s.replace('rounded-', '').replace('shadow-', '') }}</div>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">Logo</h3>
      <div class="flex flex-wrap items-end gap-6 p-4 rounded-shape-md bg-surface-container">
        <BrandLogo :size="48" />
        <BrandLogo :size="96" />
        <BrandLogo variant="mark" :size="40" />
        <BrandLogo variant="mark" :size="64" />
      </div>
      <div class="flex flex-wrap items-end gap-6 p-4 mt-3 rounded-shape-md bg-pine">
        <BrandLogo :size="48" />
        <BrandLogo variant="mark" :size="48" />
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">Icons</h3>
      <div class="flex flex-wrap gap-4 text-primary">
        <component :is="i" v-for="(i, k) in icons" :key="k" class="w-6 h-6" />
      </div>
    </div>
  </div>
</template>

<script>
export default { galleryTitle: 'Foundations', galleryNote: 'Tokens from src/assets/tokens.css. Toggle high contrast in the header.' }
</script>

<script setup>
import BrandLogo from '@/components/ui/BrandLogo.vue'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconSportsGolf from '~icons/material-symbols/sports-golf-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconCart from '~icons/deer/golf-cart'
import IconBunker from '~icons/deer/bunker'
import IconWater from '~icons/material-symbols/water-rounded'
import IconCheck from '~icons/material-symbols/check-circle-rounded'

const icons = [IconGolf, IconSportsGolf, IconSchedule, IconPayments, IconCart, IconBunker, IconWater, IconCheck]

const colors = [
  { name: 'primary', cls: 'bg-primary text-on-primary' },
  { name: 'primary-container', cls: 'bg-primary-container text-on-primary-container' },
  { name: 'secondary', cls: 'bg-secondary text-on-secondary' },
  { name: 'secondary-container', cls: 'bg-secondary-container text-on-secondary-container' },
  { name: 'tertiary', cls: 'bg-tertiary text-on-tertiary' },
  { name: 'tertiary-container', cls: 'bg-tertiary-container text-on-tertiary-container' },
  { name: 'gold', cls: 'bg-gold text-on-gold' },
  { name: 'gold-container', cls: 'bg-gold-container text-on-gold-container' },
  { name: 'error', cls: 'bg-error text-on-error' },
  { name: 'error-container', cls: 'bg-error-container text-on-error-container' },
  { name: 'success-container', cls: 'bg-success-container text-on-success-container' },
  { name: 'warning-container', cls: 'bg-warning-container text-on-warning-container' },
  { name: 'surface', cls: 'bg-surface text-on-surface' },
  { name: 'container-low', cls: 'bg-surface-container-low text-on-surface' },
  { name: 'container', cls: 'bg-surface-container text-on-surface' },
  { name: 'container-high', cls: 'bg-surface-container-high text-on-surface' },
  { name: 'container-highest', cls: 'bg-surface-container-highest text-on-surface-variant' },
  { name: 'inverse-surface', cls: 'bg-inverse-surface text-inverse-on-surface' },
]
const typeScale = ['display-l', 'display-m', 'display-s', 'headline-l', 'headline-m', 'headline-s', 'title-l', 'title-m', 'title-s', 'body-l', 'body-m', 'body-s', 'label-l', 'label-m', 'label-s']
// Literal class names so Tailwind generates them
const TYPE_CLASSES = {
  'display-l': 'text-display-l', 'display-m': 'text-display-m', 'display-s': 'text-display-s',
  'headline-l': 'text-headline-l', 'headline-m': 'text-headline-m', 'headline-s': 'text-headline-s',
  'title-l': 'text-title-l', 'title-m': 'text-title-m', 'title-s': 'text-title-s',
  'body-l': 'text-body-l', 'body-m': 'text-body-m', 'body-s': 'text-body-s',
  'label-l': 'text-label-l', 'label-m': 'text-label-m', 'label-s': 'text-label-s',
}
const shapes = ['rounded-shape-xs', 'rounded-shape-sm', 'rounded-shape-md', 'rounded-shape-lg', 'rounded-shape-xl', 'rounded-full', 'shadow-elevation-1', 'shadow-elevation-2', 'shadow-elevation-3', 'shadow-elevation-5']
</script>
