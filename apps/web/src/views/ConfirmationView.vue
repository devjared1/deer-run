<template>
  <div class="page-enter">
    <section class="hero-bg py-24">
      <div class="relative z-10 max-w-2xl mx-auto px-5 text-center">

        <div v-if="loading" style="font-family:'Lato',sans-serif;color:rgba(242,235,217,.5);">
          Loading confirmation…
        </div>

        <div v-else-if="state === 'failed'">
          <h1 style="font-family:'Playfair Display',serif;font-size:36px;font-weight:900;color:#F2EBD9;margin-bottom:10px;">Payment Didn't Go Through</h1>
          <p style="font-family:'Lato',sans-serif;color:rgba(242,235,217,.75);margin-bottom:20px;line-height:1.7;">
            Your card wasn't charged and the tee time wasn't booked. Please try again, or call
            <a href="tel:+12569747384" style="color:#F2EBD9;text-decoration:underline;">(256) 974-7384</a>.
          </p>
          <RouterLink to="/book" class="btn-amber">Try Again</RouterLink>
        </div>

        <div v-else-if="state === 'processing'" role="status">
          <SectionLabel text="Processing Payment" dark center class="mb-5" />
          <h1 style="font-family:'Playfair Display',serif;font-size:clamp(28px,5vw,44px);font-weight:900;color:#F2EBD9;margin-bottom:14px;">
            Almost there…
          </h1>
          <p style="font-family:'Lato',sans-serif;font-size:15px;color:rgba(242,235,217,.75);line-height:1.7;">
            <template v-if="!pollGaveUp">We're confirming your payment. This usually takes a few seconds.</template>
            <template v-else>
              Your payment is still processing. We'll email your confirmation as soon as it clears, and the booking will
              show in your account. Questions? Call <a href="tel:+12569747384" style="color:#F2EBD9;text-decoration:underline;">(256) 974-7384</a>.
            </template>
          </p>
        </div>

        <div v-else-if="state === 'cancelled'">
          <h1 style="font-family:'Playfair Display',serif;font-size:36px;font-weight:900;color:#F2EBD9;margin-bottom:10px;">Booking Not Active</h1>
          <p style="font-family:'Lato',sans-serif;color:rgba(242,235,217,.75);margin-bottom:20px;line-height:1.7;">
            This booking was cancelled or its hold expired before payment. If you were charged, call
            <a href="tel:+12569747384" style="color:#F2EBD9;text-decoration:underline;">(256) 974-7384</a>.
          </p>
          <RouterLink to="/book" class="btn-amber">Book a Tee Time</RouterLink>
        </div>

        <div v-else-if="state === 'confirmed'">
          <div class="text-5xl mb-5">⛳</div>
          <SectionLabel text="Booking Confirmed" dark center class="mb-5" />
          <h1 style="font-family:'Playfair Display',serif;font-size:clamp(30px,5vw,52px);font-weight:900;color:#F2EBD9;margin-bottom:14px;">
            You're on the <em>Course!</em>
          </h1>
          <p style="font-family:'Lato',sans-serif;font-size:15px;color:rgba(242,235,217,.5);margin-bottom:36px;line-height:1.7;">
            A confirmation has been sent to your email. See you on the fairway.
          </p>

          <div class="card rounded-lg p-8 text-left mb-8">
            <div style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(61,43,26,.4);margin-bottom:14px;">Booking Details</div>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);">Date</span>
                <strong style="font-family:'Lato',sans-serif;font-size:13px;color:#1E3D2F;">{{ formattedDate }}</strong>
              </div>
              <div class="flex justify-between">
                <span style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);">Tee Time</span>
                <strong style="font-family:'Lato',sans-serif;font-size:13px;color:#1E3D2F;">{{ formattedTime }}</strong>
              </div>
              <div class="flex justify-between">
                <span style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);">Players</span>
                <strong style="font-family:'Lato',sans-serif;font-size:13px;color:#1E3D2F;">{{ booking.players }}</strong>
              </div>
              <div class="divider"></div>
              <div class="flex justify-between">
                <span style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);">Total Paid</span>
                <strong style="font-family:'Playfair Display',serif;font-size:20px;font-weight:900;color:#1E3D2F;">${{ (booking.totalCents / 100).toFixed(0) }}</strong>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <RouterLink to="/" class="btn-outline">Return Home</RouterLink>
            <RouterLink to="/book" class="btn-amber">Book Another Round</RouterLink>
          </div>
        </div>

        <div v-else>
          <h1 style="font-family:'Playfair Display',serif;font-size:36px;font-weight:900;color:#F2EBD9;margin-bottom:10px;">Booking Not Found</h1>
          <p style="font-family:'Lato',sans-serif;color:rgba(242,235,217,.5);margin-bottom:20px;line-height:1.7;">
            If you completed payment, your booking will be confirmed shortly. Check your email for a receipt.
          </p>
          <RouterLink to="/" class="btn-outline">Return Home</RouterLink>
        </div>

      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute }        from 'vue-router'
import { useBookingStore } from '@/stores/booking'
import SectionLabel        from '@/components/ui/SectionLabel.vue'

const route        = useRoute()
const bookingStore = useBookingStore()

const POLL_MS = 2000
const POLL_LIMIT = 30 // ~1 minute, then tell the customer the email will follow

const booking = ref(null)
const loading = ref(true)
const pollGaveUp = ref(false)
let pollTimer = null

// confirmed | processing (PENDING while the Stripe webhook catches up) | failed | cancelled | missing
const state = computed(() => {
  if (route.query.redirect_status === 'failed') return 'failed'
  const status = booking.value?.status
  if (!status) return 'missing'
  if (status === 'CONFIRMED') return 'confirmed'
  if (status === 'PENDING') return 'processing'
  return 'cancelled'
})

const formattedDate = computed(() => {
  if (!booking.value?.teeTimeSlot?.date) return ''
  return new Date(booking.value.teeTimeSlot.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
})

const formattedTime = computed(() => {
  if (!booking.value?.teeTimeSlot?.startTime) return ''
  const [h, m] = booking.value.teeTimeSlot.startTime.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
})

async function load() {
  const res = await fetch(`/api/bookings/${route.query.booking_id}`)
  if (res.ok) booking.value = await res.json()
  if (booking.value?.status === 'CONFIRMED') bookingStore.reset()
}

function poll(attempt = 1) {
  pollTimer = setTimeout(async () => {
    try { await load() } catch { /* keep polling */ }
    if (state.value !== 'processing') return
    if (attempt >= POLL_LIMIT) pollGaveUp.value = true
    else poll(attempt + 1)
  }, POLL_MS)
}

onMounted(async () => {
  if (!route.query.booking_id || route.query.redirect_status === 'failed') { loading.value = false; return }
  try {
    await load()
  } catch { /* shown as not found */ } finally {
    loading.value = false
  }
  if (state.value === 'processing') poll()
})

onBeforeUnmount(() => clearTimeout(pollTimer))
</script>
