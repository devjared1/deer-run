<template>
  <section class="flex-1 flex flex-col items-center justify-center text-center pb-10" role="status" aria-live="assertive">
    <span :class="['flex items-center justify-center w-28 h-28 rounded-full', BADGE[done.icon]]">
      <component :is="ICONS[done.icon]" class="w-16 h-16" aria-hidden="true" />
    </span>
    <h2 class="mt-6 font-display text-display-s text-on-surface">{{ done.title }}</h2>
    <p class="mt-3 text-headline-s text-on-surface-variant max-w-xl">{{ done.message }}</p>
    <AppButton size="xl" class="mt-10 min-w-[16rem]" :icon="IconDone" @click="emit('close')">
      Done
    </AppButton>
    <p class="mt-4 text-body-l text-on-surface-variant">Back to the names in {{ secondsLeft }} s</p>
  </section>
</template>

<script setup>
// Time clock kiosk, step 4: what was just recorded, big enough to read from a step back. Goes back to the names by
// itself (the page counts down secondsLeft) or on Done.
import AppButton from '@/components/ui/AppButton.vue'
import IconDone from '~icons/material-symbols/done-rounded'
import IconLogin from '~icons/material-symbols/login-rounded'
import IconLogout from '~icons/material-symbols/logout-rounded'
import IconCoffee from '~icons/material-symbols/coffee-rounded'

defineProps({
  // { title, message, icon: in | out | break } from doneMessage()
  done:        { type: Object, required: true },
  secondsLeft: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const ICONS = { in: IconLogin, out: IconLogout, break: IconCoffee }
const BADGE = {
  in: 'bg-success-container text-on-success-container',
  out: 'bg-secondary-container text-on-secondary-container',
  break: 'bg-warning-container text-on-warning-container',
}
</script>
