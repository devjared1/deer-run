<template>
  <div
    class="hero-bg"
    :class="classes"
    :style="[bgImage
      ? { backgroundImage: `linear-gradient(165deg, rgba(13,31,22,.84) 0%, rgba(20,42,32,.76) 28%, rgba(30,61,47,.62) 58%, rgba(15,32,25,.86) 100%), url('${bgImage}')`, backgroundSize: 'auto, cover', backgroundPosition: 'center, center' }
      : {}, { minHeight: `min(${height}, 85vh)` }]"
  >
    <div class="relative z-10 w-full max-w-7xl mx-auto px-5 py-14">
      <SectionLabel
        :text="label"
        dark
        class="mb-1"
      />
      <div style="font-family:'Playfair Display',serif;color:#F2EBD9;">
        <h1
          v-dompurify-html="titleHtml"
          style="font-size:clamp(44px,5vw,72px);font-weight: 700;margin-top: -20px"
        />
        <BrandLogo v-if="logo" :size="logoSize" eager alt="" class="mb-2" />
        <h3
          v-if="subtitle"
          class="fade-up"
          style="font-size:clamp(20px,3vh,44px);font-weight:900;"
        >
          <span v-dompurify-html="subtitle" />
        </h3>
      </div>
      <p
        v-if="description"
        style="font-family:'Lato',sans-serif;font-size:15px;color:rgba(242,235,217,.5);max-width:480px;line-height:1.7;"
      >
        {{ description }}
      </p>
      <slot />
    </div>
    <!-- <TreelineDivider :mt="subtitle || $slots.default ? 32 : 16" /> -->
  </div>
</template>

<script setup>
import BrandLogo from '@/components/ui/BrandLogo.vue';
import SectionLabel from '@/components/ui/SectionLabel.vue';

defineProps({
  label:     { type: String, required: true },
  titleHtml: { type: String, required: true },
  subtitle:  { type: String, default: '' },
  description:  { type: String, default: '' },
  bgImage:   { type: String, default: '' },
  // A minimum: the hero grows when the text wraps on a phone instead of clipping it
  height:    { type: String, default: '250px' },
  classes:   { type: Array, default: () => ['flex', 'items-center'] },
  // The emblem under the title (the home page's brand moment)
  logo:      { type: Boolean, default: false },
  logoSize:  { type: Number, default: 200 },
})
</script>
