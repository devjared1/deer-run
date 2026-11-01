<template>
  <section v-if="data?.account || loadError" aria-labelledby="house-account-title" class="space-y-4">
    <h2 id="house-account-title" class="font-display text-headline-s md:text-headline-m text-on-surface">House account</h2>

    <ErrorBanner
      v-if="loadError && !data?.account"
      title="We couldn't load your house account"
      :message="loadError"
      :retrying="loading"
      @retry="load"
    />

    <template v-if="account">
      <Card variant="elevated" padding="lg">
        <div class="flex flex-wrap items-start gap-x-10 gap-y-6">
          <div class="min-w-0">
            <p class="text-label-m uppercase tracking-wider text-on-surface-variant">Balance</p>
            <p class="font-display text-headline-l text-on-surface tabular-nums">{{ formatCents(account.balanceCents) }}</p>
            <p class="text-body-m text-on-surface-variant">
              {{ formatCents(account.availableCents) }} available of {{ formatCents(account.creditLimitCents) }}
            </p>
            <StatusChip v-if="account.status !== 'ACTIVE'" kind="houseAccount" :status="account.status" class="mt-2" />
            <p v-if="account.status === 'SUSPENDED'" class="text-body-m text-on-surface-variant mt-1">Charging is paused.</p>
          </div>

          <ul class="flex-1 min-w-[14rem] space-y-3 text-body-m text-on-surface">
            <li class="flex gap-3">
              <IconAutorenew class="w-6 h-6 flex-shrink-0 text-on-surface-variant" aria-hidden="true" />
              <span>
                <span class="block text-label-m uppercase tracking-wider text-on-surface-variant">Billing</span>
                {{ account.autopayEnabled ? `Autopay with ${cardLabel(account)}` : 'Statement by email on the 1st' }}
              </span>
            </li>
            <li class="flex gap-3">
              <IconPassword class="w-6 h-6 flex-shrink-0 text-on-surface-variant" aria-hidden="true" />
              <span>
                <span class="block text-label-m uppercase tracking-wider text-on-surface-variant">Pro shop PIN</span>
                <template v-if="account.pinLocked">Locked: ask at the pro shop to reset it</template>
                <template v-else>{{ account.hasPin ? 'Set' : 'Not set yet' }}</template>
              </span>
            </li>
          </ul>

          <!-- One primary action; the rest in the overflow menu -->
          <div class="flex items-center gap-1 ml-auto">
            <AppButton v-if="primary" :variant="primary.key === 'pay' ? 'gold' : 'filled'" :icon="primary.icon" @click="primary.onClick">
              {{ primary.label }}
            </AppButton>
            <RowActionsMenu v-if="menuItems.length" label="More house account actions" :items="menuItems" />
          </div>
        </div>

        <ErrorBanner v-if="error" :message="error" class="mt-6" @dismiss="error = null" />
      </Card>

      <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start">
        <Card variant="outlined" padding="none">
          <h3 class="px-4 sm:px-5 pt-4 pb-2 text-title-m text-on-surface">Recent activity</h3>
          <ul v-if="data.entries.length" class="divide-y divide-outline-variant">
            <li v-for="e in data.entries" :key="e.id" class="flex items-baseline gap-3 px-4 sm:px-5 py-3 text-body-m">
              <span class="w-14 flex-shrink-0 text-on-surface-variant whitespace-nowrap">{{ formatDate(e.createdAt) }}</span>
              <span class="flex-1 min-w-0 text-on-surface break-words">{{ e.description }}</span>
              <span :class="['tabular-nums whitespace-nowrap', e.amountCents < 0 ? 'text-success' : 'text-on-surface']">
                <span v-if="e.amountCents < 0" class="sr-only">Credit </span>{{ e.amountCents < 0 ? '−' : '' }}{{ formatCents(Math.abs(e.amountCents)) }}
              </span>
            </li>
          </ul>
          <EmptyState v-else compact :icon="IconReceipt" message="No charges yet." />
        </Card>

        <Card variant="outlined" padding="none">
          <h3 class="px-4 sm:px-5 pt-4 pb-2 text-title-m text-on-surface">Statements</h3>
          <ul v-if="data.statements.length" class="divide-y divide-outline-variant">
            <li v-for="s in data.statements" :key="s.id">
              <RouterLink
                :to="`/account/statements/${s.id}`"
                class="state-layer flex items-center gap-2 min-h-14 px-4 sm:px-5 py-2 no-underline text-on-surface"
              >
                <span class="flex-1 min-w-0">
                  <span class="block text-body-l">{{ formatLocalDate(s.periodStart, { month: 'long', year: 'numeric' }) }}</span>
                  <span class="block text-body-m text-on-surface-variant tabular-nums">{{ formatCents(s.closingCents) }}</span>
                </span>
                <StatusChip size="sm" kind="statement" :status="statementStatus(s)" />
                <IconChevronRight class="w-6 h-6 text-on-surface-variant" aria-hidden="true" />
              </RouterLink>
            </li>
          </ul>
          <EmptyState v-else compact :icon="IconCalendar" message="Your first statement comes on the 1st." />
        </Card>
      </div>

      <!-- Pay: choose the amount -->
      <AppDialog v-model:open="payOpen" title="Pay your house account" persistent size="sm">
        <form id="pay-form" novalidate class="space-y-2 pt-1" @submit.prevent="continuePay">
          <MoneyField
            v-model="payForm.amountCents"
            label="Amount"
            :min="50"
            :max="account.balanceCents"
            required
            :helper="`Your balance is ${formatCents(account.balanceCents)}.`"
            data-autofocus
          />
          <ErrorBanner v-if="payForm.error" :message="payForm.error" />
        </form>
        <template #actions="{ close }">
          <AppButton variant="text" :disabled="payForm.busy" @click="close">Cancel</AppButton>
          <AppButton type="submit" form="pay-form" variant="gold" :loading="payForm.busy" :icon="IconPayments">Continue</AppButton>
        </template>
      </AppDialog>

      <StripeElementModal
        v-if="stripeForm"
        :mode="stripeForm.mode"
        :client-secret="stripeForm.clientSecret"
        :title="stripeForm.title"
        :subtitle="stripeForm.subtitle"
        :submit-label="stripeForm.submitLabel"
        :return-url="returnUrl"
        @success="onStripeSuccess"
        @close="stripeForm = null"
      />

      <!-- PIN -->
      <AppDialog v-model:open="pinOpen" :title="account.hasPin ? 'Change your PIN' : 'Set your PIN'" persistent size="sm">
        <p class="text-body-m text-on-surface-variant mb-4">
          You'll type this 4–6 digit PIN at the pro shop to charge to your account. Don't share it.
        </p>
        <form id="pin-form" novalidate class="space-y-4" @submit.prevent="savePin">
          <TextField
            v-if="account.hasPin"
            v-model="pinForm.current"
            label="Current PIN"
            type="password"
            inputmode="numeric"
            maxlength="6"
            autocomplete="off"
            :error="pinForm.errors.current"
            data-autofocus
          />
          <TextField
            v-model="pinForm.next"
            label="New PIN"
            type="password"
            inputmode="numeric"
            maxlength="6"
            autocomplete="off"
            helper="4 to 6 digits"
            :error="pinForm.errors.next"
            :data-autofocus="account.hasPin ? undefined : ''"
          />
          <TextField
            v-model="pinForm.confirm"
            label="New PIN again"
            type="password"
            inputmode="numeric"
            maxlength="6"
            autocomplete="off"
            :error="pinForm.errors.confirm"
          />
          <ErrorBanner v-if="pinForm.error" :message="pinForm.error" />
        </form>
        <template #actions="{ close }">
          <AppButton variant="text" :disabled="pinForm.busy" @click="close">Cancel</AppButton>
          <AppButton type="submit" form="pin-form" :loading="pinForm.busy" :icon="IconPassword">Save PIN</AppButton>
        </template>
      </AppDialog>
    </template>
  </section>
