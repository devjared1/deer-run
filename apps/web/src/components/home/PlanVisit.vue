<template>
  <section class="bg-surface-container-low border-y border-outline-variant" aria-labelledby="plan-visit-title">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p class="text-label-l uppercase tracking-[.2em] text-gold-text">Plan your visit</p>
          <h2 id="plan-visit-title" class="mt-2 font-display text-headline-m md:text-headline-l text-on-surface">
            Getting to <em class="italic">Deer Run</em>
          </h2>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton :href="mapsDirectionsUrl" variant="filled" :icon="IconDirections" target="_blank" rel="noopener">
            Directions<span class="sr-only"> in Google Maps (opens in a new tab)</span>
          </AppButton>
          <AppButton :href="appleMapsUrl" variant="outlined" :icon="IconMap" target="_blank" rel="noopener">
            Apple Maps<span class="sr-only"> (opens in a new tab)</span>
          </AppButton>
        </div>
      </div>

      <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="item in items" :key="item.title" class="flex gap-4 rounded-shape-md bg-surface p-4 border border-outline-variant">
          <span class="inline-flex items-center justify-center w-12 h-12 flex-shrink-0 rounded-full bg-primary-container text-on-primary-container" aria-hidden="true">
            <component :is="item.icon" class="w-6 h-6" />
          </span>
          <div class="min-w-0">
            <h3 class="text-title-m text-on-surface">{{ item.title }}</h3>
            <p v-for="line in item.lines" :key="line" class="text-body-m text-on-surface-variant">{{ line }}</p>
            <a
              v-if="item.link"
              :href="item.link.href"
              :target="item.link.external ? '_blank' : undefined"
              :rel="item.link.external ? 'noopener' : undefined"
              class="mt-1 inline-flex items-center gap-1 min-h-touch text-label-l text-primary underline underline-offset-4"
            >
              {{ item.link.label }}
              <IconOpenInNew v-if="item.link.external" class="w-4 h-4" aria-hidden="true" />
              <span v-if="item.link.external" class="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
// Home "Plan your visit" strip: address, hours, phone and weather from src/data/site.js, plus directions buttons.
// Weather links to the National Weather Service forecast for Moulton (no weather API).
import AppButton from '@/components/ui/AppButton.vue'
import { addressLines, appleMapsUrl, hours, mapsDirectionsUrl, phone } from '@/data/site'
import IconCall from '~icons/material-symbols/call-rounded'
import IconDirections from '~icons/material-symbols/directions-rounded'
import IconLocation from '~icons/material-symbols/location-on-rounded'
import IconMap from '~icons/material-symbols/map-rounded'
import IconOpenInNew from '~icons/material-symbols/open-in-new-rounded'
import IconWeather from '~icons/material-symbols/partly-cloudy-day-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'

const WEATHER_URL = 'https://forecast.weather.gov/MapClick.php?lat=34.48&lon=-87.29'

const items = [
  { title: 'Address', icon: IconLocation, lines: addressLines, link: { href: mapsDirectionsUrl, label: 'Get directions', external: true } },
  { title: 'Hours', icon: IconSchedule, lines: hours },
  { title: 'Pro Shop', icon: IconCall, lines: ['Tee times, memberships and events'], link: { href: `tel:${phone.tel}`, label: phone.display } },
  { title: 'Weather', icon: IconWeather, lines: ['Moulton forecast'], link: { href: WEATHER_URL, label: 'National Weather Service', external: true } },
]
</script>
