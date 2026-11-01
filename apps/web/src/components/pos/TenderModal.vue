<template>
  <div class="modal-overlay">
    <div class="modal-box max-w-md">
      <div class="text-center mb-5">
        <div class="text-gray-400 text-xs font-body uppercase tracking-wider">Total Due</div>
        <div class="font-display font-bold text-bark text-4xl tabular-nums">{{ formatCents(totalCents) }}</div>
      </div>

      <template v-if="totalCents > 0">
        <!-- Method -->
        <div class="grid grid-cols-4 gap-2 mb-4">
          <button :class="['method-btn', method === 'cash' ? 'border-pine bg-pine text-parch' : 'border-gray-300 text-bark hover:bg-gray-50']" @click="setMethod('cash')">Cash</button>
          <button
            :class="['method-btn', method === 'card' ? 'border-pine bg-pine text-parch' : cardBlocked ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300 text-bark hover:bg-gray-50']"
            :disabled="!!cardBlocked"
            :title="cardBlocked || ''"
            @click="setMethod('card')"
          >Card</button>
          <button
            :class="['method-btn', method === 'split' ? 'border-pine bg-pine text-parch' : cardBlocked || totalCents < 100 ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300 text-bark hover:bg-gray-50']"
            :disabled="!!cardBlocked || totalCents < 100"
            title="Part card, part cash"
            @click="setMethod('split')"
          >Split</button>
          <button
            :class="['method-btn', method === 'account' ? 'border-pine bg-pine text-parch' : accountBlocked ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300 text-bark hover:bg-gray-50']"
            :disabled="!!accountBlocked"
            :title="accountBlocked || 'Charge to the member\'s house account'"
            @click="setMethod('account')"
          >Account</button>
        </div>

        <template v-if="method === 'account'">
          <p class="text-center text-gray-600 text-sm font-body">
            Charge to {{ accountName }}'s house account.
            <span class="block text-xs text-gray-400">{{ formatCents(account.availableCents) }} available</span>
          </p>
          <label class="label-sm mt-3">Member's PIN (the member types it)</label>
          <input
            ref="pinInput"
            v-model="accountPin"
            type="password"
            inputmode="numeric"
            maxlength="6"
            autocomplete="off"
            class="input-field w-full text-lg text-center tracking-[0.5em]"
            @keyup.enter="canComplete && complete()"
          />
        </template>

        <template v-if="method === 'card'">
          <p class="text-center text-gray-500 text-sm font-body">
            The full amount goes to the card reader. The customer taps, inserts or swipes there.
          </p>
        </template>

        <template v-if="method === 'split'">
          <label class="label-sm">On the card ($)</label>
          <input v-model="cardAmount" type="number" min="0.50" step="0.01" class="input-field w-full text-lg tabular-nums" />
          <p class="text-xs font-body mt-1" :class="splitCardValid ? 'text-gray-500' : 'text-clay'">
            <template v-if="splitCardValid">{{ formatCents(cashDueCents) }} in cash</template>
            <template v-else>The card amount must be at least $0.50 and leave some for cash</template>
          </p>
        </template>

        <template v-if="method !== 'card' && method !== 'account'">
        <label class="label-sm" :class="method === 'split' ? 'mt-3' : ''">Cash Received ($)</label>
        <input
          ref="tenderInput"
          v-model="tendered"
          type="number"
          min="0"
          step="0.01"
          class="input-field w-full text-lg tabular-nums"
          @keyup.enter="canComplete && complete()"
        />
        <div class="flex flex-wrap gap-2 mt-2">
          <button v-for="q in quickAmounts" :key="q" class="quick-btn" @click="tendered = (q / 100).toFixed(2)">
            {{ q === totalCents ? 'Exact' : formatCents(q) }}
          </button>
        </div>
        <div class="mt-3 text-center font-body">
          <span v-if="tendered !== '' && tenderedCents >= cashDueCents" class="text-pine text-lg">
            Change: <strong class="tabular-nums">{{ formatCents(tenderedCents - cashDueCents) }}</strong>
          </span>
          <span v-else-if="tendered !== ''" class="text-clay text-sm">
            {{ formatCents(cashDueCents - tenderedCents) }} short
          </span>
        </div>
        </template>
      </template>
      <p v-else class="text-center text-gray-500 text-sm font-body mb-2">No payment needed.</p>

      <!-- Receipt -->
      <div class="border-t border-gray-100 mt-4 pt-4 space-y-2">
        <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
          <input v-model="print" type="checkbox" class="rounded" /> Print receipt
        </label>
        <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
          <input v-model="sendEmail" type="checkbox" class="rounded" /> Email receipt
        </label>
        <input
          v-if="sendEmail"
          v-model="email"
          type="email"
          class="input-field w-full"
          placeholder="customer@example.com"
        />
      </div>

      <div class="flex justify-end gap-3 mt-5">
        <button class="btn-outline-sm" :disabled="busy" @click="$emit('close')">Back</button>
        <button :disabled="!canComplete || busy" class="btn-amber px-5 py-2 text-sm disabled:opacity-50" @click="complete">
          {{ busy ? 'Completing…' : method === 'cash' || totalCents === 0 ? 'Complete Sale' : method === 'account' ? 'Charge Account' : 'Charge Card' }}
        </button>
      </div>
      <p v-if="error" class="text-red-500 text-sm mt-3 font-body">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatCents, dollarsToCents } from '@/lib/money'

