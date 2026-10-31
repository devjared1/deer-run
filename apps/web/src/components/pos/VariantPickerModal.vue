<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-box max-w-xl">
      <h2 class="font-display font-bold text-bark mb-4">{{ product.name }}</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          v-for="v in product.variants"
          :key="v.id"
          class="border border-gray-200 rounded-xl p-3 text-left hover:border-pine hover:bg-pine/5 transition-colors"
          @click="$emit('pick', v)"
        >
          <div class="font-body font-semibold text-bark text-sm">{{ [v.size, v.color].filter(Boolean).join(' / ') }}</div>
          <div class="font-body text-gray-600 text-sm tabular-nums">{{ formatCents(unitPriceCents(product, v, isMember)) }}</div>
          <div v-if="product.trackInventory" :class="['text-xs font-body', v.stockQty > 0 ? 'text-gray-400' : 'text-red-600']">
            {{ v.stockQty > 0 ? `${v.stockQty} in stock` : 'Out of stock' }}
          </div>
        </button>
      </div>
      <div class="flex justify-end mt-5">
        <button class="btn-outline-sm" @click="$emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatCents } from '@/lib/money'
import { unitPriceCents } from '@/lib/pricing'

defineProps({
  product: { type: Object, required: true },
  isMember: { type: Boolean, default: false },
})
defineEmits(['pick', 'close'])
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
