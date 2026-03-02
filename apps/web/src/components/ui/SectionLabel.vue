<template>
  <div :class="['section-label', dark ? 'section-label-dark' : '', center ? 'justify-center' : 'justify-start']">
    {{ text }}
  </div>
</template>

<script setup>
defineProps({
  text:   { type: String, required: true },
  dark:   { type: Boolean, default: false },
  center: { type: Boolean, default: false },
})
</script>