</template>

<script setup>
// The signed-in member's house account on My Account: balance, billing and PIN, one primary action (Pay balance,
// else Set PIN, else Turn on autopay) with the rest in an overflow menu, recent activity and statements.
// GET/POST /api/account/house-account. Renders nothing for someone without a house account.
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { formatLocalDate, COURSE_TZ, toUtcIso } from '@/lib/timeclock'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import { statementStatus, cardLabel } from './accountDisplay'
import StripeElementModal from './StripeElementModal.vue'
import IconAddCard from '~icons/material-symbols/add-card-rounded'
import IconAutorenew from '~icons/material-symbols/autorenew-rounded'
import IconCalendar from '~icons/material-symbols/calendar-month-rounded'
import IconCardOff from '~icons/material-symbols/credit-card-off-rounded'
import IconCheck from '~icons/material-symbols/check-circle-rounded'
import IconChevronRight from '~icons/material-symbols/chevron-right-rounded'
import IconCreditCard from '~icons/material-symbols/credit-card-rounded'
import IconPassword from '~icons/material-symbols/password-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'

const route    = useRoute()
const router   = useRouter()
const confirm  = useConfirm()
const snackbar = useSnackbar()

const data       = ref(null)
const loading    = ref(false)
const loadError  = ref(null)
const error      = ref(null)
const stripeForm = ref(null)

const payOpen = ref(false)
const payForm = reactive({ amountCents: null, busy: false, error: null })
const pinOpen = ref(false)
const pinForm = reactive({ current: '', next: '', confirm: '', busy: false, error: null, errors: { current: '', next: '', confirm: '' } })

const account   = computed(() => data.value?.account)
const returnUrl = `${window.location.origin}/account`

