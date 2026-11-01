<template>
  <AppDialog
    :open="true"
    aria-label="Payment"
    :size="totalCents > 0 ? 'lg' : 'md'"
    persistent
    initial-focus="[data-autofocus]"
  >
    <!-- No title row: the total is the heading, so the keypad fits the 768px-tall register screen -->
    <div class="font-body pt-4">
      <div class="text-center mb-3">
        <h2 class="text-label-l text-on-surface-variant uppercase tracking-wider">Total due</h2>
        <div class="font-display text-display-s text-on-surface tabular-nums">{{ formatCents(totalCents) }}</div>
      </div>

      <template v-if="totalCents > 0">
        <!-- Method -->
        <SegmentedButton
          :model-value="method"
          :options="methodOptions"
          label="Payment method"
          size="lg"
          block
          @update:model-value="setMethod"
        />

        <div :class="['mt-4', usesKeypad ? 'grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] items-start' : '']">
          <div class="min-w-0 space-y-4">
            <p v-if="unavailableNote" class="text-body-s text-on-surface-variant">{{ unavailableNote }}</p>
            <ErrorBanner
              v-if="!drawerOpen && usesCash"
              tone="warning"
              message="Open the cash drawer to take cash. Completing asks you to count the float first."
            />
            <!-- Cash / split: quick amounts and the change -->
            <template v-if="usesCash">
              <div v-if="method === 'split'" class="rounded-shape-md bg-surface-container-highest px-4 py-3 text-body-m text-on-surface">
                <template v-if="splitValid">
                  <div class="flex justify-between gap-3"><span>Cash</span><span class="tabular-nums">{{ formatCents(cashDueCents) }}</span></div>
                  <div class="flex justify-between gap-3 text-title-m"><span>On the card</span><span class="tabular-nums">{{ formatCents(cardCents) }}</span></div>
                </template>
                <span v-else class="text-on-surface-variant">
                  Enter the cash the customer is paying. The rest goes on the card (at least $0.50).
                </span>
              </div>

              <div v-if="quickAmounts.length" class="grid grid-cols-2 gap-2" role="group" :aria-label="method === 'split' ? 'Cash part' : 'Quick cash amounts'">
                <AppButton
                  v-for="q in quickAmounts"
                  :key="q"
                  size="xl"
                  variant="tonal"
                  block
                  class="!px-3 tabular-nums"
                  @mousedown.prevent
                  @click="pickQuick(q)"
                >
                  {{ method === 'cash' && q === cashDueCents ? 'Exact' : quickLabel(q) }}
                </AppButton>
              </div>

              <p v-if="method === 'cash' && tendered !== ''" class="text-center" aria-live="polite">
                <span v-if="tenderedCents >= cashDueCents" class="text-headline-s text-primary">
                  Change <strong class="tabular-nums">{{ formatCents(tenderedCents - cashDueCents) }}</strong>
                </span>
                <span v-else class="text-title-m text-error">{{ formatCents(cashDueCents - tenderedCents) }} short</span>
              </p>
            </template>

            <!-- Card -->
            <p v-else-if="method === 'card'" class="flex items-start gap-3 rounded-shape-md bg-surface-container-highest px-4 py-3 text-body-l text-on-surface">
              <IconContactless class="w-6 h-6 flex-none text-primary mt-0.5" aria-hidden="true" />
              The full amount goes to the card reader. The customer taps, inserts or swipes there.
            </p>

            <!-- House account -->
            <div v-else-if="method === 'account'" class="rounded-shape-md bg-surface-container-highest px-4 py-3 text-body-l text-on-surface">
              Charge to <strong>{{ accountName }}</strong>'s house account.
              <span class="block text-body-m text-on-surface-variant">{{ formatCents(account?.availableCents ?? 0) }} available</span>
            </div>

            <ReceiptChoice v-if="usesKeypad" v-model:choice="receipt" v-model:email="email" />
            <ErrorBanner v-if="error && usesKeypad" :message="error" />
          </div>

          <!-- Keypad: cash received, the cash part of a split, or the member's PIN -->
          <div v-if="usesKeypad" class="w-full max-w-[22rem] mx-auto sm:w-[22rem] rounded-shape-lg bg-surface-container-lowest p-2" @keydown.enter="onEnter">
            <NumericKeypad
              v-if="method === 'account'"
              ref="keypad"
              :key="'pin'"
              v-model="accountPin"
              data-autofocus
              label="Member's PIN"
              hint="The member types it"
              masked
              left-key="clear"
              :max-length="6"
              @submit="canComplete && complete()"
            />
            <NumericKeypad
              v-else
              ref="keypad"
              :key="method"
              :model-value="tendered"
              data-autofocus
              :label="method === 'split' ? 'Cash part' : 'Cash received'"
              :placeholder="method === 'cash' ? formatCents(cashDueCents) : '$0.00'"
              :hint="method === 'split' ? 'The rest goes on the card' : tendered === '' ? 'Enter = exact amount' : 'Enter = complete the sale'"
              left-key="."
              :max-length="9"
              :format="keypadDollars"
              @update:model-value="v => tendered = trimCents(v)"
              @submit="canComplete && complete()"
            />
          </div>
        </div>

        <ReceiptChoice v-if="!usesKeypad" v-model:choice="receipt" v-model:email="email" class="mt-4" />
      </template>

      <template v-else>
        <p class="text-center text-body-l text-on-surface-variant mb-4">No payment needed.</p>
        <ReceiptChoice v-model:choice="receipt" v-model:email="email" />
      </template>

      <!-- With the keypad, the error sits in the left column (above the buttons, without scrolling at 768px) -->
      <ErrorBanner v-if="error && !usesKeypad" :message="error" class="mt-4" />
    </div>

    <template #actions>
      <AppButton variant="outlined" size="xl" :disabled="busy" @click="$emit('close')">Back</AppButton>
      <AppButton size="xl" :disabled="!canComplete" :loading="busy" @click="complete">
        {{ busy ? 'Completing…' : completeLabel }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Payment dialog at the register: Cash (quick amounts, keypad, change), Card (whole amount on the reader), Split
// (the cash part, the rest on the card), Account (house account, member's PIN), and the receipt choice.
//   <TenderModal :total-cents="4500" :card-blocked="null" :drawer-open="drawer.open" :reader-online="reader.online"
//     initial-method="CASH" @complete="pay" @close="tendering = false" />
// Props: totalCents, defaultEmail, busy, error (shown above the buttons), cardBlocked (why cards aren't available,
// null = they are), account (the attached customer's house account summary) + accountName,
//   drawerOpen (default true): false → Cash/Split show "Open the cash drawer to take cash" and the dialog opens on
//     Card when it can (the server still refuses cash with DRAWER_CLOSED, which the register handles),
//   readerOnline (true | false | null = unknown, default null): false → Card and Split disabled ("Card reader offline"),
//   initialMethod ('CASH' | 'CARD' | 'SPLIT' | 'ACCOUNT', default null): preselects the method if it's available.
// Keys: digits type on the keypad; Enter completes, and Enter with nothing typed takes the exact amount in cash.
// Emits complete({ payments, accountPin, print, receiptEmail }) (unchanged) and close.
import { ref, computed, nextTick, watch } from 'vue'
import { formatCents, dollarsToCents } from '@/lib/money'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import ReceiptChoice from './ReceiptChoice.vue'
import { trimCents, keypadDollars, centsToKeypad } from './keypadMoney.js'
import IconCash from '~icons/material-symbols/payments-rounded'
import IconCard from '~icons/material-symbols/credit-card-rounded'
import IconSplit from '~icons/material-symbols/call-split-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'
import IconContactless from '~icons/material-symbols/contactless-rounded'

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
  // Is the cash drawer open? (false: warn on cash and start on Card)
  drawerOpen: { type: Boolean, default: true },
  // Is the card reader online? null = unknown (Card stays enabled)
  readerOnline: { type: Boolean, default: null },
  // Preselected method: 'CASH' | 'CARD' | 'SPLIT' | 'ACCOUNT'
  initialMethod: { type: String, default: null },
})
const emit = defineEmits(['complete', 'close'])

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
const cardReason = computed(() => props.cardBlocked || (props.readerOnline === false ? 'Card reader offline' : null))
const splitReason = computed(() => cardReason.value || (props.totalCents < 100 ? 'Split needs a total of $1.00 or more' : null))

