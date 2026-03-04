<template>
  <div class="card rounded-lg p-6">
    <div class="flex items-center gap-3 mb-1">
      <button @click="$emit('back')" :disabled="processing" style="color:rgba(61,43,26,.4);font-size:20px;cursor:pointer;background:none;border:none;">←</button>
      <h2 style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#1E3D2F;">Payment</h2>
    </div>
    <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-bottom:24px;">
      Review your booking and pay securely.
    </p>

    <!-- Final summary -->
    <div class="p-5 rounded mb-6" style="background:rgba(30,61,47,.06);border:1px solid rgba(30,61,47,.1);">
      <div style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(61,43,26,.5);margin-bottom:12px;">Booking Summary</div>
      <div class="space-y-2" style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.7);">
        <div class="flex justify-between"><span>Date</span><strong>{{ formattedDate }}</strong></div>
        <div class="flex justify-between"><span>Tee Time</span><strong>{{ formattedTime }}</strong></div>
        <div class="flex justify-between"><span>Players</span><strong>{{ store.players }}</strong></div>
        <div class="flex justify-between"><span>Name</span><strong>{{ playerName }}</strong></div>
      </div>
      <div class="divider my-3"></div>
      <div class="flex justify-between">
        <span style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.6);">Total</span>
        <span style="font-family:'Playfair Display',serif;font-size:24px;font-weight:900;color:#1E3D2F;">${{ store.totalPrice }}</span>
      </div>
    </div>

    <!-- Loading payment form -->
    <div v-if="loadingForm" class="flex items-center justify-center py-8 gap-3" style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.5);">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      Preparing secure payment form…
    </div>

    <!-- Stripe Payment Element mount point -->
    <div v-show="!loadingForm && clientSecret">
      <div ref="paymentElementRef" id="payment-element" class="mb-5" style="min-height:48px;"></div>

      <div v-if="error" class="mb-4 p-3 rounded text-sm" style="background:rgba(140,74,47,.1);color:#6B3820;font-family:'Lato',sans-serif;">
        {{ error }}
      </div>

      <button
        @click="pay"
        :disabled="processing"
        class="btn-amber w-full justify-center"
        :style="processing ? 'opacity:.6;cursor:not-allowed;' : ''"
      >
        <svg v-if="processing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        {{ processing ? 'Processing payment…' : `Pay $${store.totalPrice} Securely` }}
      </button>
    </div>

    <!-- Init error -->
    <div v-if="initError" class="p-3 rounded text-sm" style="background:rgba(140,74,47,.1);color:#6B3820;font-family:'Lato',sans-serif;">
      {{ initError }}
    </div>

    <p class="text-center mt-4 text-xs" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.35);">
      Secured by Stripe · Cancellations accepted 24 hours before tee time
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadStripe } from '@stripe/stripe-js'
import { useBookingStore } from '@/stores/booking'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['back'])
const store     = useBookingStore()
const authStore = useAuthStore()
const router    = useRouter()

const paymentElementRef = ref(null)
const loadingForm = ref(true)
const processing  = ref(false)
const error       = ref('')
const initError   = ref('')

let stripe   = null
let elements = null
let bookingId = null

const formattedDate = computed(() => {
  if (!store.selectedDate) return ''
  return new Date(store.selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})

const formattedTime = computed(() => {
  if (!store.selectedSlot) return ''
  const [h, m] = store.selectedSlot.startTime.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
})

const playerName = computed(() =>
  authStore.isLoggedIn ? authStore.profile?.name || 'Member' : store.guestName
)

onMounted(async () => {
  try {
    // Create booking + get PaymentIntent client secret
    const result = await store.createBooking()
    bookingId = result.bookingId

    // Load Stripe and mount the Payment Element
    stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
    elements = stripe.elements({
      clientSecret: result.clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#1E3D2F',
          colorBackground: '#ffffff',
          colorText: '#3D2B1A',
          colorDanger: '#6B3820',
          fontFamily: 'Lato, sans-serif',
          borderRadius: '6px',
        },
      },
    })

    const paymentElement = elements.create('payment')
    paymentElement.mount(paymentElementRef.value)
    paymentElement.on('ready', () => { loadingForm.value = false })
  } catch (e) {
    loadingForm.value = false
    initError.value = 'Unable to load payment form. Please call (256) 974-7384.'
  }
})

async function pay() {
  if (!stripe || !elements) return
  processing.value = true
  error.value = ''

  const origin = window.location.origin
  const returnUrl = `${origin}/confirmation?booking_id=${bookingId}`

  const { error: stripeError } = await stripe.confirmPayment({
    elements,
    confirmParams: { return_url: returnUrl },
    redirect: 'if_required',
  })

  if (stripeError) {
    error.value = stripeError.message || 'Payment failed. Please try again.'
    processing.value = false
  } else {
    // Payment succeeded without redirect (standard card)
    router.push(`/confirmation?booking_id=${bookingId}`)
  }
}
</script>
