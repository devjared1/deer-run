<template>
  <div>
    <PageHero
      label="Join the club"
      title-html="Membership <em>Plans</em>"
      description="Unlimited rounds, a 14-day booking window and Pro Shop discounts. Choose the plan that fits your game."
      photo="course-4"
      height="420px"
    />

    <div class="bg-surface">
      <!-- Tier cards -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 pt-12 md:pt-20 pb-12 md:pb-16" aria-labelledby="plans-title">
        <h2 id="plans-title" class="sr-only">Membership plans</h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch max-w-md lg:max-w-none mx-auto">
          <MembershipTierCard
            v-for="tier in membershipTiers"
            :key="tier.name"
            :tier="tier"
            @inquire="openInquiry"
          />
        </div>
        <p class="mt-6 text-center text-body-m text-on-surface-variant">
          Questions about which plan fits? Call the Pro Shop at
          <a :href="`tel:${phone.tel}`" class="text-primary font-bold underline underline-offset-2">{{ phone.display }}</a>.
        </p>
      </section>

      <!-- Comparison -->
      <section class="bg-surface-container-low" aria-labelledby="compare-title">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          <p class="text-label-l uppercase tracking-[.2em] text-gold-text text-center mb-2">Side by side</p>
          <h2 id="compare-title" class="font-display text-headline-m md:text-headline-l text-on-surface text-center mb-8">Compare plans</h2>

          <!-- md and up: one table -->
          <div class="hidden md:block rounded-shape-md overflow-hidden border border-outline-variant bg-surface-container-lowest">
            <table class="w-full text-left">
              <caption class="sr-only">Benefits included with each membership plan</caption>
              <thead class="bg-primary text-on-primary">
                <tr>
                  <th scope="col" class="py-3 px-5 text-label-l uppercase tracking-wider">Benefit</th>
                  <th v-for="t in membershipTiers" :key="t.name" scope="col" class="py-3 px-4 text-center text-label-l uppercase tracking-wider">
                    {{ t.name }}
                    <span v-if="t.featured" class="block mt-0.5 text-label-s normal-case tracking-normal text-gold-container">{{ t.badge }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="perk in tierComparison" :key="perk.label" class="border-t border-outline-variant even:bg-surface-container-low">
                  <th scope="row" class="py-3 px-5 text-body-m font-normal text-on-surface">{{ perk.label }}</th>
                  <td
                    v-for="t in membershipTiers"
                    :key="t.name"
                    :class="['py-3 px-4 text-center', t.featured ? 'bg-gold-container/30' : '']"
                  >
                    <PerkValue :value="perk.values[t.name]" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Phones: one list per plan -->
          <div class="md:hidden space-y-4">
            <section
              v-for="t in membershipTiers"
              :key="t.name"
              :aria-labelledby="`compare-${t.name}`"
              :class="[
                'rounded-shape-md bg-surface-container-lowest overflow-hidden',
                t.featured ? 'border-2 border-gold' : 'border border-outline-variant',
              ]"
            >
              <h3 :id="`compare-${t.name}`" class="flex items-center justify-between gap-2 px-4 py-3 bg-primary text-on-primary text-title-m">
                {{ t.name }}
                <span v-if="t.featured" class="text-label-m text-gold-container">{{ t.badge }}</span>
              </h3>
              <ul>
                <li
                  v-for="perk in tierComparison"
                  :key="perk.label"
                  class="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-outline-variant first:border-t-0"
                >
                  <span class="text-body-m text-on-surface">{{ perk.label }}</span>
                  <PerkValue :value="perk.values[t.name]" />
                </li>
              </ul>
            </section>
          </div>
        </div>
      </section>

      <!-- Inquiry -->
      <section ref="inquirySection" class="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20 scroll-mt-24" aria-label="Membership inquiry form">
        <MembershipInquiryForm ref="inquiryForm" :pre-selected-tier="selectedTier" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { h, nextTick, ref } from 'vue'
import PageHero              from '@/components/layout/PageHero.vue'
import MembershipTierCard    from '@/components/membership/MembershipTierCard.vue'
import MembershipInquiryForm from '@/components/membership/MembershipInquiryForm.vue'
import { membershipTiers, tierComparison } from '@/data/membershipTiers'
import { phone } from '@/data/site.js'
import IconCheck from '~icons/material-symbols/check-rounded'
import IconRemove from '~icons/material-symbols/remove-rounded'

const selectedTier = ref('')
const inquirySection = ref(null)
const inquiryForm = ref(null)

// Inquire on a tier card: preselect the plan, bring the form into view and put focus in it
async function openInquiry(tierName) {
  selectedTier.value = tierName
  await nextTick()
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  inquirySection.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  // preventScroll so focusing doesn't cut the smooth scroll short
  const target = inquirySection.value?.querySelector('input, h2[tabindex="-1"]')
  if (target) target.focus({ preventScroll: true })
  else inquiryForm.value?.focus()
}

// A comparison cell: check / remove icons with screen reader text, or the amount
function PerkValue({ value }) {
  if (value === true) {
    return h('span', { class: 'inline-flex text-primary' }, [
      h(IconCheck, { class: 'w-6 h-6', 'aria-hidden': 'true' }),
      h('span', { class: 'sr-only' }, 'Included'),
    ])
  }
  if (value === false) {
    return h('span', { class: 'inline-flex text-on-surface-variant' }, [
      h(IconRemove, { class: 'w-6 h-6', 'aria-hidden': 'true' }),
      h('span', { class: 'sr-only' }, 'Not included'),
    ])
  }
  return h('span', { class: 'text-label-l text-on-surface whitespace-nowrap' }, value)
}
PerkValue.props = ['value']
</script>
