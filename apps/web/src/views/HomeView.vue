<template>
  <div class="page-enter bg-surface-container">
    <HomeHero />

    <!-- Intro + three photo-led cards -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20" aria-labelledby="intro-title">
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div class="max-w-2xl">
          <p class="text-label-l uppercase tracking-[.2em] text-gold-text">The course</p>
          <h2 id="intro-title" class="mt-2 font-display text-headline-m md:text-headline-l text-on-surface">
            Rolling Lawrence County <em class="italic">terrain</em>
          </h2>
          <p class="mt-4 text-body-l text-on-surface-variant">
            Sculpted into the rolling terrain of Lawrence County, Deer Run rewards thoughtful play with dramatic
            elevation changes, water carries, and bent-grass greens.
          </p>
        </div>
        <dl class="grid grid-cols-4 gap-4 sm:gap-8 border-t border-outline-variant pt-6 lg:border-0 lg:pt-0">
          <div v-for="s in stats" :key="s.label" class="flex flex-col-reverse">
            <dt class="text-label-m uppercase tracking-[.15em] text-on-surface-variant mt-1">{{ s.label }}</dt>
            <dd class="font-display text-headline-m sm:text-display-s text-primary">{{ s.val }}</dd>
          </div>
        </dl>
      </div>

      <ul class="mt-10 md:mt-12 grid gap-6 md:grid-cols-3">
        <li v-for="c in cards" :key="c.to">
          <Card :to="c.to" padding="lg" class="h-full group">
            <template #media>
              <div class="relative aspect-[3/2] overflow-hidden">
                <ResponsivePicture
                  :name="c.photo"
                  sizes="(min-width: 1280px) 400px, (min-width: 768px) 33vw, 100vw"
                  alt=""
                  img-class="absolute inset-0 w-full h-full object-cover transition-transform duration-long-2 ease-standard group-hover:scale-105"
                />
              </div>
            </template>
            <p class="text-label-m uppercase tracking-[.15em] text-gold-text">{{ c.label }}</p>
            <h3 class="mt-1 font-display text-headline-s text-on-surface">{{ c.title }}</h3>
            <p v-if="c.price" class="mt-2 text-title-m text-primary">{{ c.price }}</p>
            <p class="mt-2 text-body-m text-on-surface-variant">{{ c.body }}</p>
            <span class="mt-4 inline-flex items-center gap-1 text-label-l text-primary">
              {{ c.cta }}
              <IconArrowForward class="w-[18px] h-[18px] transition-transform duration-short-4 group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Card>
        </li>
      </ul>
    </section>

    <PlanVisit />

    <UpcomingEvents />

    <!-- Membership teaser -->
    <section class="on-dark relative isolate overflow-hidden bg-pine-deep text-on-primary" aria-labelledby="membership-title">
      <ResponsivePicture
        name="course-5-wide"
        sizes="100vw"
        alt=""
        img-class="absolute inset-0 -z-10 w-full h-full object-cover"
      />
      <div class="absolute inset-0 -z-10 bg-gradient-to-r from-pine-deep/95 via-pine-deep/85 to-pine-deep/40" aria-hidden="true" />
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
        <div class="max-w-xl">
          <p class="text-label-l uppercase tracking-[.2em] text-gold-container">Membership</p>
          <h2 id="membership-title" class="mt-2 font-display text-headline-l md:text-display-s text-on-primary">
            Make Deer Run <em class="italic">your</em> course
          </h2>
          <p class="mt-4 text-title-m font-normal text-on-primary">
            Individual, Premier and Family memberships from <strong class="font-bold">${{ membershipFrom }}/month</strong>.
          </p>
          <ul class="mt-6 space-y-3">
            <li v-for="b in membershipPerks" :key="b" class="flex items-start gap-3 text-body-l text-on-primary">
              <IconCheckCircle class="w-6 h-6 flex-shrink-0 text-gold-container" aria-hidden="true" />
              {{ b }}
            </li>
          </ul>
          <AppButton to="/memberships" variant="gold" size="lg" :trailing-icon="IconArrowForward" class="mt-8">
            Explore memberships
          </AppButton>
        </div>
      </div>
    </section>

    <CourseGallery />
  </div>
</template>

<script setup>
import CourseGallery from '@/components/home/CourseGallery.vue'
import HomeHero from '@/components/home/HomeHero.vue'
import PlanVisit from '@/components/home/PlanVisit.vue'
import UpcomingEvents from '@/components/home/UpcomingEvents.vue'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import ResponsivePicture from '@/components/ui/ResponsivePicture.vue'
import { membershipTiers } from '@/data/membershipTiers'
import { useBookingStore } from '@/stores/booking'
import { computed, onMounted } from 'vue'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded'

const stats = [
  { val: '18', label: 'Holes' },
  { val: '72', label: 'Par' },
  { val: '6,745', label: 'Yards' },
  { val: '1980', label: 'Est.' },
]

// "From $X" uses the weekday 9-hole greens fee from GET /api/rates (the booking store's copy, DEFAULT_RATES until
// it loads or if it fails)
const booking = useBookingStore()
onMounted(() => booking.loadRates())
const fromPrice = computed(() => {
  const cents = booking.rates.WEEKDAY_9
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
})

const cards = computed(() => [
  {
    to: '/scorecard',
    photo: 'course-4',
    label: 'The Course',
    title: '18 holes of Earl Stone design',
    body: 'Elevation changes, water carries and bent-grass greens. See every hole, tee and yardage.',
    cta: 'View the scorecard',
  },
  {
    to: '/rates',
    photo: 'course-2-wide',
    label: 'Tee Times & Rates',
    title: 'Book online, day or night',
    price: `Greens fees from ${fromPrice.value} per player`,
    body: 'Weekday and weekend rates for 9 or 18 holes, riding or walking.',
    cta: 'See rates',
  },
  {
    to: '/tournaments',
    photo: 'course-3',
    label: 'Events',
    title: 'Tournaments all year',
    body: 'Our tournament calendar gives every golfer something to look forward to.',
    cta: 'See the schedule',
  },
])

// Membership teaser, from src/data/membershipTiers.js
const membershipFrom = Math.min(...membershipTiers.map(t => t.monthly))
const discounts = membershipTiers.map(t => t.proShopDiscountBps / 100)
const minDiscount = Math.min(...discounts)
const maxDiscount = Math.max(...discounts)
const membershipPerks = [
  'Unlimited rounds',
  '14-day advance tee time booking',
  `${minDiscount === maxDiscount ? minDiscount : `${minDiscount}–${maxDiscount}`}% Pro Shop discount`,
]
</script>
