<template>
  <div class="modal-overlay" @click.self="!busy && $emit('close')">
    <div class="modal-box">
      <h2 class="font-display font-bold text-bark mb-1">
        {{ title }}
      </h2>
      <p v-if="subtitle" class="text-gray-500 text-sm font-body mb-4">
        {{ subtitle }}
      </p>
      <div ref="mountPoint" class="min-h-[8rem]" />
      <p v-if="loadingForm" class="text-gray-400 text-sm font-body">
        Loading…
      </p>
      <p v-if="error" class="text-red-500 text-sm font-body mt-3">
        {{ error }}
      </p>
      <div class="flex justify-end gap-3 mt-5">
        <button class="btn-outline-sm" :disabled="busy" @click="$emit('close')">
          Cancel
        </button>
        <button class="btn-amber px-5 py-2 text-sm disabled:opacity-50" :disabled="busy || loadingForm" @click="submit">
          {{ busy ? 'Working…' : submitLabel }}
        </button>
      </div>
      <p class="text-xs text-gray-400 font-body mt-3 text-right">
        Secured by Stripe. Card details never touch our servers.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { loadStripe } from '@stripe/stripe-js'

// Stripe Payment Element for a PaymentIntent (mode 'payment') or a SetupIntent (mode 'setup', saving a card).
// Emits 'success' with { id } when it completes on the page; if the bank needs a redirect, Stripe returns to
// returnUrl with payment_intent / setup_intent in the query, and the page finishes from there.
const props = defineProps({
  mode:         { type: String, required: true }, // 'payment' | 'setup'
  clientSecret: { type: String, required: true },
  title:        { type: String, required: true },
  subtitle:     { type: String, default: '' },
  submitLabel:  { type: String, default: 'Pay' },
  returnUrl:    { type: String, required: true },
})
const emit = defineEmits(['success', 'close'])

const mountPoint  = ref(null)
const loadingForm = ref(true)
const busy        = ref(false)
const error       = ref(null)
let stripe = null
let elements = null

onMounted(async () => {
  try {
    stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
    elements = stripe.elements({
      clientSecret: props.clientSecret,
      appearance: {
        theme: 'stripe',
        variables: { colorPrimary: '#1E3D2F', colorText: '#3D2B1A', colorDanger: '#6B3820', fontFamily: 'Lato, sans-serif', borderRadius: '6px' },
      },
    })
    const element = elements.create('payment')
    element.mount(mountPoint.value)
    element.on('ready', () => { loadingForm.value = false })
  } catch {
    loadingForm.value = false
    error.value = 'The payment form couldn\'t load. Please try again or call (256) 974-7384.'
  }
})

async function submit() {
  if (!stripe || !elements) return
  busy.value  = true
  error.value = null
  const confirm = props.mode === 'setup' ? stripe.confirmSetup : stripe.confirmPayment
  const result = await confirm.call(stripe, { elements, confirmParams: { return_url: props.returnUrl }, redirect: 'if_required' })
  if (result.error) {
    error.value = result.error.message || 'That didn\'t go through. Please try again.'
    busy.value = false
    return
  }
  const intent = props.mode === 'setup' ? result.setupIntent : result.paymentIntent
  emit('success', { id: intent.id, status: intent.status })
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40; }
</style>
