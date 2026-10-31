<template>
  <div class="modal-overlay" @click.self="!busy && $emit('close')">
    <div class="modal-box max-w-md">
      <div class="text-center mb-5">
        <div class="text-gray-400 text-xs font-body uppercase tracking-wider">Total Due</div>
        <div class="font-display font-bold text-bark text-4xl tabular-nums">{{ formatCents(totalCents) }}</div>
      </div>

      <template v-if="totalCents > 0">
        <!-- Method -->
        <div class="grid grid-cols-3 gap-2 mb-4">
          <button class="method-btn border-pine bg-pine text-parch">Cash</button>
          <button class="method-btn border-gray-200 text-gray-400 cursor-not-allowed" disabled title="Card reader setup comes in a later phase">Card</button>
          <button class="method-btn border-gray-200 text-gray-400 cursor-not-allowed" disabled title="House accounts come in a later phase">Account</button>
        </div>

        <label class="label-sm">Cash Received ($)</label>
        <input
          ref="tenderInput"
          v-model="tendered"
          type="number"
          min="0"
          step="0.01"
          class="input-field w-full text-lg tabular-nums"
          @keyup.enter="canComplete && complete()"
        />
        <div class="flex flex-wrap gap-2 mt-2">
          <button v-for="q in quickAmounts" :key="q" class="quick-btn" @click="tendered = (q / 100).toFixed(2)">
            {{ q === totalCents ? 'Exact' : formatCents(q) }}
          </button>
        </div>
        <div class="mt-3 text-center font-body">
          <span v-if="tenderedCents >= totalCents" class="text-pine text-lg">
            Change: <strong class="tabular-nums">{{ formatCents(tenderedCents - totalCents) }}</strong>
          </span>
          <span v-else-if="tendered !== ''" class="text-clay text-sm">
            {{ formatCents(totalCents - tenderedCents) }} short
          </span>
        </div>
      </template>
      <p v-else class="text-center text-gray-500 text-sm font-body mb-2">No payment needed.</p>

      <!-- Receipt -->
      <div class="border-t border-gray-100 mt-4 pt-4 space-y-2">
        <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
          <input v-model="print" type="checkbox" class="rounded" /> Print receipt
        </label>
        <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
          <input v-model="sendEmail" type="checkbox" class="rounded" /> Email receipt
        </label>
        <input
          v-if="sendEmail"
          v-model="email"
          type="email"
          class="input-field w-full"
          placeholder="customer@example.com"
        />
      </div>

      <div class="flex justify-end gap-3 mt-5">
        <button class="btn-outline-sm" :disabled="busy" @click="$emit('close')">Back</button>
        <button :disabled="!canComplete || busy" class="btn-amber px-5 py-2 text-sm disabled:opacity-50" @click="complete">
          {{ busy ? 'Completing…' : 'Complete Sale' }}
        </button>
      </div>
      <p v-if="error" class="text-red-500 text-sm mt-3 font-body">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatCents, dollarsToCents } from '@/lib/money'

const props = defineProps({
  totalCents: { type: Number, required: true },
  defaultEmail: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  error: { type: String, default: null },
})
const emit = defineEmits(['complete', 'close'])

const tendered    = ref('')
const print       = ref(true)
const sendEmail   = ref(false)
const email       = ref(props.defaultEmail)
const tenderInput = ref(null)

const tenderedCents = computed(() => dollarsToCents(tendered.value) || 0)

// Exact, then the next round amounts customers usually hand over
const quickAmounts = computed(() => {
  const t = props.totalCents
  const amounts = [t]
  for (const step of [500, 1000, 2000, 5000, 10000]) {
    const next = Math.ceil(t / step) * step
    if (next > t && !amounts.includes(next)) amounts.push(next)
  }
  return amounts.slice(0, 5)
})

const canComplete = computed(() => {
  if (sendEmail.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return false
  return props.totalCents === 0 || tenderedCents.value >= props.totalCents
})

function complete() {
  emit('complete', {
    payments: props.totalCents > 0 ? [{ method: 'CASH', tenderedCents: tenderedCents.value }] : [],
    print: print.value,
    receiptEmail: sendEmail.value ? email.value.trim() : null,
  })
}

onMounted(() => tenderInput.value?.focus())
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.method-btn     { @apply border rounded-lg py-2 text-sm font-body font-semibold; }
.quick-btn      { @apply border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-body text-bark hover:bg-gray-50 tabular-nums; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
