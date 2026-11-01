<template>
  <span
    :class="['inline-block flex-none rounded-full ring-1 ring-on-surface/20 [print-color-adjust:exact]', tee.swatchClass]"
    aria-hidden="true"
  />
</template>

<script setup>
// The colored tee marker dot for a tee set (data/teeSets.js). Decorative: always say the tee's name next to it.
// Size it with classes, e.g. <TeeSwatch :tee="teeSets[0]" class="w-3 h-3" />.
defineProps({
  tee: { type: Object, required: true },
})
</script>
