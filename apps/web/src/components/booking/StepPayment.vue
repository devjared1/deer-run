<template>
  <div class="card rounded-lg p-6">
    <div class="flex items-center gap-3 mb-1">
      <button @click="$emit('back')" style="color:rgba(61,43,26,.4);font-size:20px;cursor:pointer;background:none;border:none;">←</button>
      <h2 style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#1E3D2F;">Payment</h2>
    </div>
    <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-bottom:24px;">
      Review your booking and pay securely via Stripe.
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

    <div v-if="error" class="mb-4 p-3 rounded text-sm" style="background:rgba(140,74,47,.1);color:#6B3820;font-family:'Lato',sans-serif;">
      {{ error }}
    </div>

    <button
      @click="pay"
      :disabled="loading"
      class="btn-amber w-full justify-center"
      :style="loading ? 'opacity:.6;cursor:not-allowed;' : ''"
    >
      <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      {{ loading ? 'Redirecting to checkout…' : `Pay $${store.totalPrice} Securely` }}
    </button>

    <p class="text-center mt-4 text-xs" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.35);">
      Powered by Stripe · Cancellations accepted 24 hours before tee time
    </p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBookingStore } from '@/stores/booking'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['back'])
const store     = useBookingStore()
const authStore = useAuthStore()
const loading   = ref(false)
const error     = ref('')

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

async function pay() {
  loading.value = true
  error.value   = ''
  try {
    const { checkoutUrl } = await store.createBooking()
    window.location.href = checkoutUrl
  } catch (e) {
    error.value = 'Unable to process booking. Please call (256) 974-7384.'
    loading.value = false
  }
}
</script>
