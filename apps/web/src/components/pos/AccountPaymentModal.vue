<template>
  <AppDialog :open="true" title="House account payment" size="md" persistent>
    <div class="font-body text-on-surface space-y-4">
      <!-- Who's paying -->
      <!-- inline: the results list sits in the dialog body rather than floating, so the dialog's scroll can't clip it -->
      <div v-if="!member">
        <p class="text-body-m text-on-surface-variant mb-3">Find the member paying toward their house account.</p>
        <CustomerSearch label="Member" placeholder="Search name or email" inline autofocus @select="choose" />
        <ErrorBanner v-if="error" :message="error" class="mt-3" />
      </div>

      <template v-else>
        <div class="flex items-center justify-between gap-3 rounded-shape-md bg-surface-container-highest pl-4 pr-1 py-2">
          <div class="min-w-0">
            <div class="text-title-m truncate">{{ member.name || member.email }}</div>
            <div class="text-body-m text-on-surface-variant">Balance {{ formatCents(member.houseAccount.balanceCents) }}</div>
          </div>
          <AppButton variant="text" :disabled="busy" @click="member = null">Change</AppButton>
        </div>

        <MoneyField v-model="amountCents" label="Payment" :min="1" required />

        <div>
          <SegmentedButton v-model="method" :options="methodOptions" label="Paid with" size="lg" block />
          <p v-if="cardBlocked" class="mt-1 text-body-s text-on-surface-variant">Card: {{ cardBlocked }}</p>
        </div>

        <template v-if="method === 'CASH'">
          <MoneyField v-model="tenderedInput" label="Cash received" helper="Leave empty for the exact amount" :min="0" />
          <p v-if="changeCents > 0" class="text-headline-s text-primary text-center" aria-live="polite">
            Change <strong class="tabular-nums">{{ formatCents(changeCents) }}</strong>
          </p>
          <p v-else-if="shortCents > 0" class="text-title-m text-error text-center">{{ formatCents(shortCents) }} short</p>
        </template>
      </template>

      <ErrorBanner v-if="error && member" :message="error" />
    </div>

    <template #actions>
      <AppButton variant="outlined" size="xl" :disabled="busy" @click="$emit('close')">Cancel</AppButton>
      <AppButton size="xl" :disabled="!canSubmit" :loading="busy" @click="submit">
        {{ busy ? 'Working…' : method === 'CARD' ? 'Charge card' : 'Take payment' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// A member pays toward their house account at the register: pick the member (CustomerSearch over
// /api/staff/register/customers), the amount (defaults to the balance) and Cash / Card.
// POST /api/staff/account-payments → cash: done; card: the parent shows CardPaymentModal.
//   <AccountPaymentModal :register-id="id" :customer="customer" :card-blocked="reason" @done="…" @card="…" @close="…" />
// Props: registerId, customer (the sale's customer, if they have an account), cardBlocked (why cards aren't available).
// Emits done({ accountPayment, changeCents, member }), card({ cardCheckout, member, amountCents }),
// close() / close({ drawerClosed: true }) when cash was refused because the drawer is closed.
import { ref, computed } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import CustomerSearch from '@/components/ui/CustomerSearch.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconCash from '~icons/material-symbols/payments-rounded'
import IconCard from '~icons/material-symbols/credit-card-rounded'

const props = defineProps({
  registerId:  { type: String, required: true },
  customer:    { type: Object, default: null }, // the customer attached to the sale, if they have an account
  cardBlocked: { type: String, default: null },
})
// done: { accountPayment, changeCents, member } (cash) · card: { cardCheckout, member, amountCents } (card on the reader)
const emit = defineEmits(['done', 'card', 'close'])

const balanceOf = m => Math.max(0, m.houseAccount.balanceCents)

const member        = ref(props.customer?.houseAccount ? props.customer : null)
const amountCents   = ref(member.value ? balanceOf(member.value) : null)
const method        = ref('CASH')
const tenderedInput = ref(null) // null = exact
const busy          = ref(false)
const error         = ref(null)

const methodOptions = computed(() => [
  { value: 'CASH', label: 'Cash', icon: IconCash },
  { value: 'CARD', label: 'Card', icon: IconCard, disabled: !!props.cardBlocked },
])

const amount        = computed(() => amountCents.value || 0)
const tenderedCents = computed(() => (tenderedInput.value === null ? amount.value : tenderedInput.value))
const changeCents   = computed(() => Math.max(0, tenderedCents.value - amount.value))
const shortCents    = computed(() => Math.max(0, amount.value - tenderedCents.value))
const canSubmit = computed(() => !busy.value && member.value && amount.value > 0 &&
  (method.value === 'CARD' ? amount.value >= 50 && !props.cardBlocked : tenderedCents.value >= amount.value))

function choose(u) {
  error.value = null
  if (!u.houseAccount) { error.value = `${u.name || u.email} has no house account.`; return }
  if (u.houseAccount.status === 'CLOSED') { error.value = `${u.name || u.email}'s house account is closed.`; return }
  member.value = u
  amountCents.value = balanceOf(u)
}

async function submit() {
  if (!canSubmit.value) return
  busy.value  = true
  error.value = null
  try {
    const res = await apiFetch('/api/staff/account-payments', {
      method: 'POST',
      body: {
        registerId: props.registerId,
        accountId: member.value.houseAccount.id,
        amountCents: amount.value,
        method: method.value,
        tenderedCents: method.value === 'CASH' ? tenderedCents.value : undefined,
      },
    })
    if (res.cardCheckout) emit('card', { cardCheckout: res.cardCheckout, member: member.value, amountCents: amount.value })
    else emit('done', { accountPayment: res.accountPayment, changeCents: res.changeCents, member: member.value })
  } catch (e) {
    error.value = e.message
    if (e.code === 'DRAWER_CLOSED') emit('close', { drawerClosed: true })
  } finally {
    busy.value = false
  }
}
</script>
