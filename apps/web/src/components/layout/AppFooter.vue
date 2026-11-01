<template>
  <footer class="on-dark bg-primary text-on-primary print:hidden">
    <div class="max-w-7xl mx-auto px-4 md:px-5 pt-12 md:pt-16 pb-8">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-10 pb-10 border-b border-on-primary/[.16]">
        <!-- Brand + newsletter -->
        <div class="sm:col-span-2 lg:col-span-5">
          <RouterLink to="/" class="inline-flex rounded-shape-sm" aria-label="Deer Run Golf Course, home">
            <BrandLogo :size="72" alt="" />
          </RouterLink>
          <p class="mt-4 text-body-m text-inverse-primary max-w-sm">
            18 holes nestled at the entrance to the Bankhead National Forest in Moulton, Alabama.
            Earl Stone design, open to the public daily since 1980.
          </p>

          <form class="mt-8 max-w-md" novalidate aria-labelledby="newsletter-title" @submit.prevent="subscribe">
            <h2 id="newsletter-title" class="text-title-s text-gold-container">Get course news</h2>
            <p class="mt-1 mb-3 text-body-s text-inverse-primary">Tournaments, specials and course updates by email.</p>
            <div v-if="status === 'done'" class="flex items-start gap-2 text-body-m text-on-primary" role="status">
              <IconCheckCircle class="w-5 h-5 mt-0.5 text-gold-container" aria-hidden="true" />
              <span>Thanks! You’re on the list.</span>
            </div>
            <template v-else>
              <div class="flex flex-col sm:flex-row gap-2">
                <div class="flex-1 min-w-0">
                  <label for="newsletter-email" class="sr-only">Email address</label>
                  <input
                    id="newsletter-email"
                    v-model.trim="newsletterEmail"
                    type="email"
                    name="email"
                    autocomplete="email"
                    inputmode="email"
                    placeholder="you@example.com"
                    :aria-invalid="emailError ? 'true' : undefined"
                    :aria-describedby="emailError || status === 'error' ? 'newsletter-error' : undefined"
                    :class="[
                      'w-full h-12 px-4 rounded-full bg-surface-container-lowest text-on-surface text-body-l placeholder:text-on-surface-variant',
                      'border-2', emailError ? 'border-error-container' : 'border-transparent',
                    ]"
                    @blur="touched = true"
                  >
                  <p
                    v-if="emailError || status === 'error'"
                    id="newsletter-error"
                    class="mt-2 px-1 flex items-start gap-1.5 text-body-s text-error-container"
                    role="alert"
                  >
                    <IconError class="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{{ emailError || 'Sorry, that didn’t go through. Please try again, or email us.' }}</span>
                  </p>
                </div>
                <AppButton variant="gold" size="lg" type="submit" :loading="status === 'sending'" :icon="IconSend" class="sm:self-start">
                  Subscribe
                </AppButton>
              </div>
            </template>
          </form>
        </div>

        <!-- Quick links -->
        <nav class="lg:col-span-3" aria-labelledby="footer-links-title">
          <h2 id="footer-links-title" class="text-title-s text-gold-container mb-3">Explore</h2>
          <ul class="grid grid-cols-2 sm:grid-cols-1 gap-x-4">
            <li v-for="p in pages" :key="p.to">
              <RouterLink :to="p.to" class="footer-link">{{ p.label }}</RouterLink>
            </li>
          </ul>
        </nav>

        <!-- Visit -->
        <div class="lg:col-span-4">
          <h2 class="text-title-s text-gold-container mb-3">Visit</h2>
          <ul class="space-y-1 text-body-m">
            <li>
              <a :href="site.mapsDirectionsUrl" target="_blank" rel="noopener" class="footer-row">
                <IconLocation class="w-5 h-5 mt-0.5 flex-shrink-0 text-gold-container" aria-hidden="true" />
                <span>
                  <span v-for="line in site.addressLines" :key="line" class="block">{{ line }}</span>
                  <span class="sr-only"> (directions in Google Maps, opens in a new tab)</span>
                </span>
              </a>
            </li>
            <li>
              <a :href="`tel:${site.phone.tel}`" class="footer-row">
                <IconCall class="w-5 h-5 flex-shrink-0 text-gold-container" aria-hidden="true" />
                <span>{{ site.phone.display }}</span>
              </a>
            </li>
            <li>
              <a :href="`mailto:${site.email}`" class="footer-row">
                <IconMail class="w-5 h-5 flex-shrink-0 text-gold-container" aria-hidden="true" />
                <span class="break-all">{{ site.email }}</span>
              </a>
            </li>
            <li class="flex items-start gap-3 py-2 text-on-primary">
              <IconSchedule class="w-5 h-5 mt-0.5 flex-shrink-0 text-gold-container" aria-hidden="true" />
              <span>
                <span class="sr-only">Hours: </span>
                <span v-for="h in site.hours" :key="h" class="block">{{ h }}</span>
              </span>
            </li>
          </ul>
          <a
            :href="site.mapsDirectionsUrl"
            target="_blank"
            rel="noopener"
            class="state-layer mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-full border border-inverse-primary text-label-l text-on-primary no-underline"
          >
            <IconDirections class="w-[18px] h-[18px]" aria-hidden="true" />
            Get directions
            <span class="sr-only">(opens in a new tab)</span>
          </a>

          <!-- Social links (site.social stays empty until the course confirms its pages) -->
          <ul v-if="site.social.length" class="mt-6 flex gap-1" aria-label="Deer Run on social media">
            <li v-for="s in site.social" :key="s.url">
              <a
                :href="s.url"
                target="_blank"
                rel="noopener"
                :aria-label="`${s.label} (opens in a new tab)`"
                class="state-layer w-12 h-12 inline-flex items-center justify-center rounded-full text-on-primary"
              >
                <component :is="s.icon" class="w-6 h-6" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Legal. Privacy Policy and Accessibility links come with their pages (Feature 4 → Phase 3). -->
      <div class="pt-6 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 text-body-s text-inverse-primary">
        <p>© {{ year }} City of Moulton, AL · Deer Run Golf Course. All rights reserved.</p>
        <ul class="flex flex-wrap gap-x-4">
          <li>
            <a :href="site.cityPageUrl" target="_blank" rel="noopener" class="footer-link inline-flex items-center gap-1">
              City of Moulton
              <IconOpenInNew class="w-4 h-4" aria-hidden="true" />
              <span class="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </footer>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import * as site from '@/data/site.js'
