<template>
  <AppDialog v-model:open="open" :title="title" persistent size="md" @after-leave="emit('close')">
    <p v-if="subtitle" class="text-body-m text-on-surface-variant mb-4">
      {{ subtitle }}
    </p>
    <div class="relative min-h-[8rem]">
      <div ref="mountPoint" />
      <div v-if="loadingForm" class="absolute inset-0 flex items-center justify-center gap-3 text-on-surface-variant">
        <ProgressIndicator :size="24" label="Loading the payment form" />
        <span class="text-body-m">Loading the secure form…</span>
      </div>
    </div>
    <ErrorBanner v-if="error" :message="error" class="mt-4" />
    <p class="flex items-center gap-1.5 text-body-s text-on-surface-variant mt-4">
      <IconLock class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      Secured by Stripe. Card details never touch our servers.
    </p>

    <template #actions>
      <AppButton variant="text" :disabled="busy" @click="close">Cancel</AppButton>
      <AppButton variant="gold" :loading="busy" :disabled="loadingForm || !elements" :icon="IconLock" @click="submit">
        {{ submitLabel }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Stripe Payment Element for a PaymentIntent (mode 'payment') or a SetupIntent (mode 'setup', saving a card), in an
// AppDialog (persistent: only Cancel closes it, and not while a payment is being confirmed).
// Emits 'success' with { id, status } when it completes on the page, and 'close' once the dialog has closed after
// Cancel. If the bank needs a redirect, Stripe returns to returnUrl with payment_intent / setup_intent in the query,
// and the page finishes from there. Mount it with v-if and drop it on success or close.
import { ref, shallowRef, onMounted } from 'vue'
// '/pure': Stripe.js loads when the dialog calls loadStripe(), not as soon as the My Account chunk does
import { loadStripe } from '@stripe/stripe-js/pure'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import { phone } from '@/data/site'
import IconLock from '~icons/material-symbols/lock-rounded'

const props = defineProps({
  mode:         { type: String, required: true }, // 'payment' | 'setup'
  clientSecret: { type: String, required: true },
  title:        { type: String, required: true },
  subtitle:     { type: String, default: '' },
  submitLabel:  { type: String, default: 'Pay' },
  returnUrl:    { type: String, required: true },
})
const emit = defineEmits(['success', 'close'])

const open        = ref(true)
const mountPoint  = ref(null)
const loadingForm = ref(true)
const busy        = ref(false)
const error       = ref(null)
const elements    = shallowRef(null)
let stripe = null

// Stripe's appearance from the design tokens (CSS variables hold "r g b" channels)
function token(name) {
  const rgb = getComputedStyle(document.documentElement).getPropertyValue(`--md-sys-color-${name}`).trim().split(/[\s,]+/)
  return rgb.length === 3 ? `rgb(${rgb.join(', ')})` : undefined
}

function close() {
  if (!busy.value) open.value = false
}

onMounted(async () => {
  try {
    stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
    // The dialog's panel is in a portal, so wait until its mount point exists
    for (let i = 0; i < 10 && !mountPoint.value; i++) await new Promise(r => requestAnimationFrame(r))
    const els = stripe.elements({
      clientSecret: props.clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: token('primary'),
          colorText: token('on-surface'),
          colorTextSecondary: token('on-surface-variant'),
          colorDanger: token('error'),
          colorBackground: token('surface-container-lowest'),
          fontFamily: 'Lato, system-ui, sans-serif',
          borderRadius: '4px',
        },
      },
    })
    const element = els.create('payment')
    element.mount(mountPoint.value)
    element.on('ready', () => { loadingForm.value = false })
    element.on('loaderror', () => {
      loadingForm.value = false
      error.value = `The payment form couldn't load. Please try again or call ${phone.display}.`
    })
    elements.value = els
  } catch {
    loadingForm.value = false
    error.value = `The payment form couldn't load. Please try again or call ${phone.display}.`
  }
})

async function submit() {
  if (!stripe || !elements.value) return
  busy.value  = true
  error.value = null
  const confirm = props.mode === 'setup' ? stripe.confirmSetup : stripe.confirmPayment
  const result = await confirm.call(stripe, { elements: elements.value, confirmParams: { return_url: props.returnUrl }, redirect: 'if_required' })
  if (result.error) {
    error.value = result.error.message || 'That didn\'t go through. Please try again.'
    busy.value = false
    return
  }
  const intent = props.mode === 'setup' ? result.setupIntent : result.paymentIntent
  emit('success', { id: intent.id, status: intent.status })
}
</script>
