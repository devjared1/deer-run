<template>
  <div class="modal-overlay" @click.self="!busy && $emit('cancel')">
    <div class="modal-box max-w-sm">
      <h2 class="font-display font-bold text-bark mb-1">{{ copy.title }}</h2>
      <p class="text-gray-500 text-sm font-body mb-4">{{ copy.help }}</p>

      <label class="label-sm">Amount ($)</label>
      <input
        ref="amountInput"
        v-model="amount"
        type="number"
        min="0.01"
        step="0.01"
        class="input-field w-full text-lg"
        @keyup.enter="submit"
      />
      <template v-if="type === 'PAID_OUT'">
        <label class="label-sm mt-3">What for *</label>
        <input v-model="reason" type="text" maxlength="300" class="input-field w-full" placeholder="e.g. Ice for the beverage cart" />
        <label class="label-sm mt-3">Paid to (optional)</label>
        <input v-model="recipient" type="text" maxlength="300" class="input-field w-full" placeholder="e.g. Ice delivery driver" />
      </template>
      <template v-else>
        <label class="label-sm mt-3">Note (optional)</label>
        <input v-model="reason" type="text" maxlength="300" class="input-field w-full" :placeholder="copy.placeholder" />
      </template>

      <p v-if="error" class="text-red-500 text-xs mt-2 font-body">{{ error }}</p>
      <div class="flex justify-end gap-3 mt-5">
        <button class="btn-outline-sm" :disabled="busy" @click="$emit('cancel')">Cancel</button>
        <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="busy || !canSubmit" @click="submit">
          {{ busy ? 'Working…' : copy.button }}
        </button>
      </div>
      <p class="text-gray-400 text-xs font-body mt-2 text-right">A manager approves, then the drawer opens and a slip prints.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { dollarsToCents } from '@/lib/money'

const props = defineProps({
  type: { type: String, required: true }, // 'PAID_IN' | 'PAID_OUT' | 'SAFE_DROP'
  busy: { type: Boolean, default: false },
  error: { type: String, default: null },
})
const emit = defineEmits(['submit', 'cancel'])

const COPY = {
  PAID_IN: {
    title: 'Paid In',
    help: 'Cash added to the drawer that isn\'t a sale, e.g. more change from the safe.',
    placeholder: 'e.g. Change from the safe',
    button: 'Record Paid In',
  },
  PAID_OUT: {
    title: 'Paid Out',
    help: 'Cash taken from the drawer to pay for something. Keep the receipt with the slip.',
    placeholder: '',
    button: 'Record Paid Out',
  },
  SAFE_DROP: {
    title: 'Safe Drop',
    help: 'Extra cash moved from the drawer to the safe.',
    placeholder: 'e.g. Bag #12',
    button: 'Record Safe Drop',
  },
}
const copy = computed(() => COPY[props.type])

const amount      = ref('')
const reason      = ref('')
const recipient   = ref('')
const amountInput = ref(null)

const cents = computed(() => dollarsToCents(amount.value))
const canSubmit = computed(() => Number.isInteger(cents.value) && cents.value > 0 && (props.type !== 'PAID_OUT' || reason.value.trim()))

function submit() {
  if (props.busy || !canSubmit.value) return
  emit('submit', { amountCents: cents.value, reason: reason.value.trim(), recipient: recipient.value.trim() })
}

onMounted(() => nextTick(() => amountInput.value?.focus()))
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
