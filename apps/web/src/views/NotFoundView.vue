<template>
  <!-- Catch-all route (router: /:pathMatch(.*)*). meta.noindex adds <meta name="robots" content="noindex"> (App.vue). -->
  <section class="max-w-2xl mx-auto px-4 md:px-6 py-16 md:py-24 flex flex-col items-center text-center" aria-labelledby="not-found-title">
    <span class="w-20 h-20 mb-6 inline-flex items-center justify-center rounded-full bg-primary-container text-on-primary-container" aria-hidden="true">
      <IconWrongLocation class="w-10 h-10" />
    </span>
    <p class="text-label-l text-gold-text uppercase tracking-widest mb-2">Error 404</p>
    <h1 id="not-found-title" class="font-display text-headline-l md:text-display-s text-on-surface mb-4">
      Looks like that one went <em>out of bounds</em>
    </h1>
    <p class="text-body-l text-on-surface-variant max-w-md mb-2">
      We couldn’t find the page you were looking for. It may have moved, or the link may be mistyped.
    </p>
    <p class="text-body-m text-on-surface-variant mb-8 break-all">
      <span class="sr-only">Address: </span><code class="font-body">{{ route.fullPath }}</code>
    </p>
    <div class="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full sm:w-auto">
      <AppButton variant="gold" size="lg" to="/book" :icon="IconEventAvailable">Book a tee time</AppButton>
      <AppButton variant="filled" size="lg" to="/" :icon="IconHome">Back to home</AppButton>
      <AppButton variant="outlined" size="lg" to="/contact" :icon="IconContact">Contact us</AppButton>
    </div>
  </section>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue'
import { useRoute } from 'vue-router'
import IconContact from '~icons/material-symbols/contact-support-rounded'
import IconEventAvailable from '~icons/material-symbols/event-available-rounded'
import IconHome from '~icons/material-symbols/home-rounded'
import IconWrongLocation from '~icons/material-symbols/wrong-location-rounded'

const route = useRoute()
</script>
