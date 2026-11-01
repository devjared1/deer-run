<template>
  <section class="rounded-shape-md bg-surface-container-low shadow-elevation-1 px-4 sm:px-6 pt-3 sm:pt-4 pb-6" aria-labelledby="step-payment-title">
    <div class="flex items-center gap-1 -ml-3">
      <IconButton :icon="IconArrowBack" label="Back to your details" :disabled="processing" @click="emit('back')" />
      <h2
        id="step-payment-title"
        data-step-heading
        tabindex="-1"
        class="font-display text-headline-s text-on-surface scroll-mt-24 focus:outline-none focus-visible:outline-none"
      >
        Payment
      </h2>
    </div>
    <p class="text-body-m text-on-surface-variant mt-1 mb-5">Review your booking and pay securely.</p>

    <!-- Summary -->
    <dl class="rounded-shape-md bg-surface-container-lowest border border-outline-variant p-4 space-y-2 text-body-m mb-6">
      <div v-for="row in summaryRows" :key="row.label" class="flex justify-between gap-4">
        <dt class="text-on-surface-variant">{{ row.label }}</dt>
        <dd class="text-on-surface text-right break-words min-w-0">{{ row.value }}</dd>
      </div>
      <div class="flex justify-between items-baseline gap-4 pt-3 mt-1 border-t border-outline-variant">
        <dt class="text-title-m text-on-surface">Total</dt>
        <dd class="font-display text-headline-s text-on-surface tabular-nums">{{ formatCents(totalCents) }}</dd>
      </div>
      <p v-if="priceChanged" class="flex items-start gap-2 text-body-s text-on-surface-variant pt-1">
        <IconInfo class="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        The total was updated to {{ formatCents(serverTotal) }} when your booking was placed (shown earlier as
        {{ formatCents(store.price.totalCents) }}). This is the amount charged.
      </p>
    </dl>

    <!-- Preparing the payment form -->
    <div v-if="loadingForm && !initError" role="status" class="flex items-center justify-center gap-3 py-8 text-body-m text-on-surface-variant">
      <ProgressIndicator :size="24" label="Preparing the payment form" />
      Preparing secure payment form…
    </div>

    <ErrorBanner v-if="initError" :message="initError" />

    <!-- Stripe Payment Element -->
    <div v-show="!loadingForm && !initError">
      <div id="payment-element" ref="paymentElementRef" class="mb-5 min-h-12" />

      <ErrorBanner v-if="error" class="mb-4" :message="error" />

      <AppButton variant="gold" size="lg" block :loading="processing" :icon="IconLock" @click="pay">
        {{ processing ? 'Processing payment…' : `Pay ${formatCents(totalCents)}` }}
      </AppButton>
    </div>

    <div class="mt-5 space-y-2 text-body-s text-on-surface-variant">
      <p class="flex items-start gap-2">
        <IconLock class="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        Payments are processed securely by Stripe; the course never sees your card number.
      </p>
      <p class="flex items-start gap-2">
        <IconEventBusy class="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>{{ CANCEL_POLICY }} By paying you agree to the course's <RouterLink to="/rates" class="text-primary underline">policies</RouterLink>.</span>
      </p>
    </div>
  </section>
</template>

<script setup>
// Booking step 4: creates (or reuses) the PENDING booking + PaymentIntent, shows the server's total, mounts the
// Stripe Payment Element (styled from the design tokens) and confirms the payment on the page.
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import { phone } from '@/data/site'
import { formatCents } from '@/lib/money'
import { teeTime } from '@/lib/teesheet'
import { formatLocalDate } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'
// '/pure': Stripe.js loads when loadStripe() is called, not as soon as the Book page's chunk does
import { loadStripe } from '@stripe/stripe-js/pure'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconInfo from '~icons/material-symbols/info-rounded'
import IconLock from '~icons/material-symbols/lock-rounded'
import { CANCEL_POLICY, plural } from './bookingFlow'

const emit = defineEmits(['back'])
const store = useBookingStore()
const auth = useAuthStore()
const router = useRouter()

const paymentElementRef = ref(null)
const loadingForm = ref(true)
const processing = ref(false)
const error = ref('')
const initError = ref('')
const serverTotal = ref(null) // the PaymentIntent's amount, from POST /api/bookings

