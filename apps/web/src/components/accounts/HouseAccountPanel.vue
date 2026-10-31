<template>
  <div v-if="data?.account" class="mb-12">
    <SectionLabel text="House Account" class="mb-5" />

    <div class="card rounded-lg p-6 mb-4">
      <div class="flex flex-wrap items-start gap-x-10 gap-y-4">
        <div>
          <div class="label">
            Balance
          </div>
          <div class="font-display font-bold text-3xl tabular-nums" :class="account.balanceCents > 0 ? 'text-bark' : 'text-pine'">
            {{ formatCents(account.balanceCents) }}
          </div>
          <div class="text-xs text-bark/50 font-body">
            {{ formatCents(account.availableCents) }} available of {{ formatCents(account.creditLimitCents) }}
            <template v-if="account.status !== 'ACTIVE'">
              · <span class="text-clay">{{ account.status === 'SUSPENDED' ? 'charging is paused' : 'closed' }}</span>
            </template>
          </div>
        </div>
        <div class="font-body text-sm text-bark/80 space-y-1">
          <div>
            <span class="text-bark/50">Billing:</span>
            <template v-if="account.autopayEnabled">
              autopay with {{ cardLabel(account) }}
            </template>
            <template v-else>
              statement by email on the 1st
            </template>
          </div>
          <div>
            <span class="text-bark/50">PIN for the pro shop:</span>
            <span v-if="account.pinLocked" class="text-clay"> locked, ask at the pro shop</span>
            <span v-else>{{ account.hasPin ? ' set' : ' not set yet' }}</span>
          </div>
        </div>
        <div class="ml-auto flex flex-wrap gap-2">
          <button v-if="account.balanceCents >= 50" class="btn-amber" style="padding:10px 18px;font-size:12px;" @click="startPay">
            Pay balance
          </button>
          <button class="btn-outline-pine" style="padding:9px 16px;font-size:12px;" @click="pinForm = { current: '', next: '', confirm: '', busy: false, error: null }">
            {{ account.hasPin ? 'Change PIN' : 'Set PIN' }}
          </button>
          <button v-if="!account.autopayEnabled" class="btn-outline-pine" style="padding:9px 16px;font-size:12px;" @click="startAutopay">
            Turn on autopay
          </button>
          <template v-else>
            <button class="btn-outline-pine" style="padding:9px 16px;font-size:12px;" @click="startAutopay">
              Replace card
            </button>
            <button class="btn-outline-pine" style="padding:9px 16px;font-size:12px;" @click="disableAutopay">
              Turn off autopay
            </button>
          </template>
        </div>
      </div>
      <p v-if="notice" class="text-pine text-sm font-body mt-4">
        {{ notice }}
      </p>
      <p v-if="error" class="text-clay text-sm font-body mt-4">
        {{ error }}
      </p>
    </div>

    <div class="grid md:grid-cols-[1fr_16rem] gap-4">
      <div class="card rounded-lg overflow-hidden">
        <div class="px-5 py-3 font-body font-bold text-sm text-bark border-b border-bark/10">
          Recent activity
        </div>
        <table class="w-full text-sm font-body">
          <tbody>
            <tr v-for="e in data.entries" :key="e.id" class="border-b border-bark/5 last:border-0">
              <td class="px-5 py-2 text-bark/50 whitespace-nowrap">
                {{ formatDate(e.createdAt) }}
              </td>
              <td class="px-2 py-2 text-bark">
                {{ e.description }}
              </td>
              <td class="px-5 py-2 text-right tabular-nums" :class="e.amountCents < 0 ? 'text-pine' : 'text-bark'">
                {{ e.amountCents < 0 ? '−' : '' }}{{ formatCents(Math.abs(e.amountCents)) }}
              </td>
            </tr>
            <tr v-if="!data.entries.length">
              <td class="px-5 py-6 text-center text-bark/40" colspan="3">
                No charges yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card rounded-lg overflow-hidden self-start">
        <div class="px-5 py-3 font-body font-bold text-sm text-bark border-b border-bark/10">
          Statements
        </div>
        <ul class="font-body text-sm">
          <li v-for="s in data.statements" :key="s.id" class="px-5 py-2 border-b border-bark/5 last:border-0 flex items-center gap-2">
            <RouterLink :to="`/account/statements/${s.id}`" class="text-lake hover:text-pine flex-1">
              {{ formatLocalDate(s.periodStart, { month: 'long', year: 'numeric' }) }}
            </RouterLink>
            <span class="tabular-nums text-bark/70">{{ formatCents(s.closingCents) }}</span>
            <span :class="['text-[11px] px-1.5 py-0.5 rounded-full', STATEMENT_STATUS_CLASSES[statementStatus(s)]]">{{ STATEMENT_STATUS_LABELS[statementStatus(s)] }}</span>
          </li>
          <li v-if="!data.statements.length" class="px-5 py-4 text-bark/40 text-center">
            Your first statement comes on the 1st.
          </li>
        </ul>
      </div>
    </div>

    <!-- Pay: choose the amount -->
    <div v-if="payForm" class="modal-overlay" @click.self="payForm = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-4">
          Pay your house account
        </h2>
        <label class="block text-xs text-gray-500 mb-1 font-body">Amount ($)</label>
        <input v-model="payForm.amount" type="number" min="0.50" :max="account.balanceCents / 100" step="0.01" class="input-field w-full text-lg">
        <p class="text-xs text-gray-400 font-body mt-1">
          Your balance is {{ formatCents(account.balanceCents) }}.
        </p>
        <p v-if="payForm.error" class="text-red-500 text-sm mt-2 font-body">
          {{ payForm.error }}
        </p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="payForm = null">
            Cancel
          </button>
          <button class="btn-amber px-5 py-2 text-sm disabled:opacity-50" :disabled="payForm.busy" @click="continuePay">
            Continue
          </button>
        </div>
      </div>
    </div>

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
    <div v-if="pinForm" class="modal-overlay" @click.self="pinForm = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">
          {{ account.hasPin ? 'Change your PIN' : 'Set your PIN' }}
        </h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          You'll type this 4–6 digit PIN at the pro shop to charge to your account. Don't share it.
        </p>
        <div class="space-y-3">
          <div v-if="account.hasPin">
            <label class="block text-xs text-gray-500 mb-1 font-body">Current PIN</label>
            <input v-model="pinForm.current" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="input-field w-full tracking-widest">
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1 font-body">New PIN</label>
            <input v-model="pinForm.next" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="input-field w-full tracking-widest">
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1 font-body">New PIN again</label>
            <input v-model="pinForm.confirm" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="input-field w-full tracking-widest">
          </div>
        </div>
        <p v-if="pinForm.error" class="text-red-500 text-sm mt-2 font-body">
          {{ pinForm.error }}
        </p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="pinForm = null">
            Cancel
          </button>
          <button class="btn-amber px-5 py-2 text-sm disabled:opacity-50" :disabled="pinForm.busy" @click="savePin">
            Save PIN
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents, dollarsToCents } from '@/lib/money'
import { formatLocalDate, COURSE_TZ } from '@/lib/timeclock'
import { STATEMENT_STATUS_LABELS, STATEMENT_STATUS_CLASSES, statementStatus, cardLabel } from './accountDisplay'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import StripeElementModal from './StripeElementModal.vue'

