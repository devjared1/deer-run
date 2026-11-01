<template>
  <div class="space-y-3 font-body">
    <div>
      <label class="label-sm">Cart numbers</label>
      <input
        v-model="form.cartText"
        type="text"
        maxlength="60"
        inputmode="numeric"
        class="input-field w-full"
        placeholder="e.g. 12, 14"
      >
      <p v-for="w in cartWarnings" :key="w" class="text-xs text-clay mt-1">
        {{ w }}
      </p>
    </div>
    <label class="flex items-center gap-2 text-sm text-bark cursor-pointer">
      <input v-model="form.ownCart" type="checkbox" class="rounded">
      Brought their own cart, or walking (some or all of the group)
    </label>
    <div class="flex flex-wrap gap-4">
      <div>
        <label class="label-sm">Starting hole</label>
        <div class="toggle">
          <button
            v-for="h in [1, 10]"
            :key="h"
            type="button"
            :class="form.startHole === h ? 'on' : ''"
            @click="form.startHole = h"
          >
            {{ h }}
          </button>
        </div>
      </div>
      <div>
        <label class="label-sm">Playing</label>
        <div class="toggle">
          <button
            v-for="n in [18, 9]"
            :key="n"
            type="button"
            :class="form.roundHoles === n ? 'on' : ''"
            @click="form.roundHoles = n"
          >
            {{ n }} holes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { cartList } from './roundSetup'

// form: setupForm() from ./roundSetup.js; cartsOut: Map of cart number → group name (pace.js cartsInUse)
const form = defineModel({ type: Object, required: true })
const props = defineProps({
  cartsOut: { type: Map, default: () => new Map() },
})

const cartWarnings = computed(() => cartList(form.value.cartText)
  .filter(c => props.cartsOut.has(c))
  .map(c => `Cart ${c} is still out with ${props.cartsOut.get(c)}.`))
</script>

<style scoped>
.input-field { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm    { @apply block text-xs text-gray-500 mb-1 font-body; }
.toggle      { @apply flex rounded-lg border border-gray-300 overflow-hidden w-fit; }
.toggle button    { @apply px-3 py-2 text-sm text-gray-600 hover:bg-gray-50; }
.toggle button.on { @apply bg-pine text-parch hover:bg-pine; }
</style>