let stripe = null
let elements = null
let bookingId = null

// The server's amount once it's known; the same calculation in the browser until then
const totalCents = computed(() => serverTotal.value ?? store.price.totalCents)
const priceChanged = computed(() => serverTotal.value !== null && serverTotal.value !== store.price.totalCents)

const summaryRows = computed(() => [
  { label: 'Date', value: store.selectedDate ? formatLocalDate(store.selectedDate, { weekday: 'long', month: 'long', day: 'numeric' }) : '' },
  { label: 'Tee time', value: store.selectedSlot ? teeTime(store.selectedSlot.startTime) : '' },
  { label: 'Players', value: plural(store.players, 'player') },
  { label: 'Round', value: `${store.roundHoles} holes, ${store.cart ? 'riding' : 'walking'}` },
  { label: 'Name', value: auth.isLoggedIn ? auth.profile?.name || auth.profile?.email || 'Your account' : store.guestName },
])

// Stripe appearance from the design tokens (RGB-channel CSS variables, read at runtime)
function token(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--md-sys-color-${name}`).trim()
  const ch = raw.split(/[\s,]+/).map(Number)
  return ch.length === 3 && ch.every(Number.isFinite) ? `rgb(${ch.join(', ')})` : undefined
}
function appearance() {
  const outline = token('outline')
  const primary = token('primary')
  return {
    theme: 'stripe',
    variables: {
      colorPrimary: primary,
      colorBackground: token('surface-container-lowest'),
      colorText: token('on-surface'),
      colorTextSecondary: token('on-surface-variant'),
      colorDanger: token('error'),
      fontFamily: 'Lato, system-ui, sans-serif',
      fontSizeBase: '16px',
      borderRadius: '4px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': { border: `1px solid ${outline}`, boxShadow: 'none', padding: '14px 16px' },
      '.Input:focus': { border: `2px solid ${primary}`, boxShadow: 'none' },
      '.Label': { fontWeight: '700' },
      '.Tab--selected': { borderColor: primary },
    },
  }
}
// Lato for the Stripe iframe: the self-hosted file the page preloads (Stripe falls back to system-ui if it can't load it)
function stripeFonts() {
  if (window.location.protocol !== 'https:') return [] // Stripe only loads fonts over https
  const link = document.querySelector('link[rel="preload"][as="font"][href*="lato" i]')
  return link ? [{ family: 'Lato', src: `url(${new URL(link.getAttribute('href'), window.location.href).href})`, weight: '400' }] : []
}

onMounted(async () => {
  try {
    // Create (or reuse) the booking + PaymentIntent
    const result = await store.createBooking()
    bookingId = result.bookingId
    if (Number.isInteger(result.totalCents)) serverTotal.value = result.totalCents

    stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
    if (!stripe) throw new Error('Stripe did not load')
    elements = stripe.elements({ clientSecret: result.clientSecret, appearance: appearance(), fonts: stripeFonts() })

    const paymentElement = elements.create('payment', { layout: 'tabs' })
    paymentElement.mount(paymentElementRef.value)
    paymentElement.on('ready', () => { loadingForm.value = false })
    paymentElement.on('loaderror', (e) => {
      console.error('Stripe Payment Element failed to load:', e?.error?.message)
      loadingForm.value = false
      initError.value = `The payment form couldn't load. Refresh the page to try again, or call ${phone.display}.`
    })
  } catch (e) {
    loadingForm.value = false
    // API refusals (slot just filled, members only…) carry a message worth showing; anything else is generic
    initError.value = e.status && e.status < 500
      ? `${e.message}. Go back to choose another time, or call ${phone.display}.`
      : `Unable to load the payment form. Please call ${phone.display}.`
  }
})

async function pay() {
  if (!stripe || !elements || processing.value) return
  processing.value = true
  error.value = ''

  const returnUrl = `${window.location.origin}/confirmation?booking_id=${bookingId}`
  const { error: stripeError } = await stripe.confirmPayment({
    elements,
    confirmParams: { return_url: returnUrl },
    redirect: 'if_required',
  })

  if (stripeError) {
    error.value = stripeError.message || 'Payment failed. Please try again.'
    processing.value = false
  } else {
    // Paid without a redirect (a standard card)
    router.push(`/confirmation?booking_id=${bookingId}`)
  }
}
</script>
