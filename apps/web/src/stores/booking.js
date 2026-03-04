import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useBookingStore = defineStore('booking', () => {
  const authStore = useAuthStore()
  const selectedDate  = ref(null)
  const selectedSlot  = ref(null)
  const players       = ref(2)
  const guestName     = ref('')
  const guestEmail    = ref('')

  const PRICE_PER_PLAYER = 45
  const totalPrice = computed(() => players.value * PRICE_PER_PLAYER)

  async function fetchAvailableSlots(date) {
    const token = authStore.getToken()
    const res = await fetch(`/api/teetimes?date=${date}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('Failed to fetch slots')
    return res.json()
  }

  async function createBooking() {
    const token = authStore.getToken()
    const res = await fetch(`/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        teeTimeSlotId: selectedSlot.value.id,
        players: players.value,
        guestName:  authStore.isLoggedIn ? null : guestName.value,
        guestEmail: authStore.isLoggedIn ? null : guestEmail.value,
      }),
    })
    if (!res.ok) throw new Error('Booking failed')
    return res.json() // { bookingId, clientSecret }
  }

  function reset() {
    selectedDate.value = null
    selectedSlot.value = null
    players.value = 2
    guestName.value = ''
    guestEmail.value = ''
  }

  return {
    selectedDate, selectedSlot, players, guestName, guestEmail,
    PRICE_PER_PLAYER, totalPrice, fetchAvailableSlots, createBooking, reset,
  }
})