const props = defineProps({
  totalCents: { type: Number, required: true },
  defaultEmail: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  error: { type: String, default: null },
  // Why card payments aren't available on this register (null = they are)
  cardBlocked: { type: String, default: 'This register has no card reader' },
  // The attached customer's house account summary (from the customer search), or null
  account: { type: Object, default: null },
  accountName: { type: String, default: '' },
})
const emit = defineEmits(['complete', 'close'])

const method      = ref('cash') // cash | card | split | account
const accountPin  = ref('')
const pinInput    = ref(null)

// Why the house account can't take this sale (null = it can)
const accountBlocked = computed(() => {
  const a = props.account
  if (!a) return 'Attach a member with a house account'
  if (a.status !== 'ACTIVE') return `The house account is ${a.status.toLowerCase()}`
  if (a.pinLocked) return 'The account PIN is locked (Admin → House Accounts)'
  if (!a.hasPin) return 'The member hasn\'t set an account PIN yet (My Account)'
  if (a.availableCents < props.totalCents) return `Only ${formatCents(a.availableCents)} available on the account`
  return null
})
const cardAmount  = ref('')
const tendered    = ref('')
const print       = ref(true)
const sendEmail   = ref(false)
const email       = ref(props.defaultEmail)
const tenderInput = ref(null)

const tenderedCents = computed(() => dollarsToCents(tendered.value) || 0)
const cardCents     = computed(() => (method.value === 'card' ? props.totalCents : method.value === 'split' ? dollarsToCents(cardAmount.value) || 0 : 0))
const cashDueCents  = computed(() => (method.value === 'account' ? 0 : props.totalCents - cardCents.value))
const splitCardValid = computed(() => cardCents.value >= 50 && cardCents.value < props.totalCents)

function setMethod(m) {
  method.value = m
  tendered.value = ''
  if (m === 'split' && !cardAmount.value) cardAmount.value = (Math.floor(props.totalCents / 2) / 100).toFixed(2)
  accountPin.value = ''
  if (m === 'account') setTimeout(() => pinInput.value?.focus())
  else if (m !== 'card') setTimeout(() => tenderInput.value?.focus())
}

// Exact, then the next round amounts customers usually hand over
const quickAmounts = computed(() => {
  const t = cashDueCents.value
  const amounts = [t]
  for (const step of [500, 1000, 2000, 5000, 10000]) {
    const next = Math.ceil(t / step) * step
    if (next > t && !amounts.includes(next)) amounts.push(next)
  }
  return amounts.slice(0, 5)
})

const canComplete = computed(() => {
  if (sendEmail.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return false
  if (props.totalCents === 0) return true
  if (method.value === 'card') return props.totalCents >= 50
  if (method.value === 'account') return !accountBlocked.value && /^\d{4,6}$/.test(accountPin.value)
  if (method.value === 'split') return splitCardValid.value && tenderedCents.value >= cashDueCents.value
  return tenderedCents.value >= props.totalCents
})

function payments() {
  if (props.totalCents === 0) return []
  if (method.value === 'account') return [{ method: 'HOUSE_ACCOUNT' }]
  const list = []
  if (cardCents.value > 0) list.push({ method: 'CARD_TERMINAL', amountCents: cardCents.value })
  if (cashDueCents.value > 0) list.push({ method: 'CASH', tenderedCents: tenderedCents.value })
  return list
}

function complete() {
  emit('complete', {
    payments: payments(),
    accountPin: method.value === 'account' ? accountPin.value : null,
    print: print.value,
    receiptEmail: sendEmail.value ? email.value.trim() : null,
  })
}

onMounted(() => tenderInput.value?.focus())
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.method-btn     { @apply border rounded-lg py-2 text-sm font-body font-semibold; }
.quick-btn      { @apply border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-body text-bark hover:bg-gray-50 tabular-nums; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
