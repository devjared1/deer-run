<template>
  <!-- The featured tier ("Best Value") gets a gold outline, a raised elevation (one level, no hover stacking) and the
       gold call to action; the others are flat outlined cards. -->
  <article
    :aria-labelledby="`tier-${slug}-title`"
    :class="[
      'relative flex flex-col h-full rounded-shape-lg overflow-hidden text-on-surface',
      tier.featured
        ? 'bg-surface-container-lowest border-2 border-gold shadow-elevation-3 lg:-mt-4 lg:mb-4'
        : 'bg-surface-container-low border border-outline-variant',
    ]"
  >
    <div :class="['flex items-center justify-between gap-3 px-6 py-3', BANDS[tier.tone] || BANDS.primary]">
      <span class="text-label-l uppercase tracking-[.15em]">{{ tier.badge }}</span>
      <IconPremium v-if="tier.featured" class="w-6 h-6 text-gold-container" aria-hidden="true" />
    </div>

    <div class="flex flex-col flex-1 p-6">
      <h3 :id="`tier-${slug}-title`" class="font-display text-headline-s text-on-surface">{{ tier.name }}</h3>
      <p class="mt-1 text-body-m text-on-surface-variant">{{ tier.subtitle }}</p>

      <p class="mt-5 flex items-baseline gap-1">
        <span class="font-display font-bold text-display-s text-on-surface">${{ tier.annual.toLocaleString('en-US') }}</span>
        <span class="text-body-l text-on-surface-variant">per year</span>
      </p>
      <p class="mt-1 text-body-m text-on-surface-variant">or ${{ tier.monthly }} per month</p>

      <ul class="mt-5 pt-5 border-t border-outline-variant space-y-2 flex-1" :aria-label="`${tier.name} benefits`">
        <li v-for="b in tier.benefits" :key="b" class="flex items-start gap-2 text-body-m text-on-surface">
          <IconCheck :class="['w-5 h-5 flex-shrink-0', CHECKS[tier.tone] || CHECKS.primary]" aria-hidden="true" />
          <span>{{ b }}</span>
        </li>
      </ul>

      <AppButton
        :variant="tier.featured ? 'gold' : 'outlined'"
        size="lg"
        block
        class="mt-6"
        :trailing-icon="IconArrowForward"
        @click="$emit('inquire', tier.name)"
      >
        Inquire about {{ tier.name }}
      </AppButton>
    </div>
  </article>
</template>

<script setup>
// One membership tier (src/data/membershipTiers.js): band in the tier's color role, price, benefits and an
// Inquire button that emits `inquire` with the tier name (the page preselects it in the form and moves focus there).
import { computed } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconCheck from '~icons/material-symbols/check-rounded'
import IconPremium from '~icons/material-symbols/workspace-premium-rounded'

const props = defineProps({
  tier: { type: Object, required: true },
})
defineEmits(['inquire'])

const slug = computed(() => props.tier.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))

const BANDS = {
  primary:   'bg-primary text-on-primary',
  secondary: 'bg-secondary text-on-secondary',
  tertiary:  'bg-tertiary text-on-tertiary',
}
const CHECKS = {
  primary:   'text-primary',
  secondary: 'text-secondary',
  tertiary:  'text-tertiary',
}
</script>
