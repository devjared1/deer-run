<template>
  <div class="space-y-4 font-body">
    <div>
      <TextField
        v-model="form.cartText"
        label="Cart numbers"
        type="text"
        maxlength="60"
        inputmode="numeric"
        autocomplete="off"
        placeholder="e.g. 12, 14"
        :leading-icon="IconGolfCart"
        :helper="cartWarnings.length ? '' : 'Separate numbers with a comma or space'"
      />
      <p
        v-for="w in cartWarnings"
        :key="w"
        class="mt-1 flex items-start gap-2 text-body-m text-on-surface"
        role="status"
      >
        <IconWarning class="w-5 h-5 flex-none text-warning" aria-hidden="true" />
        <span>{{ w }}</span>
      </p>
    </div>

    <Switch
      v-model="form.ownCart"
      label="Own cart or walking"
      helper="Some or all of the group brought their own cart or are walking"
    />

    <div class="flex flex-wrap gap-x-6 gap-y-4">
      <div class="space-y-2">
        <p class="text-label-l text-on-surface-variant" aria-hidden="true">
          Starting hole
        </p>
        <SegmentedButton v-model="form.startHole" size="lg" label="Starting hole" :options="START_HOLE_OPTIONS" />
      </div>
      <div class="space-y-2">
        <p class="text-label-l text-on-surface-variant" aria-hidden="true">
          Playing
        </p>
        <SegmentedButton v-model="form.roundHoles" size="lg" label="Holes to play" :options="ROUND_HOLE_OPTIONS" />
      </div>
    </div>
  </div>
</template>

<script setup>
// Round setup at check-in (Tee Sheet) and on the On Course page: cart numbers, own cart / walking, starting hole and
// 9 or 18. v-model is a setupForm() object from ./roundSetup.js (mutated in place); cartsOut is a Map of cart number →
// group name (pace.js cartsInUse) for the "still out" warnings.
import { computed } from 'vue'
import TextField from '@/components/ui/TextField.vue'
import Switch from '@/components/ui/Switch.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import IconGolfCart from '~icons/deer/golf-cart'
import IconWarning from '~icons/material-symbols/warning-rounded'
import { cartList, START_HOLE_OPTIONS, ROUND_HOLE_OPTIONS } from './roundSetup'

const form = defineModel({ type: Object, required: true })
const props = defineProps({
  cartsOut: { type: Map, default: () => new Map() },
})

const cartWarnings = computed(() => cartList(form.value.cartText)
  .filter(c => props.cartsOut.has(c))
  .map(c => `Cart ${c} is still out with ${props.cartsOut.get(c)}.`))
</script>
