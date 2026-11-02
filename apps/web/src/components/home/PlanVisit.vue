<template>
  <section class="bg-surface-container-low border-y border-outline-variant" aria-labelledby="plan-visit-title">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <p class="text-label-l uppercase tracking-[.2em] text-gold-text">Plan your visit</p>
      <h2 id="plan-visit-title" class="mt-2 font-display text-headline-m md:text-headline-l text-on-surface">
        Getting to <em class="italic">Deer Run</em>
      </h2>

      <Card variant="elevated" padding="none" class="mt-8">
        <div class="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <!-- Map: lazy, it's below the fold -->
          <div class="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[440px] bg-surface-container-highest">
            <iframe
              :title="`Map: ${courseName}`"
              :src="mapEmbedUrl"
              class="absolute inset-0 w-full h-full border-0"
              loading="lazy"
              allowfullscreen
              referrerpolicy="no-referrer-when-downgrade"
            />
          </div>

          <div class="flex flex-col gap-6 p-6 border-t lg:border-t-0 lg:border-l border-outline-variant">
            <div class="flex gap-4">
              <span class="tile-icon" aria-hidden="true"><IconLocation class="w-6 h-6" /></span>
              <div class="min-w-0">
                <h3 class="text-title-m text-on-surface">{{ courseName }}</h3>
                <address class="not-italic">
                  <p v-for="line in addressLines" :key="line" class="text-body-m text-on-surface-variant">{{ line }}</p>
                </address>
              </div>
            </div>

            <ul class="flex flex-col gap-4">
              <li v-for="item in items" :key="item.title" class="flex gap-4">
                <span class="tile-icon" aria-hidden="true"><component :is="item.icon" class="w-6 h-6" /></span>
                <div class="min-w-0">
                  <h3 class="text-label-l text-on-surface-variant">{{ item.title }}</h3>
                  <p v-for="line in item.lines" :key="line" class="text-body-m text-on-surface">{{ line }}</p>
                  <a
                    v-if="item.link"
                    :href="item.link.href"
                    :target="item.link.external ? '_blank' : undefined"
                    :rel="item.link.external ? 'noopener' : undefined"
                    class="inline-flex items-center gap-1 min-h-touch text-label-l text-primary underline underline-offset-4"
                  >
                    {{ item.link.label }}
                    <IconOpenInNew v-if="item.link.external" class="w-4 h-4" aria-hidden="true" />
                    <span v-if="item.link.external" class="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
              </li>
            </ul>

            <div class="mt-auto flex flex-wrap gap-2">
              <AppButton :href="mapsDirectionsUrl" variant="filled" :icon="IconDirections" target="_blank" rel="noopener" class="flex-1">
                Directions<span class="sr-only"> in Google Maps (opens in a new tab)</span>
              </AppButton>
              <AppButton :href="appleMapsUrl" variant="outlined" :icon="IconMap" target="_blank" rel="noopener" class="flex-1">
                Apple Maps<span class="sr-only"> (opens in a new tab)</span>
              </AppButton>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </section>
</template>

<script setup>
// Home "Plan your visit": a card with the course's Google map (src/lib/maps.js) beside the address, hours, phone and
// weather from src/data/site.js, plus directions buttons. Weather links to the National Weather Service forecast for
// Moulton (no weather API).
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import { addressLines, appleMapsUrl, courseName, hours, mapsDirectionsUrl, phone } from '@/data/site'
import { mapEmbedUrl } from '@/lib/maps'
import IconCall from '~icons/material-symbols/call-rounded'
import IconDirections from '~icons/material-symbols/directions-rounded'
import IconLocation from '~icons/material-symbols/location-on-rounded'
import IconMap from '~icons/material-symbols/map-rounded'
import IconOpenInNew from '~icons/material-symbols/open-in-new-rounded'
import IconWeather from '~icons/material-symbols/partly-cloudy-day-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'

const WEATHER_URL = 'https://forecast.weather.gov/MapClick.php?lat=34.48&lon=-87.29'

const items = [
  { title: 'Hours', icon: IconSchedule, lines: hours },
  { title: 'Pro Shop', icon: IconCall, lines: ['Tee times, memberships and events'], link: { href: `tel:${phone.tel}`, label: phone.display } },
  { title: 'Weather', icon: IconWeather, lines: ['Moulton forecast'], link: { href: WEATHER_URL, label: 'National Weather Service', external: true } },
]
</script>

<style scoped>
.tile-icon { @apply inline-flex items-center justify-center w-10 h-10 flex-shrink-0 rounded-full bg-primary-container text-on-primary-container; }
</style>
