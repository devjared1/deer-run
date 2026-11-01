<template>
  <div>
    <PageHero
      label="Green fees"
      title-html="Rates &amp; <em>Services</em>"
      description="Simple weekday and weekend rates for 9 or 18 holes. Ride or walk."
      photo="course-3"
      height="400px"
    />

    <div class="bg-surface">
      <!-- Greens fees (live from /api/rates) -->
      <section class="max-w-5xl mx-auto px-4 sm:px-6 pt-12 md:pt-20 pb-12" aria-labelledby="greens-title">
        <p class="text-label-l uppercase tracking-[.2em] text-gold-text text-center mb-2">Per player</p>
        <h2 id="greens-title" class="font-display text-headline-m md:text-headline-l text-on-surface text-center mb-8">Greens fees</h2>

        <p v-if="loading" class="sr-only" role="status">Loading today’s prices</p>
        <div
          v-if="ratesFailed"
          class="mb-6 flex items-start gap-3 rounded-shape-md bg-secondary-container text-on-secondary-container p-4 text-body-m"
          role="status"
        >
          <IconInfo class="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p>
            We couldn’t load today’s prices, so these are our standard rates.
            Call <a :href="`tel:${phone.tel}`" class="font-bold underline underline-offset-2">{{ phone.display }}</a> to confirm.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6" :aria-busy="loading ? 'true' : undefined">
          <Card v-for="card in rateCards" :key="card.title" tag="article" variant="outlined" padding="lg" :aria-labelledby="`rate-${card.key}`">
            <div class="flex items-start gap-3">
              <span class="w-12 h-12 flex-shrink-0 inline-flex items-center justify-center rounded-full bg-primary-container text-on-primary-container" aria-hidden="true">
                <component :is="card.icon" class="w-6 h-6" />
              </span>
              <div>
                <h3 :id="`rate-${card.key}`" class="font-display text-headline-s text-on-surface">{{ card.title }}</h3>
                <p class="text-body-m text-on-surface-variant">{{ card.days }}</p>
              </div>
            </div>
            <dl class="mt-6 grid grid-cols-2 gap-4">
              <div v-for="p in card.prices" :key="p.label" class="rounded-shape-sm bg-surface-container-low px-4 py-4">
                <dt class="text-label-l text-on-surface-variant">{{ p.label }}</dt>
                <dd class="mt-1 font-display font-bold text-display-s text-on-surface">
                  <Skeleton v-if="loading" variant="rect" width="5rem" height="2.75rem" />
                  <template v-else>{{ dollars(p.cents) }}</template>
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <!-- Cart fee -->
        <div class="mt-6 flex flex-col sm:flex-row sm:items-center gap-4 rounded-shape-md bg-primary text-on-primary on-dark p-6">
          <span class="w-12 h-12 flex-shrink-0 inline-flex items-center justify-center rounded-full bg-on-primary/10 text-gold-container" aria-hidden="true">
            <IconGolfCart class="w-7 h-7" />
          </span>
          <div class="flex-1">
            <h3 class="font-display text-headline-s">Cart fee</h3>
            <p class="text-body-m text-inverse-primary">Per rider, added to the greens fee. Walking is welcome.</p>
          </div>
          <div class="font-display font-bold text-display-s">
            <Skeleton v-if="loading" variant="rect" width="5rem" height="2.75rem" />
            <template v-else>{{ dollars(rates.CART) }}<span class="sr-only"> per rider</span></template>
          </div>
        </div>

        <ul class="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-2" aria-label="Good to know">
          <li v-for="item in rateIncludes" :key="item" class="flex items-start gap-2 text-body-m text-on-surface">
            <IconCheckSmall class="w-6 h-6 -my-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
            <span>{{ item }}</span>
          </li>
        </ul>

        <div class="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 text-center">
          <AppButton variant="gold" size="lg" to="/book" :icon="IconEventAvailable">Book a tee time</AppButton>
          <p class="text-body-m text-on-surface-variant">
            or call <a :href="`tel:${phone.tel}`" class="text-primary font-bold underline underline-offset-2">{{ phone.display }}</a>
          </p>
        </div>
      </section>

      <!-- Additional services -->
      <section class="bg-surface-container-low" aria-labelledby="services-title">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <h2 id="services-title" class="font-display text-headline-m text-on-surface text-center mb-6">Additional services</h2>

          <!-- sm and up: a table -->
          <div class="hidden sm:block rounded-shape-md overflow-hidden border border-outline-variant bg-surface-container-lowest">
            <table class="w-full text-left">
              <caption class="sr-only">Additional services and their prices</caption>
              <thead class="bg-surface-container-high">
                <tr>
                  <th scope="col" class="py-3 px-5 text-label-l text-on-surface-variant">Service</th>
                  <th scope="col" class="py-3 px-5 text-label-l text-on-surface-variant">Details</th>
                  <th scope="col" class="py-3 px-5 text-label-l text-on-surface-variant text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fee in additionalFees" :key="fee.item" class="border-t border-outline-variant">
                  <th scope="row" class="py-3.5 px-5 text-title-s text-on-surface">{{ fee.item }}</th>
                  <td class="py-3.5 px-5 text-body-m text-on-surface-variant">{{ fee.note }}</td>
                  <td class="py-3.5 px-5 text-title-m text-on-surface text-right whitespace-nowrap">{{ fee.price }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Phones: stacked, the notes stay visible -->
          <ul class="sm:hidden rounded-shape-md overflow-hidden border border-outline-variant bg-surface-container-lowest" aria-label="Additional services and their prices">
            <li v-for="fee in additionalFees" :key="fee.item" class="px-4 py-3 border-t border-outline-variant first:border-t-0">
              <div class="flex items-baseline justify-between gap-4">
                <span class="text-title-s text-on-surface">{{ fee.item }}</span>
                <span class="text-title-m text-on-surface whitespace-nowrap">{{ fee.price }}</span>
              </div>
              <p class="mt-0.5 text-body-m text-on-surface-variant">{{ fee.note }}</p>
            </li>
          </ul>
        </div>
      </section>

      <!-- Policies -->
      <section class="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16" aria-labelledby="policies-title">
        <h2 id="policies-title" class="font-display text-headline-m text-on-surface text-center mb-6">Course policies</h2>
        <ul class="space-y-3">
          <li v-for="p in policies" :key="p" class="flex items-start gap-3 text-body-l text-on-surface">
            <IconInfo class="w-5 h-5 mt-0.5 flex-shrink-0 text-secondary" aria-hidden="true" />
            <span>{{ p }}</span>
          </li>
        </ul>
      </section>

      <!-- Group outings -->
      <section class="max-w-3xl mx-auto px-4 sm:px-6 pb-16 md:pb-24" aria-labelledby="groups-title">
        <div class="rounded-shape-lg bg-primary-container text-on-primary-container p-6 md:p-10 text-center">
          <span class="inline-flex w-14 h-14 items-center justify-center rounded-full bg-primary text-on-primary mb-4" aria-hidden="true">
            <IconGroups class="w-7 h-7" />
          </span>
          <h2 id="groups-title" class="font-display text-headline-m">Planning a group outing?</h2>
          <p class="mt-2 mb-6 text-body-l max-w-xl mx-auto">
            Corporate events, fundraisers, and groups of 16+ receive customized pricing. Contact the Pro Shop for a quote.
          </p>
          <AppButton variant="filled" size="lg" to="/contact?subject=group" :icon="IconMail">Contact the Pro Shop</AppButton>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHero  from '@/components/layout/PageHero.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Card      from '@/components/ui/Card.vue'
import Skeleton  from '@/components/ui/Skeleton.vue'
import { rateIncludes, additionalFees, policies } from '@/data/rates'
import { phone } from '@/data/site.js'
import { DEFAULT_RATES, withDefaultRates } from '@/lib/rates'
import IconGolfCart from '~icons/deer/golf-cart'
import IconCalendar from '~icons/material-symbols/calendar-month-rounded'
import IconCheckSmall from '~icons/material-symbols/check-small-rounded'
import IconEventAvailable from '~icons/material-symbols/event-available-rounded'
import IconGroups from '~icons/material-symbols/groups-rounded'
import IconInfo from '~icons/material-symbols/info-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconSunny from '~icons/material-symbols/sunny-rounded'

const rates = ref({ ...DEFAULT_RATES })
const loading = ref(true)
const ratesFailed = ref(false)

const rateCards = computed(() => [
  {
    key: 'weekday', title: 'Weekday', days: 'Monday – Friday', icon: IconCalendar,
    prices: [{ label: '9 holes', cents: rates.value.WEEKDAY_9 }, { label: '18 holes', cents: rates.value.WEEKDAY_18 }],
  },
  {
    key: 'weekend', title: 'Weekend & holiday', days: 'Saturday, Sunday & holidays', icon: IconSunny,
    prices: [{ label: '9 holes', cents: rates.value.WEEKEND_9 }, { label: '18 holes', cents: rates.value.WEEKEND_18 }],
  },
])

function dollars(cents) {
  return cents % 100 ? `$${(cents / 100).toFixed(2)}` : `$${cents / 100}`
}

// The standard rates show (with a note) if the live ones can't be loaded
onMounted(async () => {
  try {
    const res = await fetch('/api/rates')
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.rates) throw new Error(`HTTP ${res.status}`)
    rates.value = withDefaultRates(data.rates)
  } catch {
    ratesFailed.value = true
  } finally {
    loading.value = false
  }
})
</script>
