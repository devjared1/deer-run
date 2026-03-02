<template>
  <div :class="['card rounded-lg overflow-hidden price-card', tier.featured ? 'price-featured' : '']">
    <div class="p-1" :style="`background:${tier.color}`">
      <div class="flex items-center justify-between px-5 py-3">
        <span style="font-family:'Lato',sans-serif;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.85);">{{ tier.badge }}</span>
        <svg v-if="tier.featured" class="w-4 h-4" style="color:rgba(255,255,255,.7)" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      </div>
    </div>
    <div class="p-7">
      <h3 style="font-family:'Playfair Display',serif;font-weight:700;font-size:22px;color:#1E3D2F;margin-bottom:4px;">{{ tier.name }}</h3>
      <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-bottom:18px;">{{ tier.subtitle }}</p>
      <div class="flex items-end gap-1 mb-1">
        <span style="font-family:'Playfair Display',serif;font-size:42px;font-weight:900;color:#1E3D2F;line-height:1;">${{ tier.annual }}</span>
      </div>
      <div style="font-family:'Lato',sans-serif;font-size:12px;color:rgba(61,43,26,.4);margin-bottom:20px;">per year · or ${{ tier.monthly }}/mo</div>
      <div class="divider mb-5"></div>
      <ul class="space-y-2.5 mb-7">
        <li v-for="b in tier.benefits" :key="b" class="flex items-start gap-2.5 text-sm" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.65);line-height:1.5;">
          <svg class="w-4 h-4 flex-shrink-0 mt-0.5" :style="`color:${tier.color}`" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7"/>
          </svg>
          {{ b }}
        </li>
      </ul>
      <button
        @click="$emit('inquire', tier.name)"
        class="w-full flex items-center justify-center gap-2 py-3 font-bold uppercase tracking-wider text-sm border-none cursor-pointer"
        :style="`background:${tier.color};color:#F2EBD9;font-family:'Lato',sans-serif;letter-spacing:.07em;`"
      >
        Inquire Now
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tier: { type: Object, required: true },
})
defineEmits(['inquire'])
</script>
