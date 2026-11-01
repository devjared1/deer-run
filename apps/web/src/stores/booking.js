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

  // The PENDING booking + PaymentIntent made for the current selection. Going Back and then on to Payment again
  // reuses it instead of placing a second 30-minute hold. Reused only well inside the hold.
  const REUSE_MS = 25 * 60 * 1000
  let pending = null

  function selectionKey() {
    return JSON.stringify([
      selectedSlot.value?.id, Number(players.value), authStore.profile?.id ?? null,
      authStore.isLoggedIn ? null : guestName.value.trim(), authStore.isLoggedIn ? null : guestEmail.value.trim(),
    ])
  }

  async function createBooking() {
    const key = selectionKey()
    if (pending && pending.key === key && Date.now() - pending.createdAt < REUSE_MS) return pending.result

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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err = new Error(data.error || 'Booking failed')
      err.status = res.status
      throw err
    }
    const result = await res.json() // { bookingId, clientSecret }
    pending = { key, result, createdAt: Date.now() }
    return result
  }

  function reset() {
    pending = null
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
