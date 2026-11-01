<template>
  <AppDialog :open="true" :title="product.name" size="lg" @update:open="v => !v && emit('close')">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
      <button
        v-for="(v, i) in product.variants"
        :key="v.id"
        type="button"
        :data-autofocus="i === 0 ? '' : undefined"
        class="state-layer flex flex-col min-h-24 p-3 rounded-shape-md border border-outline-variant bg-surface-container-lowest text-left cursor-pointer select-none"
        @click="emit('pick', v)"
      >
        <span class="text-title-s text-on-surface">{{ [v.size, v.color].filter(Boolean).join(' / ') || 'Standard' }}</span>
        <span class="mt-auto pt-2 text-body-l text-on-surface tabular-nums">{{ formatCents(unitPriceCents(product, v, isMember)) }}</span>
        <span v-if="product.trackInventory" :class="['text-label-m', v.stockQty > 0 ? 'text-on-surface-variant' : 'text-error']">
          {{ v.stockQty > 0 ? `${v.stockQty} in stock` : 'Out of stock' }}
        </span>
      </button>
    </div>
    <template #actions="{ close }">
      <AppButton variant="text" @click="close">Cancel</AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Pick a size/color of a product with more than one variant (register). Mounted with v-if; Esc, a backdrop tap or
// Cancel emit close. Emits pick(variant).
import { formatCents } from '@/lib/money'
import { unitPriceCents } from '@/lib/pricing'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'

defineProps({
  product: { type: Object, required: true },
  isMember: { type: Boolean, default: false },
})
const emit = defineEmits(['pick', 'close'])
</script>
