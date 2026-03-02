<template>
  <div class="hero-bg">
    <div class="relative z-10 max-w-7xl mx-auto px-5 py-14">
      <SectionLabel :text="label" dark class="mb-4" />
      <h1 class="fade-up" style="font-family:'Playfair Display',serif;font-size:clamp(36px,5vw,60px);font-weight:900;color:#F2EBD9;margin-bottom:12px;">
        <span v-html="titleHtml"></span>
      </h1>
      <p v-if="subtitle" style="font-family:'Lato',sans-serif;font-size:15px;color:rgba(242,235,217,.5);max-width:480px;line-height:1.7;">
        {{ subtitle }}
      </p>
      <slot />
    </div>
    <TreelineDivider :mt="subtitle || $slots.default ? 32 : 16" />
  </div>
</template>

<script setup>
import SectionLabel from '@/components/ui/SectionLabel.vue'
import TreelineDivider from '@/components/ui/TreelineDivider.vue'

defineProps({
  label:     { type: String, required: true },
  titleHtml: { type: String, required: true },
  subtitle:  { type: String, default: '' },
})
</script>
