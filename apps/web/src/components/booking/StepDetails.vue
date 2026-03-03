<template>
  <div class="card rounded-lg p-6">
    <div class="flex items-center gap-3 mb-1">
      <button @click="$emit('back')" style="color:rgba(61,43,26,.4);font-size:20px;cursor:pointer;background:none;border:none;">←</button>
      <h2 style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#1E3D2F;">Your Details</h2>
    </div>
    <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-bottom:24px;">
      {{ formattedDate }} · {{ formattedTime }} · {{ store.players }} player{{ store.players > 1 ? 's' : '' }}
    </p>

    <!-- Member / Guest toggle -->
    <div class="flex gap-2 mb-6">
      <button
        @click="mode = 'guest'"
        :class="['px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-sm transition-all', mode !== 'guest' ? 'btn-outline-pine' : '']"
        :style="mode === 'guest' ? 'background:#1E3D2F;color:#F2EBD9;font-family:Lato,sans-serif;border:none;cursor:pointer;' : ''"
      >
        Continue as Guest
      </button>
      <button
        @click="mode = 'member'"
        :class="['px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-sm transition-all', mode !== 'member' ? 'btn-outline-pine' : '']"
        :style="mode === 'member' ? 'background:#C4873A;color:#0D1F16;font-family:Lato,sans-serif;border:none;cursor:pointer;' : ''"
      >
        Member / Sign In
      </button>
    </div>

    <!-- Guest form -->
    <div v-if="mode === 'guest'" class="space-y-4 mb-6">
      <div>
        <label class="field-label">Full Name</label>
        <input v-model="store.guestName" type="text" placeholder="John Smith" class="field rounded-sm" />
      </div>
      <div>
        <label class="field-label">Email (for confirmation)</label>
        <input v-model="store.guestEmail" type="email" placeholder="john@example.com" class="field rounded-sm" />
      </div>
    </div>

    <!-- Member info -->
    <div v-else class="mb-6">
      <div v-if="authStore.isLoggedIn" class="p-4 rounded" style="background:rgba(30,61,47,.06);">
        <div style="font-family:'Lato',sans-serif;font-size:13px;font-weight:700;color:#1E3D2F;">Signed in as member</div>
        <div style="font-family:'Lato',sans-serif;font-size:12px;color:rgba(61,43,26,.5);margin-top:2px;">{{ authStore.profile?.email }}</div>
      </div>
      <div v-else class="space-y-4">
        <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.55);">Sign in to access member rates and advance booking.</p>
        <RouterLink to="/login" class="btn-primary inline-flex">Sign In to My Account</RouterLink>
      </div>
    </div>

    <!-- Order summary -->
    <div class="p-4 rounded mb-6" style="background:rgba(196,135,58,.08);border:1px solid rgba(196,135,58,.2);">
      <div class="flex justify-between mb-2" style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.6);">
        <span>{{ store.players }} player{{ store.players > 1 ? 's' : '' }} × ${{ store.PRICE_PER_PLAYER }}</span>
        <span style="font-weight:700;color:#3D2B1A;">${{ store.totalPrice }}</span>
      </div>
      <div class="flex justify-between" style="font-family:'Lato',sans-serif;font-size:12px;color:rgba(61,43,26,.4);">
        <span>Cart fee included</span>
        <span>$0</span>
      </div>
    </div>

    <div v-if="error" class="mb-4 p-3 rounded text-sm" style="background:rgba(140,74,47,.1);color:#6B3820;font-family:'Lato',sans-serif;">
      {{ error }}
    </div>

    <button
      @click="proceed"
      class="btn-amber w-full justify-center"
    >
      Proceed to Payment →
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBookingStore } from '@/stores/booking'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['next', 'back'])
const store     = useBookingStore()
const authStore = useAuthStore()
const mode  = ref(authStore.isLoggedIn ? 'member' : 'guest')
const error = ref('')

const formattedDate = computed(() => {
  if (!store.selectedDate) return ''
  return new Date(store.selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
})

const formattedTime = computed(() => {
  if (!store.selectedSlot) return ''
  const [h, m] = store.selectedSlot.startTime.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
})

function proceed() {
  error.value = ''
  if (mode.value === 'guest') {
    if (!store.guestName || !store.guestEmail) {
      error.value = 'Please fill in your name and email.'
      return
    }
  }
  emit('next')
}
</script>