// Every action the member can take; the first that applies in PRIMARY_ORDER is the button, the rest go in the menu
const actions = computed(() => {
  const a = account.value
  if (!a) return []
  return [
    a.balanceCents >= 50 && { key: 'pay', label: 'Pay balance', icon: IconPayments, onClick: startPay },
    { key: 'pin', label: a.hasPin ? 'Change PIN' : 'Set PIN', icon: IconPassword, onClick: openPin, disabled: a.pinLocked },
    !a.autopayEnabled && { key: 'autopay', label: 'Turn on autopay', icon: IconAddCard, onClick: startAutopay },
    a.autopayEnabled && { key: 'card', label: 'Replace card', icon: IconCreditCard, onClick: startAutopay },
    a.autopayEnabled && { key: 'autopay-off', label: 'Turn off autopay', icon: IconCardOff, danger: true, onClick: disableAutopay },
  ].filter(Boolean)
})
const primary = computed(() => {
  const a = account.value
  if (!a) return null
  const key = a.balanceCents >= 50 ? 'pay' : !a.hasPin && !a.pinLocked ? 'pin' : !a.autopayEnabled ? 'autopay' : null
  return actions.value.find(x => x.key === key) ?? null
})
const menuItems = computed(() => actions.value.filter(x => x !== primary.value))

async function load() {
  loading.value = true
  try {
    data.value = await apiFetch('/api/account/house-account')
    loadError.value = null
  } catch (e) {
    loadError.value = e.message || 'Please try again.'
  } finally {
    loading.value = false
  }
}

function startPay() {
  Object.assign(payForm, { amountCents: account.value.balanceCents, busy: false, error: null })
  payOpen.value = true
}

async function continuePay() {
  payForm.error = null
  const cents = payForm.amountCents
  if (!cents || cents < 50 || cents > account.value.balanceCents) {
    payForm.error = `Enter an amount between $0.50 and ${formatCents(account.value.balanceCents)}.`
    return
  }
  payForm.busy = true
  try {
    const { clientSecret } = await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'pay', amountCents: cents } })
    payOpen.value = false
    stripeForm.value = { mode: 'payment', clientSecret, title: `Pay ${formatCents(cents)}`, subtitle: 'Card, or another method Stripe offers', submitLabel: `Pay ${formatCents(cents)}` }
  } catch (e) {
    payForm.error = e.message
  } finally {
    payForm.busy = false
  }
}

async function startAutopay() {
  error.value = null
  try {
    const { clientSecret } = await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'autopay_setup' } })
    stripeForm.value = {
      mode: 'setup', clientSecret, title: account.value.autopayEnabled ? 'Replace your autopay card' : 'Turn on autopay',
      subtitle: 'Your statement balance is charged to this card on the 1st of each month. You can turn it off any time.',
      submitLabel: 'Save card',
    }
  } catch (e) {
    error.value = e.message
  }
}

async function disableAutopay() {
  const ok = await confirm({
    title: 'Turn off autopay?',
    message: 'Your saved card is removed and statements come as invoices you pay online or at the pro shop.',
    confirmLabel: 'Turn off autopay',
    cancelLabel: 'Keep autopay',
    destructive: true,
    icon: IconCardOff,
  })
  if (!ok) return
  error.value = null
  try {
    await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'autopay_disable' } })
    snackbar.show({ message: 'Autopay is off.', icon: IconCheck })
    await load()
  } catch (e) {
    error.value = e.message
  }
}

// After the Payment Element finishes on the page, or after Stripe sends the member back here from their bank
async function finish(mode, id) {
  error.value = null
  try {
    if (mode === 'payment') {
      const res = await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'confirm_payment', paymentIntentId: id } })
      snackbar.show({
        message: res.status === 'succeeded' ? 'Thank you! Your payment was received.' : 'Your payment is processing. It shows here once it clears.',
        icon: IconCheck,
      })
    } else {
      const res = await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'autopay_confirm', setupIntentId: id } })
      snackbar.show({ message: `Autopay is on with ${cardLabel(res)}.`, icon: IconCheck })
    }
  } catch (e) {
    error.value = e.message
  }
  await load()
}

function onStripeSuccess({ id }) {
  const mode = stripeForm.value.mode
  stripeForm.value = null
  finish(mode, id)
}

function openPin() {
  Object.assign(pinForm, { current: '', next: '', confirm: '', busy: false, error: null, errors: { current: '', next: '', confirm: '' } })
  pinOpen.value = true
}

async function savePin() {
  const f = pinForm
  f.error = null
  f.errors = {
    current: account.value.hasPin && !f.current ? 'Enter your current PIN' : '',
    next: /^\d{4,6}$/.test(f.next) ? '' : 'The PIN must be 4 to 6 digits',
    confirm: f.next && f.confirm !== f.next ? 'The two new PINs don\'t match' : '',
  }
  if (f.errors.current || f.errors.next || f.errors.confirm) return
  f.busy = true
  try {
    await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'set_pin', currentPin: f.current, newPin: f.next } })
    pinOpen.value = false
    snackbar.show({ message: 'Your PIN is saved.', icon: IconCheck })
    await load()
  } catch (e) {
    f.error = e.message
  } finally {
    f.busy = false
  }
}

function formatDate(ts) {
  return new Date(toUtcIso(ts)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: COURSE_TZ })
}

onMounted(async () => {
  await load()
  // Back from a bank redirect: Stripe adds the intent id to the return URL
  const { payment_intent: pi, setup_intent: si } = route.query
  if (pi || si) {
    router.replace({ query: {} })
    await finish(pi ? 'payment' : 'setup', pi || si)
  }
})
</script>
