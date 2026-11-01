<template>
  <AppDialog :open="true" title="Card payment" size="sm" persistent>
    <div class="font-body text-center">
      <div class="font-display text-display-s text-on-surface tabular-nums">{{ formatCents(checkout.amountCents) }}</div>
      <p v-if="cashCents" class="text-body-m text-on-surface-variant">plus {{ formatCents(cashCents) }} cash</p>
      <p v-if="checkout.tipping" class="text-body-m text-on-surface-variant">The customer can add a tip on the reader</p>

      <!-- State -->
      <div class="mt-4 flex flex-col items-center gap-2" role="status" aria-live="polite">
        <template v-if="state === 'waiting'">
          <ProgressIndicator :size="56" label="Waiting for the card" class="text-primary" />
          <p class="text-title-l text-on-surface">Waiting for the card</p>
          <p class="text-body-l text-on-surface-variant">Tap, insert or swipe the card on the reader.</p>
        </template>

        <template v-else-if="state === 'saving'">
          <ProgressIndicator :size="56" label="Saving the sale" class="text-success" />
          <p class="flex items-center gap-2 text-title-l text-on-surface">
            <IconApproved class="w-7 h-7 text-success" aria-hidden="true" /> Approved
          </p>
          <p class="text-body-l text-on-surface-variant">Saving the sale…</p>
        </template>

        <template v-else-if="state === 'declined'">
          <IconDeclined class="w-12 h-12 text-error" aria-hidden="true" />
          <p class="text-title-l text-error">Card not accepted</p>
          <p class="text-body-l text-on-surface">{{ checkout.lastError }}</p>
          <p class="text-body-m text-on-surface-variant">Try the card again, use another card, or take cash.</p>
        </template>

        <!-- Charged, sale not saved (rare): let the cashier retry saving -->
        <template v-else-if="state === 'charged'">
          <IconApproved class="w-12 h-12 text-success" aria-hidden="true" />
          <p class="text-title-l text-on-surface">The card was charged</p>
          <p class="text-body-l text-on-surface-variant">{{ checkout.lastError || 'Saving the sale…' }}</p>
        </template>

        <template v-else-if="state === 'canceled'">
          <IconCanceled class="w-12 h-12 text-on-surface-variant" aria-hidden="true" />
          <p class="text-title-l text-on-surface">Card payment cancelled</p>
          <p class="text-body-l text-on-surface-variant">Nothing was charged.</p>
        </template>
      </div>

      <!-- Test mode (simulated reader): keep it visually apart from the real actions -->
      <div
        v-if="checkout.testMode && (state === 'waiting' || state === 'declined')"
        class="mt-4 rounded-shape-md border border-dashed border-outline-variant px-2 py-2"
      >
        <div class="flex items-center justify-center gap-2 text-label-m uppercase tracking-wider text-on-surface-variant mb-1">
          <IconTest class="w-4 h-4" aria-hidden="true" /> Test mode: simulate the reader
        </div>
        <div class="flex flex-wrap gap-1 justify-center">
          <AppButton variant="text" :disabled="busy" @click="act('simulate')">Card</AppButton>
          <AppButton v-if="checkout.tipping" variant="text" :disabled="busy" @click="act('simulate', { tipCents: 500 })">Card + $5 tip</AppButton>
          <AppButton variant="text" :disabled="busy" @click="act('simulate', { decline: true })">Decline</AppButton>
        </div>
      </div>

      <ErrorBanner v-if="error" :message="error" class="mt-4 text-left" />

      <!-- Actions: stacked, full width, 64dp (the register is a touchscreen) -->
      <div class="mt-4 flex flex-col gap-2">
        <template v-if="state === 'charged'">
          <AppButton size="xl" block :loading="busy" @click="act('complete')">{{ busy ? 'Saving…' : 'Save' }}</AppButton>
        </template>
        <template v-else-if="state === 'declined'">
          <AppButton size="xl" block :icon="IconRetry" :loading="busy" @click="act('retry')">Try again</AppButton>
          <AppButton size="xl" block variant="tonal" :icon="IconCash" :disabled="busy" @click="payCash">Pay with cash instead</AppButton>
          <AppButton size="xl" block variant="outlined" :disabled="busy" @click="act('cancel')">Cancel card payment</AppButton>
        </template>
        <template v-else-if="state === 'canceled'">
          <AppButton size="xl" block @click="$emit('canceled')">Back to the sale</AppButton>
          <AppButton size="xl" block variant="tonal" :icon="IconCash" @click="payCash">Pay with cash instead</AppButton>
        </template>
        <template v-else>
          <AppButton size="xl" block variant="outlined" :disabled="busy || state === 'saving'" @click="act('cancel')">
            Cancel card payment
          </AppButton>
        </template>
      </div>
    </div>
  </AppDialog>
