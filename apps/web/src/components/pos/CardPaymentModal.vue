<template>
  <div class="modal-overlay">
    <div class="modal-box max-w-sm text-center">
      <div class="text-gray-400 text-xs font-body uppercase tracking-wider">
        Card payment
      </div>
      <div class="font-display font-bold text-bark text-4xl tabular-nums mt-1">
        {{ formatCents(checkout.amountCents) }}
      </div>
      <div v-if="cashCents" class="text-xs text-gray-400 font-body mt-1">
        plus {{ formatCents(cashCents) }} cash
      </div>
      <div v-if="checkout.tipping" class="text-xs text-gray-400 font-body mt-1">
        The customer can add a tip on the reader
      </div>

      <!-- Charged, sale not saved (rare): let the cashier retry saving -->
      <template v-if="checkout.status === 'SUCCEEDED'">
        <p class="text-clay text-sm font-body mt-5">
          {{ checkout.lastError || 'The card was charged. Saving the sale…' }}
        </p>
        <button class="btn-amber w-full py-3 text-base mt-4 disabled:opacity-50" :disabled="busy" @click="act('complete')">
          {{ busy ? 'Saving…' : 'Save' }}
        </button>
      </template>

      <template v-else-if="checkout.status === 'PENDING' || checkout.status === 'COMPLETING'">
        <div v-if="!checkout.lastError" class="mt-6 mb-2">
          <div class="mx-auto w-10 h-10 border-4 border-pine/20 border-t-pine rounded-full animate-spin" />
          <p class="text-bark font-body mt-4">
            {{ checkout.status === 'COMPLETING' ? 'Payment approved. Saving the sale…' : 'Tap, insert or swipe the card on the reader' }}
          </p>
        </div>
        <div v-else class="mt-5">
          <p class="text-red-600 font-body font-semibold">
            {{ checkout.lastError }}
          </p>
          <p class="text-gray-500 text-xs font-body mt-1">
            Try the card again, use another card, or cancel and take cash.
          </p>
          <button class="btn-amber w-full py-3 text-base mt-4 disabled:opacity-50" :disabled="busy" @click="act('retry')">
            Try again
          </button>
        </div>

        <div v-if="checkout.testMode" class="mt-4 border-t border-dashed border-gray-200 pt-3">
          <div class="text-[11px] uppercase tracking-wider text-gray-400 font-body mb-2">
            Test mode (simulated reader)
          </div>
          <div class="flex flex-wrap gap-2 justify-center">
            <button class="btn-outline-xs" :disabled="busy" @click="act('simulate')">
              Simulate card
            </button>
            <button v-if="checkout.tipping" class="btn-outline-xs" :disabled="busy" @click="act('simulate', { tipCents: 500 })">
              Card + $5 tip
            </button>
            <button class="btn-outline-xs" :disabled="busy" @click="act('simulate', { decline: true })">
              Simulate decline
            </button>
          </div>
        </div>

        <button class="btn-outline-sm w-full mt-4" :disabled="busy || checkout.status === 'COMPLETING'" @click="act('cancel')">
          Cancel card payment
        </button>
      </template>

      <template v-else-if="checkout.status === 'CANCELED'">
        <p class="text-gray-500 text-sm font-body mt-5">
          The card payment was cancelled. Nothing was charged.
        </p>
        <button class="btn-amber w-full py-3 text-base mt-4" @click="$emit('canceled')">
          Back to the sale
        </button>
      </template>

      <p v-if="error" class="text-red-500 text-xs font-body mt-3">
        {{ error }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'

const props = defineProps({
  initial:   { type: Object, required: true }, // { id, status, amountCents, lastError, tipping, testMode }
  cashCents: { type: Number, default: 0 },
})
const emit = defineEmits(['done', 'canceled'])

const POLL_MS = 2000

const checkout = ref({ ...props.initial })
const busy     = ref(false)
const error    = ref(null)
let timer = null
let polling = false

// Shared by polling and the buttons: anything that returns the checkout (and the sale once it's saved)
function apply(result) {
  if (result.cardCheckout) checkout.value = { ...checkout.value, ...result.cardCheckout }
  if (checkout.value.status === 'COMPLETED' && (result.sale || result.accountPayment)) {
    stop()
    emit('done', {
      sale: result.sale ?? null, accountPayment: result.accountPayment ?? null,
      warnings: result.warnings ?? [], emailError: result.emailError ?? null, notice: result.notice,
    })
  }
}

async function poll() {
  if (polling || busy.value) return
  polling = true
  try {
    apply(await apiFetch(`/api/staff/card-checkouts/${checkout.value.id}`))
    error.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    polling = false
  }
}

async function act(action, extra = {}) {
  busy.value  = true
  error.value = null
  try {
    apply(await apiFetch(`/api/staff/card-checkouts/${checkout.value.id}`, { method: 'POST', body: { action, ...extra } }))
  } catch (e) {
    error.value = e.message
    poll()
  } finally {
    busy.value = false
  }
}

function stop() {
  clearInterval(timer)
  timer = null
}

onMounted(() => { timer = setInterval(poll, POLL_MS) })
onUnmounted(stop)
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40; }
.btn-outline-xs { @apply border border-gray-300 text-gray-600 text-xs px-3 py-1.5 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40; }
@media print { .modal-overlay { display: none !important; } }
</style>
