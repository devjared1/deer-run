<template>
  <section
    class="on-dark relative isolate overflow-hidden bg-pine-deep text-on-primary"
    aria-labelledby="course-title"
  >
    <!-- Full-bleed photo under a pine gradient that keeps the text AA (the same treatment as HomeHero) -->
    <ResponsivePicture
      name="course-hero"
      sizes="100vw"
      alt=""
      priority
      img-class="absolute inset-0 -z-10 w-full h-full object-cover object-[60%_50%]"
    />
    <div
      class="absolute inset-0 -z-10 bg-gradient-to-b from-pine-deep/60 via-pine-deep/75 to-pine-deep/95 lg:hidden"
      aria-hidden="true"
    />
    <div
      class="absolute inset-0 -z-10 hidden lg:block bg-gradient-to-r from-pine-deep/95 via-pine-deep/75 to-pine-deep/30"
      aria-hidden="true"
    />
    <div
      class="absolute inset-x-0 bottom-0 h-40 -z-10 hidden lg:block bg-gradient-to-t from-pine-deep/70 to-transparent"
      aria-hidden="true"
    />

    <div
      class="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12 md:pt-16 md:pb-20 lg:py-16
             lg:min-h-[min(calc(100svh-72px),760px)] grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center"
    >
      <div class="max-w-xl">
        <p class="text-label-l uppercase tracking-[.2em] text-gold-container">
          Deer Run
        </p>
        <h1 id="course-title" class="mt-3 font-display font-bold text-display-s md:text-display-l text-on-primary">
          The <em>Course</em>
        </h1>
        <p class="mt-4 text-body-l md:text-title-m md:font-normal text-on-primary">
          18 holes · Par {{ par }} · Earl Stone design · Moulton, Alabama
        </p>
        <p class="mt-3 text-body-l text-on-primary">
          Select a hole number on the map for its yardage, handicap and features.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <AppButton to="/book" variant="gold" size="lg" :trailing-icon="IconArrowForward">
            Book a tee time
          </AppButton>
          <AppButton
            to="#scorecard"
            variant="outlined"
            size="lg"
            class="!border-on-primary/60 !text-on-primary"
          >
            View the scorecard
          </AppButton>
        </div>
      </div>

      <!-- The map floats on the photo: a feathered, blurred pine scrim calms the photo behind it and a parchment
           outline traces its shapes, so the dark tree lines don't merge with the trees in the photo -->
      <div class="relative p-3 sm:p-5">
        <div class="map-scrim" aria-hidden="true" />
        <div class="relative">
          <picture class="map-outline">
            <source
              type="image/webp"
              srcset="/images/course/course-layout-800.webp 800w, /images/course/course-layout-1400.webp 1400w, /images/course/course-layout-2200.webp 2200w"
              sizes="(min-width: 1280px) 690px, (min-width: 1024px) 55vw, calc(100vw - 3.5rem)"
            >
            <img
              src="/images/course/course-layout-1400.png"
              width="1400"
              height="968"
              alt="Map of Deer Run's 18 holes: numbered fairways and greens between tree lines, with ponds beside holes 1, 7 and 9 and a creek along holes 4 and 5"
              fetchpriority="high"
              decoding="async"
              class="w-full h-auto"
            >
          </picture>

          <!-- A numbered badge over each circle on the map (the drawn ones are too small to read or tap), linking to
               that hole's page -->
          <RouterLink
            v-for="h in mapHoles"
            :key="h.hole"
            :to="`/course/hole/${h.hole}`"
            :aria-label="`Hole ${h.hole}: ${h.name}, par ${h.par}, ${h.yards[teeIndex]} yards`"
            :style="{ left: `${h.x}%`, top: `${h.y}%` }"
            class="group absolute flex items-center justify-center w-[18px] h-[18px] sm:w-6 sm:h-6 -translate-x-1/2 -translate-y-1/2
                   rounded-full bg-primary text-on-primary ring-2 ring-parch shadow-elevation-1 text-[10px] sm:text-label-m font-bold tabular-nums
                   transition-colors duration-short-4 ease-standard hover:bg-gold hover:text-on-gold hover:z-20 focus-visible:z-20"
          >
            <span aria-hidden="true">{{ h.hole }}</span>
            <span
              :class="[
                'pointer-events-none absolute bottom-full mb-2 hidden group-hover:block group-focus-visible:block z-10',
                'whitespace-nowrap rounded-shape-sm bg-inverse-surface text-inverse-on-surface px-3 py-1.5 shadow-elevation-2',
                h.x > 75 ? 'right-0' : h.x < 25 ? 'left-0' : 'left-1/2 -translate-x-1/2',
              ]"
              aria-hidden="true"
            >
              <span class="block text-label-l">{{ h.hole }} · {{ h.name }}</span>
              <span class="block text-body-s tabular-nums">Par {{ h.par }} · {{ h.yards[teeIndex] }} yds · Hcp {{ h.hdcp }}</span>
            </span>
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
// The Course page hero: course photo, title and the course layout map (public/images/course, rendered from
// photos-src/HoleLayout.svg). Each numbered circle on the map links to its hole page, with a hover/focus card showing
// par and the selected tee's yardage.
import AppButton from '@/components/ui/AppButton.vue'
import ResponsivePicture from '@/components/ui/ResponsivePicture.vue'
import { holes, totalPar } from '@/data/holes'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'

defineProps({
  teeIndex: { type: Number, default: 0 },
})

// Centre of each hole's number circle on the map, in % of the image's width and height (measured on the 1400px
// render; redo these if the map changes)
const MAP_POSITIONS = {
  1: [58.25, 28.82], 2: [43.14, 48.45], 3: [19.25, 77.38], 4: [10.82, 62.24], 5: [35.21, 52.63], 6: [31.25, 42.87],
  7: [29.29, 24.33], 8: [42.89, 15.6], 9: [68.96, 24.07], 10: [88.32, 44.63], 11: [71.18, 62.91], 12: [82.14, 44.11],
  13: [69.29, 47.99], 14: [56.04, 67.61], 15: [27.32, 85.33], 16: [30.18, 71.85], 17: [49.68, 51.6], 18: [68.18, 39.72],
}

const par = totalPar()
const mapHoles = holes
  .filter(h => MAP_POSITIONS[h.hole])
  .map(h => ({ ...h, x: MAP_POSITIONS[h.hole][0], y: MAP_POSITIONS[h.hole][1] }))
</script>

<style scoped>
/* Darkens and softens the photo behind the map, fading out at the edges (no visible card) */
.map-scrim {
  position: absolute;
  inset: -8%;
  z-index: -1;
  background: radial-gradient(closest-side, rgb(13 31 22 / 0.8) 55%, rgb(13 31 22 / 0));
  backdrop-filter: blur(6px);
  mask-image: radial-gradient(closest-side, #000 55%, transparent);
}

/* A thin parchment edge around every shape on the (transparent) map, plus a faint glow */
.map-outline img {
  filter:
    drop-shadow(0 0 1px rgb(242 235 217 / 0.9))
    drop-shadow(0 0 1px rgb(242 235 217 / 0.9))
    drop-shadow(0 0 10px rgb(242 235 217 / 0.25));
}
</style>