</template>

<script setup>
// Card payment in progress on the reader: polls GET /api/staff/card-checkouts/:id every 2 s and shows waiting for
// the card → approved, saving → done; declined (Try again / Pay with cash instead / Cancel); charged but not saved
// (Save); cancelled. Test mode (checkout.testMode) adds Simulate buttons.
//   <CardPaymentModal :initial="checkout" :cash-cents="cashPart" @done="finish" @canceled="backToTender" @pay-cash="toCash" />
// Props: initial ({ id, status, amountCents, lastError, tipping, testMode }), cashCents (the cash part of a split).
// Emits:
//   done({ sale, accountPayment, warnings, emailError, notice }) once the sale (or account payment) is saved,
//   canceled() from "Back to the sale" after the payment was cancelled,
//   pay-cash({ checkout }) from "Pay with cash instead" (shown on a decline/failure and after a cancel). The modal does
//     NOT cancel the checkout itself: the parent cancels it as the cancel path does (POST { action: 'cancel' }; skip
//     when checkout.status is already CANCELED) and reopens the tender on cash.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import IconApproved from '~icons/material-symbols/check-circle-rounded'
import IconDeclined from '~icons/material-symbols/credit-card-off-rounded'
import IconCanceled from '~icons/material-symbols/cancel-rounded'
import IconRetry from '~icons/material-symbols/refresh-rounded'
import IconCash from '~icons/material-symbols/payments-rounded'
import IconTest from '~icons/material-symbols/science-rounded'

const props = defineProps({
  initial:   { type: Object, required: true }, // { id, status, amountCents, lastError, tipping, testMode }
  cashCents: { type: Number, default: 0 },
})
const emit = defineEmits(['done', 'canceled', 'pay-cash'])

const POLL_MS = 2000

const checkout = ref({ ...props.initial })
const busy     = ref(false)
const error    = ref(null)
let timer = null
let polling = false

// waiting | saving | declined | charged | canceled
const state = computed(() => {
  const s = checkout.value.status
  if (s === 'SUCCEEDED') return 'charged'
  if (s === 'CANCELED') return 'canceled'
  if (s === 'COMPLETING' || s === 'COMPLETED') return 'saving'
  return checkout.value.lastError ? 'declined' : 'waiting'
})

// Shared by polling and the buttons: anything that returns the checkout (and the sale once it's saved)
function apply(result) {
  if (result.cardCheckout) checkout.value = { ...checkout.value, ...result.cardCheckout }
  if (checkout.value.status === 'COMPLETED' && (result.sale || result.accountPayment)) {
    stop()
    emit('done', {
      sale: result.sale ?? null, accountPayment: result.accountPayment ?? null,
      warnings: result.warnings ?? [], emailError: result.emailError ?? null, notice: result.notice,
    })
  }
}

async function poll() {
  if (polling || busy.value) return
  polling = true
  try {
    apply(await apiFetch(`/api/staff/card-checkouts/${checkout.value.id}`))
    error.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    polling = false
  }
}

async function act(action, extra = {}) {
  busy.value  = true
  error.value = null
  try {
    apply(await apiFetch(`/api/staff/card-checkouts/${checkout.value.id}`, { method: 'POST', body: { action, ...extra } }))
  } catch (e) {
    error.value = e.message
    poll()
  } finally {
    busy.value = false
  }
}

function payCash() {
  emit('pay-cash', { checkout: { ...checkout.value } })
}

function stop() {
  clearInterval(timer)
  timer = null
}

onMounted(() => { timer = setInterval(poll, POLL_MS) })
onUnmounted(stop)
</script>
