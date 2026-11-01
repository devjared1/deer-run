import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { DEFAULT_RATES, bookingPrice, payAtCourseSplit } from '@/lib/rates'

// Guest details checks, shared by the Details step (inline errors) and the wizard's step guard
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const useBookingStore = defineStore('booking', () => {
  const authStore = useAuthStore()
  const selectedDate  = ref(null)
  const selectedSlot  = ref(null)
  const players       = ref(2)
  const guestName     = ref('')
  const guestEmail    = ref('')
  const roundHoles    = ref(18)
  const cart          = ref(true)
  // 'morning' | 'midday' | 'afternoon' | null (any): the Time step's time-of-day filter, preset by the Home tee time
  // search (/book?time=)
  const timeOfDay     = ref(null)

  // Greens fee + cart rates from GET /api/rates (defaults until loaded). Display only: the server prices the booking.
  const rates        = ref({ ...DEFAULT_RATES })
  const holidayDates = ref([])
  // Pay at course: the hold fee per booking (0 = not offered; stays 0 until the rates load)
  const payAtCourseFeeCents = ref(0)
  let ratesLoaded = null
  function loadRates() {
    ratesLoaded ??= fetch('/api/rates')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('rates'))))
      .then((data) => {
        rates.value = { ...rates.value, ...data.rates }
        holidayDates.value = data.holidayDates ?? []
        payAtCourseFeeCents.value = data.payAtCourseFeeCents ?? 0
      })
      .catch(() => { ratesLoaded = null })
    return ratesLoaded
  }

  // { greensKey, greensCents, cartCents, perPlayerCents, totalCents } for the current selection
  const price = computed(() => bookingPrice({
    rates: rates.value, holidayDates: holidayDates.value, ymd: selectedDate.value ?? '2000-01-03',
    holes: roundHoles.value, players: players.value, cart: cart.value,
  }))
  const totalPrice = computed(() => price.value.totalCents / 100)

  // Pay now in full, or only the hold fee now and the rest at the course: { available, holdFeeCents, balanceCents }
  const payAtCourse = ref(false)
  const payAtCourseOption = computed(() => payAtCourseSplit(price.value.totalCents, payAtCourseFeeCents.value))
  // What the online payment charges for the current selection
  const chargeCents = computed(() => (payAtCourse.value && payAtCourseOption.value.available
    ? payAtCourseOption.value.holdFeeCents
    : price.value.totalCents))
  const usingPayAtCourse = computed(() => payAtCourse.value && payAtCourseOption.value.available)

  const authHeaders = () => {
    const token = authStore.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function fetchAvailableSlots(date) {
    const res = await fetch(`/api/teetimes?date=${date}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to fetch slots')
    return res.json()
  }

  // Per-day availability for the booking window (GET /api/teetimes?from=&to=): { 'YYYY-MM-DD': { open, spots } }.
  // A hint only: `availabilityReady` is false until it loads (or when it failed), and the steps then don't rely on it.
  // Kept for a minute so going back and forth between steps doesn't refetch it.
  const availability = ref({})
  const availabilityReady = ref(false)
  let availabilityReq = null
  async function loadAvailability(from, to) {
    const key = `${from}|${to}|${authStore.profile?.id ?? ''}`
    if (availabilityReq && availabilityReq.key === key && Date.now() - availabilityReq.at < 60_000) return availabilityReq.promise
    const promise = fetch(`/api/teetimes?from=${from}&to=${to}`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('availability'))))
      .then((days) => {
        if (!Array.isArray(days)) throw new Error('availability')
        availability.value = Object.fromEntries(days.map(d => [d.date, { open: d.open, spots: d.spots }]))
        availabilityReady.value = true
      })
      .catch(() => {
        availabilityReq = null
        availabilityReady.value = false
      })
    availabilityReq = { key, at: Date.now(), promise }
    return promise
  }

  // Guest name/email problems ('' when fine); signed-in golfers book under their account
  const guestErrors = computed(() => ({
    name: guestName.value.trim().length >= 2 ? '' : 'Enter your full name',
    email: !guestEmail.value.trim() ? 'Enter your email for the confirmation'
      : EMAIL_RE.test(guestEmail.value.trim()) ? '' : 'Enter an email like name@example.com',
  }))
  const detailsComplete = computed(() => authStore.isLoggedIn || (!guestErrors.value.name && !guestErrors.value.email))

  // The PENDING booking + PaymentIntent made for the current selection. Going Back and then on to Payment again
  // reuses it instead of placing a second 30-minute hold. Reused only well inside the hold.
  const REUSE_MS = 25 * 60 * 1000
  let pending = null

  function selectionKey() {
    return JSON.stringify([
      selectedSlot.value?.id, Number(players.value), roundHoles.value, cart.value, usingPayAtCourse.value,
      authStore.profile?.id ?? null,
      authStore.isLoggedIn ? null : guestName.value.trim(), authStore.isLoggedIn ? null : guestEmail.value.trim(),
    ])
  }

  // → { bookingId, clientSecret, totalCents?, chargeCents?, holdFeeCents?, balanceDueCents?, players?, roundHoles?, cart? }
  //   (chargeCents = the PaymentIntent's amount: the total, or the hold fee when paying at the course)
  async function createBooking() {
    const key = selectionKey()
    if (pending && pending.key === key && Date.now() - pending.createdAt < REUSE_MS) return pending.result

    const res = await fetch(`/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        teeTimeSlotId: selectedSlot.value.id,
        players: players.value,
        roundHoles: roundHoles.value,
        cart: cart.value,
        payAtCourse: usingPayAtCourse.value,
        guestName: authStore.isLoggedIn ? null : guestName.value.trim(),
        guestEmail: authStore.isLoggedIn ? null : guestEmail.value.trim(),
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err = new Error(data.error || 'Booking failed')
      err.status = res.status
      throw err
    }
    const result = await res.json()
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
    payAtCourse.value = false
    timeOfDay.value = null
  }

  return {
    selectedDate, selectedSlot, players, guestName, guestEmail, roundHoles, cart, timeOfDay,
    rates, holidayDates, loadRates, price, totalPrice, fetchAvailableSlots,
    payAtCourse, payAtCourseFeeCents, payAtCourseOption, usingPayAtCourse, chargeCents,
    availability, availabilityReady, loadAvailability, guestErrors, detailsComplete,
    createBooking, reset,
  }
})