const methodOptions = computed(() => [
  { value: 'cash', label: 'Cash', icon: IconCash },
  { value: 'card', label: 'Card', icon: IconCard, disabled: !!cardReason.value },
  { value: 'split', label: 'Split', icon: IconSplit, disabled: !!splitReason.value },
  { value: 'account', label: 'Account', icon: IconWallet, disabled: !!accountBlocked.value },
])
// Say why Card / Account are greyed out (Account only once a member with an account is attached)
const unavailableNote = computed(() => [
  cardReason.value && `Card: ${cardReason.value}`,
  props.account && accountBlocked.value && `Account: ${accountBlocked.value}`,
].filter(Boolean).join(' · '))

const ALIASES = { CASH: 'cash', CARD: 'card', CARD_TERMINAL: 'card', SPLIT: 'split', ACCOUNT: 'account', HOUSE_ACCOUNT: 'account' }
function startMethod() {
  const wanted = ALIASES[String(props.initialMethod || '').toUpperCase()]
  const available = m => !methodOptions.value.find(o => o.value === m)?.disabled
  if (wanted && available(wanted)) return wanted
  if (!props.drawerOpen && available('card')) return 'card'
  return 'cash'
}

const method     = ref(startMethod()) // cash | card | split | account
const accountPin = ref('')
// Cash received (cash), or the cash part (split): the typed dollars text
const tendered   = ref('')
const receipt    = ref('print') // none | print | email
const email      = ref(props.defaultEmail)
const keypad     = ref(null)