const route  = useRoute()
const router = useRouter()

const data       = ref(null)
const error      = ref(null)
const notice     = ref(null)
const payForm    = ref(null)
const stripeForm = ref(null)
const pinForm    = ref(null)

const account   = computed(() => data.value?.account)
const returnUrl = `${window.location.origin}/account`

async function load() {
  try {
    data.value = await apiFetch('/api/account/house-account')
  } catch (e) {
    error.value = e.message
  }
}

function startPay() {
  payForm.value = { amount: (account.value.balanceCents / 100).toFixed(2), busy: false, error: null }
}

async function continuePay() {
  const f = payForm.value
  f.busy  = true
  f.error = null
  try {
    const cents = dollarsToCents(f.amount) ?? 0
    const { clientSecret } = await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'pay', amountCents: cents } })
    payForm.value = null
    stripeForm.value = { mode: 'payment', clientSecret, title: `Pay ${formatCents(cents)}`, subtitle: 'Card, or another method Stripe offers', submitLabel: `Pay ${formatCents(cents)}` }
  } catch (e) {
    f.error = e.message
  } finally {
    if (payForm.value) f.busy = false
  }
}

async function startAutopay() {
  error.value = null
  try {
    const { clientSecret } = await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'autopay_setup' } })
    stripeForm.value = {
      mode: 'setup', clientSecret, title: 'Turn on autopay',
      subtitle: 'Your statement balance is charged to this card on the 1st of each month. You can turn it off any time.',
      submitLabel: 'Save card',
    }
  } catch (e) {
    error.value = e.message
  }
}

async function disableAutopay() {
  if (!confirm('Turn off autopay? Your saved card is removed and statements come as invoices you pay online or at the pro shop.')) return
  error.value = null
  try {
    await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'autopay_disable' } })
    notice.value = 'Autopay is off.'
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
      notice.value = res.status === 'succeeded' ? 'Thank you! Your payment was received.' : 'Your payment is processing. It shows here once it clears.'
    } else {
      const res = await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'autopay_confirm', setupIntentId: id } })
      notice.value = `Autopay is on with ${cardLabel(res)}.`
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

async function savePin() {
  const f = pinForm.value
  f.error = null
  if (!/^\d{4,6}$/.test(f.next)) { f.error = 'The PIN must be 4 to 6 digits'; return }
  if (f.next !== f.confirm) { f.error = 'The two new PINs don\'t match'; return }
  f.busy = true
  try {
    await apiFetch('/api/account/house-account', { method: 'POST', body: { action: 'set_pin', currentPin: f.current, newPin: f.next } })
    pinForm.value = null
    notice.value = 'Your PIN is saved.'
    await load()
  } catch (e) {
    f.error = e.message
  } finally {
    if (pinForm.value) f.busy = false
  }
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: COURSE_TZ })
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

<style scoped>
.label          { @apply text-xs font-body uppercase tracking-wider text-bark/50 mb-1; }
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40; }
</style>
