<template>
  <div class="modal-overlay" @click.self="!busy && $emit('cancel')">
    <div class="modal-box max-w-lg max-h-[92vh] overflow-y-auto">
      <h2 class="font-display font-bold text-bark mb-1">{{ isVoid ? 'Void' : 'Refund' }} Sale #{{ sale.number }}</h2>
      <p class="text-gray-500 text-sm font-body mb-4">
        <template v-if="isVoid">Cancels the whole sale and returns tracked items to stock.</template>
        <template v-else>Choose what's being returned.</template>
      </p>

      <table class="w-full text-sm font-body mb-3">
        <tbody class="divide-y divide-gray-50">
          <tr v-for="(row, i) in rows" :key="row.item.id">
            <td class="py-2 pr-3 text-bark">
              {{ row.item.description }}
              <div class="text-xs text-gray-400">
                {{ row.item.quantity }} sold<template v-if="row.item.refundedQuantity"> · {{ row.item.refundedQuantity }} already refunded</template>
              </div>
            </td>
            <td class="py-2 pr-3 w-32">
              <div v-if="!isVoid && row.remaining > 0" class="flex items-center gap-1">
                <button class="qty-btn" :disabled="row.quantity === 0" @click="row.quantity--">−</button>
                <span class="w-6 text-center tabular-nums">{{ row.quantity }}</span>
                <button class="qty-btn" :disabled="row.quantity >= row.remaining" @click="row.quantity++">+</button>
                <button class="text-xs text-lake ml-1" @click="row.quantity = row.remaining">All</button>
              </div>
              <span v-else-if="isVoid" class="text-gray-500 tabular-nums">× {{ row.remaining }}</span>
              <span v-else class="text-xs text-gray-400">Fully refunded</span>
            </td>
            <td class="py-2 text-right tabular-nums w-20">{{ row.quantity ? formatCents(previews[i].amountCents) : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="space-y-3 border-t border-gray-100 pt-3">
        <label v-if="!isVoid" class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
          <input v-model="restock" type="checkbox" class="rounded" /> Return items to stock
          <span class="text-gray-400 text-xs">(uncheck for damaged items)</span>
        </label>
        <div>
          <label class="label-sm">Reason *</label>
          <input v-model="reason" type="text" maxlength="200" class="input-field w-full" :placeholder="isVoid ? 'Rang up the wrong item' : 'Wrong size'" />
        </div>
      </div>

      <!-- Where the money goes: back to the card it was paid with, or cash -->
      <div v-if="cardAvailable > 0" class="mt-4">
        <div class="label-sm">Refund to</div>
        <div class="flex rounded-lg border border-gray-300 overflow-hidden w-fit">
          <button
            type="button"
            :class="['px-3 py-2 text-sm font-body', method === 'CARD_TERMINAL' ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
            @click="method = 'CARD_TERMINAL'"
          >
            The card (up to {{ formatCents(cardAvailable) }})
          </button>
          <button
            v-if="cashAvailable > 0"
            type="button"
            :class="['px-3 py-2 text-sm font-body', method === 'CASH' ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
            @click="method = 'CASH'"
          >
            Cash (up to {{ formatCents(cashAvailable) }})
          </button>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 font-body">
        <span class="text-gray-600 text-sm">{{ method === 'CARD_TERMINAL' ? 'Back to the card' : 'Cash to give back' }}</span>
        <span class="font-display font-bold text-bark text-2xl tabular-nums">{{ formatCents(totalCents) }}</span>
      </div>

      <div class="flex justify-end gap-3 mt-5">
        <button class="btn-outline-sm" :disabled="busy" @click="$emit('cancel')">Cancel</button>
        <button
          :disabled="busy || !canSubmit"
          :class="['px-4 py-2 text-sm rounded-lg font-body font-semibold disabled:opacity-50', isVoid ? 'bg-red-500 hover:bg-red-600 text-white' : 'btn-amber']"
          @click="submit"
        >
          {{ busy ? 'Working…' : isVoid ? 'Void Sale' : 'Refund' }}
        </button>
      </div>
      <p v-if="overLimit" class="text-clay text-xs font-body mt-2 text-right">
        Only {{ formatCents(limit) }} can go back {{ method === 'CARD_TERMINAL' ? 'to the card' : 'in cash' }}. Refund fewer items this way.
      </p>
      <p class="text-gray-400 text-xs font-body mt-2 text-right">A manager approves before anything is refunded.</p>
      <p v-if="error" class="text-red-500 text-sm mt-2 font-body">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatCents } from '@/lib/money'
import { refundForLine } from '@/lib/pricing'

const props = defineProps({
  sale: { type: Object, required: true },
  mode: { type: String, required: true }, // 'void' | 'refund'
  busy: { type: Boolean, default: false },
  error: { type: String, default: null },
})
const emit = defineEmits(['submit', 'cancel'])

const isVoid = computed(() => props.mode === 'void')

const rows = ref(props.sale.items.map(item => ({
  item,
  remaining: item.quantity - item.refundedQuantity,
  quantity: props.mode === 'void' ? item.quantity - item.refundedQuantity : 0,
})))
// Preview per row, worked out the same way as the database
const previews = computed(() => rows.value.map(r => (r.quantity ? refundForLine(r.item, r.quantity) : { amountCents: 0, taxCents: 0 })))

const restock = ref(true)
const reason  = ref('')

const totalCents = computed(() => previews.value.reduce((sum, p) => sum + p.amountCents, 0))
// Money goes back the way it was paid: what's left of the card payment, and of the cash
const sumBy = (list, method) => list.filter(x => x.method === method).reduce((sum, x) => sum + x.amountCents, 0)
const cardAvailable = computed(() => Math.max(0, sumBy(props.sale.payments, 'CARD_TERMINAL') - sumBy(props.sale.refunds ?? [], 'CARD_TERMINAL')))
const cashAvailable = computed(() => Math.max(0, sumBy(props.sale.payments, 'CASH') - sumBy(props.sale.refunds ?? [], 'CASH')))
const method = ref(cardAvailable.value > 0 ? 'CARD_TERMINAL' : 'CASH')
const limit = computed(() => (method.value === 'CARD_TERMINAL' ? cardAvailable.value : cashAvailable.value))
const overLimit = computed(() => totalCents.value > limit.value)

const canSubmit = computed(() => reason.value.trim() && rows.value.some(r => r.quantity > 0) && !overLimit.value)

function submit() {
  emit('submit', {
    items: rows.value.filter(r => r.quantity > 0).map(r => ({ saleItemId: r.item.id, quantity: r.quantity })),
    restock: restock.value,
    reason: reason.value.trim(),
    totalCents: totalCents.value,
    method: method.value,
  })
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.qty-btn        { @apply w-7 h-7 rounded-lg border border-gray-300 text-bark leading-none hover:bg-gray-50 disabled:opacity-40; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
