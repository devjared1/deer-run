<template>
  <div class="page-enter">
    <section class="hero-bg py-24">
      <div class="relative z-10 max-w-2xl mx-auto px-5 text-center">

        <div v-if="loading" style="font-family:'Lato',sans-serif;color:rgba(242,235,217,.5);">
          Loading confirmation…
        </div>

        <div v-else-if="booking">
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
import { ref, computed, onMounted } from 'vue'
import { useRoute }        from 'vue-router'
import { useBookingStore } from '@/stores/booking'
import SectionLabel        from '@/components/ui/SectionLabel.vue'

const route        = useRoute()
const bookingStore = useBookingStore()

const booking = ref(null)
const loading = ref(true)

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

onMounted(async () => {
  const sessionId = route.query.session_id
  if (!sessionId) { loading.value = false; return }
  try {
    const res = await fetch(`/api/bookings/by-session/${sessionId}`)
    if (res.ok) {
      booking.value = await res.json()
      bookingStore.reset()
    }
  } finally {
    loading.value = false
  }
})
</script>
