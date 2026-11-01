<template>
  <section class="on-dark relative isolate overflow-hidden bg-pine-deep text-on-primary" aria-labelledby="home-title">
    <!-- Full-bleed photo (the LCP image) under a pine gradient that keeps the text AA.
         -->
    <ResponsivePicture
      name="course-hero"
      sizes="100vw"
      alt=""
      priority
      img-class="absolute inset-0 -z-10 w-full h-full object-cover object-[60%_50%]"
    />
    <div class="absolute inset-0 -z-10 bg-gradient-to-b from-pine-deep/60 via-pine-deep/75 to-pine-deep/95 lg:hidden" aria-hidden="true" />
    <div class="absolute inset-0 -z-10 hidden lg:block bg-gradient-to-r from-pine-deep/95 via-pine-deep/75 to-pine-deep/30" aria-hidden="true" />
    <div class="absolute inset-x-0 bottom-0 h-40 -z-10 hidden lg:block bg-gradient-to-t from-pine-deep/70 to-transparent" aria-hidden="true" />

    <div
      class="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12 md:pt-16 md:pb-20 lg:py-20
             lg:min-h-[min(calc(100svh-72px),860px)] grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_420px] items-center"
    >
      <div class="max-w-2xl">
        <BrandLogo :size="96" eager alt="" class="md:hidden" />
        <BrandLogo :size="168" eager alt="" class="hidden md:inline-block" />
        <p class="mt-6 text-label-l uppercase tracking-[.2em] text-gold-container">
          An Earl Stone design · Moulton, Alabama
        </p>
        <h1 id="home-title" class="mt-3 font-display text-display-s md:text-display-m xl:text-display-l text-on-primary">
          <span class="sr-only">Deer Run Golf Course: </span>
          Eighteen holes at the edge of the <em class="italic">Bankhead</em>
        </h1>
        <p class="mt-4 text-body-l md:text-title-m md:font-normal text-on-primary max-w-xl">
          18 championship holes at the entrance to the Bankhead National Forest. Open to the public daily since 1980.
        </p>
        <div class="mt-6 hidden md:flex flex-wrap gap-3">
          <AppButton to="/scorecard" variant="outlined" size="lg" class="!border-on-primary/60 !text-on-primary" :trailing-icon="IconArrowForward">
            Explore the course
          </AppButton>
        </div>
      </div>

      <TeeTimeSearch class="w-full max-w-lg lg:max-w-none" />
    </div>
  </section>
</template>

<script setup>
// Home page hero: full-bleed course photo, the emblem as the brand moment, a headline with the italic accent and the
// instant tee time search.
import AppButton from '@/components/ui/AppButton.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import ResponsivePicture from '@/components/ui/ResponsivePicture.vue'
import TeeTimeSearch from './TeeTimeSearch.vue'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
</script>
