<template>
  <section
    :class="['hero-bg on-dark relative isolate overflow-hidden flex items-center', classes]"
    :style="{ minHeight: `min(${height}, 85vh)` }"
  >
    <!-- The photo is a real <picture> (prioritized for LCP), under a pine gradient that keeps the text AA.
         sizes asks phones for about half their screen density (the 640px file): under a 75–90% gradient a sharper
         photo isn't visible, and it's a third of the bytes of the 1280px one on the page's critical path.
         scripts/prerender.mjs preloads it with the same sizes (HERO_SIZES), so keep the two in step. -->
    <template v-if="photo">
      <ResponsivePicture
        :name="photo"
        sizes="(max-width: 767px) 50vw, 100vw"
        alt=""
        priority
        img-class="absolute inset-0 -z-10 w-full h-full object-cover"
      />
      <div class="absolute inset-0 -z-10 bg-gradient-to-br from-pine-deep/90 via-pine/75 to-pine-deep/90" aria-hidden="true" />
    </template>

    <div class="relative w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16 text-on-primary">
      <p v-if="label" class="text-label-l uppercase tracking-[.2em] text-gold-container mb-3">{{ label }}</p>
      <BrandLogo v-if="logo" :size="logoSize" eager alt="Deer Run Golf Course" class="mb-4" />
      <h1 v-dompurify-html="titleHtml" :class="['font-display font-bold text-display-s md:text-display-l', logo ? 'sr-only' : '']" />
      <p v-if="subtitle" v-dompurify-html="subtitle" class="font-display text-headline-s mt-2" />
      <p v-if="description" class="text-body-l text-on-primary/90 max-w-xl mt-4">{{ description }}</p>
      <slot />
    </div>
  </section>
</template>

<script setup>
// Page hero on pine with an optional course photo (a name from src/data/photos.js). The title is HTML so pages can
// use the brand's italic accents ("Book a <em>Tee Time</em>"). With `logo`, the emblem is the visual title and the
// <h1> stays for screen readers.
import BrandLogo from '@/components/ui/BrandLogo.vue'
import ResponsivePicture from '@/components/ui/ResponsivePicture.vue'

defineProps({
  label:       { type: String, default: '' },
  titleHtml:   { type: String, required: true },
  subtitle:    { type: String, default: '' },
  description: { type: String, default: '' },
  photo:       { type: String, default: '' },
  // A minimum: the hero grows when the text wraps on a phone instead of clipping it
  height:      { type: String, default: '250px' },
  classes:     { type: [Array, String], default: '' },
  logo:        { type: Boolean, default: false },
  logoSize:    { type: Number, default: 200 },
})
</script>
