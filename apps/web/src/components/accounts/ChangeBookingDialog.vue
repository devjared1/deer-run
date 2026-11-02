<template>
  <AppDialog
    v-model:open="open"
    title="Change tee time"
    :icon="IconEditCalendar"
    persistent
    fullscreen-on-mobile
    size="md"
    :confirm-label="submitLabel"
    :confirm-disabled="!canSubmit"
    :confirm-loading="submitting"
    @confirm="submit"
    @after-leave="onAfterLeave"
  >
    <p class="text-body-m text-on-surface-variant mb-5">
      Now: {{ currentLabel }}
    </p>

    <div class="space-y-5">
      <div>
        <p class="text-title-s text-on-surface mb-2" aria-hidden="true">Players</p>
        <SegmentedButton v-model="players" block label="Players" :options="PLAYER_OPTIONS" />
      </div>

      <div>
        <p class="text-title-s text-on-surface mb-2">Day</p>
        <DateStepper v-model="date" :min="today" :max="maxDate" />
      </div>

      <section aria-labelledby="change-times" :aria-busy="loadingSlots ? 'true' : undefined">
        <p id="change-times" class="text-title-s text-on-surface mb-2">Time</p>
        <Skeleton v-if="loadingSlots" variant="text" :lines="2" label="Loading tee times" />
        <ErrorBanner v-else-if="slotsError" :message="slotsError" @retry="loadSlots" />
        <p v-else-if="!timeOptions.length" class="text-body-m text-on-surface-variant">
          No times with room for {{ players }} on this day. Try another day.
        </p>
        <ChipGroup v-else v-model="slotId" type="choice" label="Tee time" :options="timeOptions" />
      </section>

      <!-- What the change costs -->
      <div v-if="slotId && !unchanged" aria-live="polite">
        <Skeleton v-if="quoting" variant="text" :lines="2" label="Working out the price" />
        <ErrorBanner v-else-if="quoteError" :message="quoteError" />
        <div v-else-if="quote" class="rounded-shape-md bg-surface-container-low border border-outline-variant p-4 space-y-1">
          <p class="text-title-m text-on-surface">{{ newLabel }}</p>
          <p class="text-body-m text-on-surface">{{ priceLine }}</p>
          <p v-if="moneyLine" class="text-body-m text-on-surface-variant">{{ moneyLine }}</p>
        </div>
      </div>

      <ErrorBanner v-if="submitError" :message="submitError" @dismiss="submitError = null" />
    </div>

    <template #actions="{ close }">
      <AppButton variant="text" :disabled="submitting" @click="close">Keep my booking</AppButton>
      <AppButton variant="gold" :disabled="!canSubmit" :loading="submitting" @click="submit">{{ submitLabel }}</AppButton>
    </template>
  </AppDialog>

  <StripeElementModal
    v-if="payment"
    mode="payment"
    :client-secret="payment.clientSecret"
    title="Pay the difference"
    :subtitle="`${newLabel}. The change is made as soon as the payment goes through.`"
    :submit-label="`Pay ${formatCents(payment.chargeCents)}`"
    :return-url="returnUrl"
    @success="onPaid"
    @close="onPaymentClosed"
  />
</template>