import { computed, ref } from 'vue'
import IconCall from '~icons/material-symbols/call-rounded'
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded'
import IconDirections from '~icons/material-symbols/directions-rounded'
import IconError from '~icons/material-symbols/error-rounded'
import IconLocation from '~icons/material-symbols/location-on-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconOpenInNew from '~icons/material-symbols/open-in-new-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconSend from '~icons/material-symbols/send-rounded'

const year = new Date().getFullYear()

const pages = [
  { to: '/',            label: 'Home' },
  { to: '/scorecard',   label: 'The Course' },
  { to: '/rates',       label: 'Rates' },
  { to: '/memberships', label: 'Memberships' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/contact',     label: 'Contact' },
  { to: '/book',        label: 'Book a Tee Time' },
]

// ── Newsletter signup: saved as a contact message (POST /api/inquiries/contact) until there's a mailing list ──
const newsletterEmail = ref('')
const touched = ref(false)
const submitted = ref(false)
const status = ref('idle') // idle | sending | done | error

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emailError = computed(() => {
  if (!touched.value && !submitted.value) return ''
  if (!newsletterEmail.value) return 'Enter your email address.'
  if (!EMAIL_RE.test(newsletterEmail.value)) return 'Enter an email address like name@example.com.'
  return ''
})

async function subscribe() {
  submitted.value = true
  if (emailError.value) {
    document.getElementById('newsletter-email')?.focus()
    return
  }
  status.value = 'sending'
  try {
    const res = await fetch('/api/inquiries/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Newsletter signup',
        email: newsletterEmail.value,
        subject: 'Newsletter signup',
        message: 'Please add me to the Deer Run newsletter.',
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    status.value = 'done'
  } catch {
    status.value = 'error'
  }
}
</script>

<style scoped>
.footer-link {
  @apply inline-flex items-center min-h-[40px] text-body-m text-on-primary no-underline underline-offset-4 rounded-shape-xs;
}
.footer-link:hover { @apply underline; }

.footer-row {
  @apply flex items-start gap-3 py-2 text-on-primary no-underline underline-offset-4 rounded-shape-xs;
}
.footer-row:hover span { @apply underline; }
</style>
