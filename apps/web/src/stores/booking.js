import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { DEFAULT_RATES, bookingPrice } from '@/lib/rates'

export const useBookingStore = defineStore('booking', () => {
  const authStore = useAuthStore()
  const selectedDate  = ref(null)
  const selectedSlot  = ref(null)
  const players       = ref(2)
  const guestName     = ref('')
  const guestEmail    = ref('')
  const roundHoles    = ref(18)
  const cart          = ref(true)

  // Greens fee + cart rates from GET /api/rates (defaults until loaded). Display only: the server prices the booking.
  const rates        = ref({ ...DEFAULT_RATES })
  const holidayDates = ref([])
  let ratesLoaded = null
  function loadRates() {
    ratesLoaded ??= fetch('/api/rates')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('rates'))))
      .then((data) => { rates.value = { ...rates.value, ...data.rates }; holidayDates.value = data.holidayDates ?? [] })
      .catch(() => { ratesLoaded = null })
    return ratesLoaded
  }

  // { greensKey, greensCents, cartCents, perPlayerCents, totalCents } for the current selection
  const price = computed(() => bookingPrice({
    rates: rates.value, holidayDates: holidayDates.value, ymd: selectedDate.value ?? '2000-01-03',
    holes: roundHoles.value, players: players.value, cart: cart.value,
  }))
  const totalPrice = computed(() => price.value.totalCents / 100)

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
      selectedSlot.value?.id, Number(players.value), roundHoles.value, cart.value, authStore.profile?.id ?? null,
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
        roundHoles: roundHoles.value,
        cart: cart.value,
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
    roundHoles.value = 18
    cart.value = true
  }

  return {
    selectedDate, selectedSlot, players, guestName, guestEmail, roundHoles, cart,
    rates, holidayDates, loadRates, price, totalPrice, fetchAvailableSlots, createBooking, reset,
  }
})