const usesCash   = computed(() => method.value === 'cash' || method.value === 'split')
const usesKeypad = computed(() => props.totalCents > 0 && method.value !== 'card')

const tenderedCents = computed(() => dollarsToCents(tendered.value) || 0)
// Split: the cash part is what's typed, the card takes the rest
const cardCents = computed(() => {
  if (method.value === 'card') return props.totalCents
  if (method.value === 'split') return props.totalCents - tenderedCents.value
  return 0
})
const cashDueCents = computed(() => (method.value === 'account' ? 0 : props.totalCents - cardCents.value))
const splitValid   = computed(() => tenderedCents.value > 0 && cardCents.value >= 50)

function setMethod(m) {
  method.value = m
  tendered.value = ''
  accountPin.value = ''
  nextTick(() => keypad.value?.focus())
}

// The selected method can become unavailable (reader goes offline): fall back to cash
watch(methodOptions, opts => {
  if (opts.find(o => o.value === method.value)?.disabled) setMethod('cash')
})

// Cash: exact, then the next round amounts customers usually hand over. Split: round cash parts that leave
// at least $0.50 for the card.
const quickAmounts = computed(() => {
  const t = props.totalCents
  if (method.value === 'split') return [500, 1000, 2000, 5000, 10000].filter(a => a <= t - 50).slice(0, 4)
  const amounts = [t]
  for (const step of [500, 1000, 2000, 5000, 10000]) {
    const next = Math.ceil(t / step) * step
    if (next > t && !amounts.includes(next)) amounts.push(next)
  }
  return amounts.slice(0, 6)
})

// "$20" for whole dollars (fits the button), "$42.37" otherwise
const quickLabel = cents => (cents % 100 ? formatCents(cents) : `$${(cents / 100).toLocaleString('en-US')}`)

function pickQuick(cents) {
  tendered.value = centsToKeypad(cents)
  keypad.value?.focus()
}

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))

const canComplete = computed(() => {
  if (props.busy) return false
  if (receipt.value === 'email' && !emailValid.value) return false
  if (props.totalCents === 0) return true
  if (method.value === 'card') return !cardReason.value && props.totalCents >= 50
  if (method.value === 'account') return !accountBlocked.value && /^\d{4,6}$/.test(accountPin.value)
  if (method.value === 'split') return !splitReason.value && splitValid.value
  return tenderedCents.value >= props.totalCents
})

const completeLabel = computed(() => {
  if (method.value === 'cash' || props.totalCents === 0) return 'Complete sale'
  if (method.value === 'account') return 'Charge account'
  return method.value === 'split' ? `Charge ${formatCents(cardCents.value)} to card` : 'Charge card'
})

// Enter with nothing typed = the exact amount in cash (the keypad itself submits only when something is typed)
function onEnter() {
  if (method.value !== 'cash' || tendered.value !== '') return
  tendered.value = centsToKeypad(props.totalCents)
  if (canComplete.value) complete()
}

function payments() {
  if (props.totalCents === 0) return []
  if (method.value === 'account') return [{ method: 'HOUSE_ACCOUNT' }]
  const list = []
  if (cardCents.value > 0) list.push({ method: 'CARD_TERMINAL', amountCents: cardCents.value })
  if (cashDueCents.value > 0) list.push({ method: 'CASH', tenderedCents: tenderedCents.value })
  return list
}

function complete() {
  if (!canComplete.value) return
  emit('complete', {
    payments: payments(),
    accountPin: method.value === 'account' ? accountPin.value : null,
    print: receipt.value === 'print',
    receiptEmail: receipt.value === 'email' ? email.value.trim() : null,
  })
}
</script>
