<template>
  <picture class="inline-block flex-shrink-0 align-middle">
    <source type="image/webp" :srcset="srcset('webp')">
    <img
      :src="file(base.x1, 'png')"
      :srcset="srcset('png')"
      :alt="alt"
      :width="width"
      :height="size"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      class="block h-auto max-w-full"
      :style="{ height: `${size}px`, width: 'auto' }"
    >
  </picture>
</template>

<script setup>
// The Deer Run logo. variant="emblem" is the full logo (stag, sun, "DEER RUN GOLF COURSE"; 1.47:1, use at 40px tall
// or more so the ribbon text stays readable); variant="mark" is the round stag-and-sun badge for small places
// (collapsed rails, avatars). Optimized files are in public/images/logo (WebP + PNG, 1x/2x/3x).
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'emblem', validator: v => ['emblem', 'mark'].includes(v) },
  /** Rendered height in CSS px */
  size:    { type: Number, default: 48 },
  alt:     { type: String, default: 'Deer Run Golf Course' },
  /** Above the fold (nav, hero): load immediately rather than lazily. Not fetchpriority high: the hero photo is the
   *  LCP image and gets the bandwidth first. Leave a desktop-only copy (hidden md:inline-block) lazy: an eager
   *  image downloads even while it's hidden, a lazy one only once it's shown. */
  eager:   { type: Boolean, default: false },
})

const EMBLEM_HEIGHTS = [48, 96, 144, 240, 480]
const MARK_SIZES = [48, 96, 192]
const EMBLEM_RATIO = 786 / 533

const width = computed(() => Math.round(props.variant === 'emblem' ? props.size * EMBLEM_RATIO : props.size))

// The smallest exported file at least size × density tall, for 1x/2x/3x
const base = computed(() => {
  const sizes = props.variant === 'emblem' ? EMBLEM_HEIGHTS : MARK_SIZES
  const pick = d => sizes.find(s => s >= props.size * d) ?? sizes[sizes.length - 1]
  return { x1: pick(1), x2: pick(2), x3: pick(3) }
})

function file(px, ext) {
  return `/images/logo/${props.variant}-${px}.${ext}`
}
function srcset(ext) {
  const { x1, x2, x3 } = base.value
  return [...new Set([`${file(x1, ext)} 1x`, `${file(x2, ext)} 2x`, `${file(x3, ext)} 3x`])].join(', ')
}
</script>