<script setup>
// My Account: a golfer moves their own tee time and/or changes the number of players (POST /api/bookings/:id/change).
// Pick players, a day (within the booking window) and a time with room; the server's preview shows the new price and
// what happens to the difference (paid now, back to the card, or on the balance due at the course). A higher price
// opens the Stripe payment form; closing it without paying cancels the change.
// Props: booking (from /api/bookings/my, with teeTimeSlot { date, startTime } and teeTimeSlotId).
// Emits: done({ booking?, message, tone? }) once the change is made, fails or is given up; close after the dialog
// has closed with nothing done.
import { computed, ref, watch, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { teeTime } from '@/lib/teesheet'
import { addDays, formatLocalDate, localDate, localDateTimeToUtc } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import DateStepper from '@/components/ui/DateStepper.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StripeElementModal from './StripeElementModal.vue'
import IconEditCalendar from '~icons/material-symbols/edit-calendar-rounded'

const props = defineProps({
  booking: { type: Object, required: true },
})
const emit = defineEmits(['done', 'close'])

const PLAYER_OPTIONS = [1, 2, 3, 4].map(n => ({ value: n, label: String(n) }))
const authStore = useAuthStore()

const today   = localDate()
const maxDate = addDays(today, authStore.maxBookDays)
const currentDate = String(props.booking.teeTimeSlot.date).slice(0, 10)

const open    = ref(true)
const players = ref(props.booking.players)
const date    = ref(currentDate < today ? today : currentDate)
const slotId  = ref(null)

const slots        = ref([])
const loadingSlots = ref(false)
const slotsError   = ref(null)

const quote      = ref(null)
const quoting    = ref(false)
const quoteError = ref(null)

const submitting  = ref(false)
const submitError = ref(null)
const payment     = ref(null) // { clientSecret, changeId, chargeCents } while the Stripe form is open
let finished = null             // what to emit once the dialog has closed

const when = (ymd, hhmm) => `${formatLocalDate(ymd, { weekday: 'short', month: 'short', day: 'numeric' })} at ${teeTime(hhmm)}`
const playerCount = n => `${n} player${n === 1 ? '' : 's'}`
const currentLabel = `${when(currentDate, props.booking.teeTimeSlot.startTime)} · ${playerCount(props.booking.players)}`

const selectedSlot = computed(() => slots.value.find(s => s.id === slotId.value) ?? null)
const unchanged = computed(() => slotId.value === props.booking.teeTimeSlotId && players.value === props.booking.players)
const newLabel = computed(() => (selectedSlot.value
  ? `${when(date.value, selectedSlot.value.startTime)} · ${playerCount(players.value)}`
  : ''))

// Times with room for the group: this booking's own spots count as free at its current time
const timeOptions = computed(() => {
  const now = Date.now()
  return slots.value
    .filter(s => localDateTimeToUtc(date.value, s.startTime).getTime() > now)
    .filter(s => s.available + (s.id === props.booking.teeTimeSlotId ? props.booking.players : 0) >= players.value)
    .map(s => ({ value: s.id, label: s.id === props.booking.teeTimeSlotId ? `${teeTime(s.startTime)} (now)` : teeTime(s.startTime) }))
})

const priceLine = computed(() => {
  const q = quote.value
  if (!q) return ''
  const diff = q.differenceCents
  if (!diff) return `Same price: ${formatCents(q.toTotalCents)}.`
  return `New price ${formatCents(q.toTotalCents)} (${formatCents(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}).`
})
const moneyLine = computed(() => {
  const q = quote.value
  if (!q) return ''
  if (q.payAtCourse) return `${formatCents(q.balanceDueCents)} due at the course when you check in. The hold fee you paid stays on the booking.`
  if (q.chargeCents) return `You pay the ${formatCents(q.chargeCents)} difference now.`
  if (q.refundCents) return `${formatCents(q.refundCents)} goes back to your card (5–10 business days).`
  return ''
})

const canSubmit = computed(() => !!quote.value && !quoting.value && !unchanged.value && !submitting.value)
const submitLabel = computed(() => (quote.value?.chargeCents ? `Pay ${formatCents(quote.value.chargeCents)} and change` : 'Change tee time'))

// Where Stripe sends the golfer back if their bank needs a redirect: My Account finishes the change from the query
const returnUrl = computed(() => (payment.value
  ? `${location.origin}/account?booking_change=${encodeURIComponent(payment.value.changeId)}&booking=${encodeURIComponent(props.booking.id)}`
  : `${location.origin}/account`))

let slotSeq = 0
async function loadSlots() {
  const mine = ++slotSeq
  loadingSlots.value = true
  slotsError.value = null
  try {
    const data = await apiFetch(`/api/teetimes?date=${date.value}`)
    if (mine !== slotSeq) return
    slots.value = data
    // Back on the booking's own day: start from its time, so changing only the players is one tap
    if (!slotId.value && timeOptions.value.some(o => o.value === props.booking.teeTimeSlotId)) slotId.value = props.booking.teeTimeSlotId
  } catch (e) {
    if (mine === slotSeq) slotsError.value = e.message
  } finally {
    if (mine === slotSeq) loadingSlots.value = false
  }
}

let quoteSeq = 0
async function loadQuote() {
  const mine = ++quoteSeq
  quote.value = null
  quoteError.value = null
  submitError.value = null
  if (!slotId.value || unchanged.value) return
  quoting.value = true
  try {
    const res = await apiFetch(`/api/bookings/${props.booking.id}/change`, {
      method: 'POST', body: { teeTimeSlotId: slotId.value, players: players.value, preview: true },
    })
    if (mine === quoteSeq) quote.value = res.quote
  } catch (e) {
    if (mine === quoteSeq) quoteError.value = e.message
  } finally {
    if (mine === quoteSeq) quoting.value = false
  }
}

watch(date, () => { slotId.value = null; loadSlots() })
// A time that no longer fits the group is dropped
watch(players, () => { if (!timeOptions.value.some(o => o.value === slotId.value)) slotId.value = null })
watch([slotId, players], loadQuote)

function finish(result) {
  finished = result
  open.value = false
}

function onAfterLeave() {
  // Closed for the payment form: the payment handlers finish
  if (payment.value) return
  if (finished) emit('done', finished)
  else emit('close')
}

// The answer to a change, confirm or cancel request
function outcome(res) {
  if (res.status === 'applied') {
    return { booking: res.booking, message: res.warning || `Tee time changed to ${newLabel.value}.`, tone: res.warning ? 'error' : undefined }
  }
  if (res.status === 'processing') {
    return { message: 'Your payment is still processing. We\'ll email you as soon as the change is made.' }
  }
  if (res.status === 'cancelled') return { message: 'Your booking wasn\'t changed.' }
  return { booking: res.booking, message: res.error || 'The change couldn\'t be made.', tone: 'error' }
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  submitError.value = null
  try {
    const res = await apiFetch(`/api/bookings/${props.booking.id}/change`, {
      method: 'POST', body: { teeTimeSlotId: slotId.value, players: players.value },
    })
    if (res.status === 'payment_required') {
      payment.value = { clientSecret: res.clientSecret, changeId: res.change.id, chargeCents: res.chargeCents }
      open.value = false
      return
    }
    if (res.status === 'failed') {
      submitError.value = res.error
      loadSlots()
      return
    }
    finish(outcome(res))
  } catch (e) {
    submitError.value = e.message
    if (e.code === 'NO_ROOM') loadSlots()
  } finally {
    submitting.value = false
  }
}

async function finishPayment(action) {
  const { changeId } = payment.value
  let result
  try {
    result = outcome(await apiFetch(`/api/bookings/${props.booking.id}/change`, { method: 'POST', body: { action, changeId } }))
  } catch (e) {
    result = action === 'confirm'
      ? { message: `${e.message} If you were charged, the change is finished automatically, or the payment is refunded.`, tone: 'error' }
      : { message: 'Your booking wasn\'t changed.' }
  }
  payment.value = null
  emit('done', result)
}

const onPaid = () => finishPayment('confirm')
const onPaymentClosed = () => finishPayment('cancel')

onMounted(() => {
  loadSlots()
})
</script>
