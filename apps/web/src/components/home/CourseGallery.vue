<template>
  <section class="py-12 md:py-20" aria-labelledby="gallery-title">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <p class="text-label-l uppercase tracking-[.2em] text-gold-text">Gallery</p>
      <h2 id="gallery-title" class="mt-2 font-display text-headline-m md:text-headline-l text-on-surface">
        Around the <em class="italic">course</em>
      </h2>

      <!-- Phones: a horizontal snap carousel. md+: a mosaic (large photo, tall portrait, a row of three). -->
      <ul
        class="mt-8 -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 sm:scroll-px-6
               [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
               md:grid md:grid-cols-3 md:auto-rows-[220px] lg:auto-rows-[260px] md:gap-4 md:overflow-visible"
        aria-label="Course photos"
      >
        <li
          v-for="(p, i) in photos"
          :key="p.name"
          :class="['snap-start flex-shrink-0 w-[85%] sm:w-[60%] md:w-auto aspect-[4/3] md:aspect-auto', p.tile]"
        >
          <button
            type="button"
            class="group relative block w-full h-full overflow-hidden rounded-shape-md bg-surface-container-highest"
            :aria-label="`View larger: ${p.alt}`"
            @click="open = i"
          >
            <ResponsivePicture
              :name="p.name"
              :sizes="p.sizes"
              :alt="p.alt"
              img-class="absolute inset-0 w-full h-full object-cover transition-transform duration-long-2 ease-standard group-hover:scale-105"
            />
            <span
              class="absolute right-3 bottom-3 inline-flex items-center justify-center w-10 h-10 rounded-full bg-pine-deep/70 text-on-primary
                     opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100 transition-opacity duration-short-4"
              aria-hidden="true"
            >
              <IconZoom class="w-5 h-5" />
            </span>
          </button>
        </li>
      </ul>
      <p class="mt-3 text-body-s text-on-surface-variant md:hidden" aria-hidden="true">Swipe for more photos</p>
    </div>

    <GalleryLightbox v-model:index="open" :photos="photos" />
  </section>
</template>

<script setup>
// Home course gallery: snap carousel on phones, mosaic from md, and a full-screen lightbox. Uses each photo once
// (the -wide crops are left out).
import ResponsivePicture from '@/components/ui/ResponsivePicture.vue'
import { photos as manifest } from '@/data/photos'
import { ref } from 'vue'
import GalleryLightbox from './GalleryLightbox.vue'
import IconZoom from '~icons/material-symbols/zoom-in-rounded'

// Phone widths: 85vw (60vw from sm). md+: thirds of the 1280px content column.
const SMALL = '(min-width: 1280px) 400px, (min-width: 768px) 33vw, (min-width: 640px) 60vw, 85vw'
const LARGE = '(min-width: 1280px) 820px, (min-width: 768px) 66vw, (min-width: 640px) 60vw, 85vw'

const photos = [
  { name: 'course-hero', sizes: LARGE, tile: 'md:col-span-2 md:row-span-2' },
  { name: 'course-2', sizes: SMALL, tile: 'md:row-span-2' },
  { name: 'course-3', sizes: SMALL, tile: '' },
  { name: 'course-4', sizes: SMALL, tile: '' },
  { name: 'course-5', sizes: SMALL, tile: '' },
].map(p => ({ ...p, alt: manifest[p.name].alt }))

const open = ref(null)
</script>
