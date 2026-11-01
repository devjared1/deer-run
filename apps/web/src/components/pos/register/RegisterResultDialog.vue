<template>
  <ResultDialog
    :open="!!result"
    :title="view.title"
    :amount="view.amount"
    :amount-label="view.amountLabel"
    :icon="view.icon"
    :print-label="view.printLabel"
    :done-label="view.doneLabel"
    @print="emit('print')"
    @done="emit('done')"
  >
    <template v-if="shown?.kind === 'sale'">
      <p v-for="w in shown.warnings" :key="w" class="flex items-start gap-2 text-left text-on-surface">
        <IconWarning class="w-5 h-5 flex-none mt-px text-error" aria-hidden="true" />{{ w }}
      </p>
      <p v-if="shown.membershipUntil" class="text-secondary">Membership active through {{ shown.membershipUntil }}</p>
      <p v-if="shown.emailError" class="text-error">Receipt email failed: {{ shown.emailError }}</p>
      <p v-else-if="shown.emailedTo">Receipt emailed to {{ shown.emailedTo }}</p>
    </template>

    <template v-else-if="shown?.kind === 'refund'">
      <p v-if="shown.refund.method === 'HOUSE_ACCOUNT'">It shows on the member's next statement.</p>
      <p v-else-if="shown.refund.method === 'CARD_TERMINAL'">It shows on the customer's statement in 5–10 days.</p>
      <p v-else>Cash from the drawer.</p>
      <p v-for="w in shown.warnings" :key="w" class="flex items-start gap-2 text-left text-on-surface">
        <IconWarning class="w-5 h-5 flex-none mt-px text-error" aria-hidden="true" />{{ w }}
      </p>
      <p v-if="shown.memberUntil" class="text-secondary">
        {{ shown.memberUntil.ended ? 'Membership ended' : 'Membership now runs through' }} {{ shown.memberUntil.label }}
      </p>
    </template>

    <template v-else-if="shown?.kind === 'drawer'">
      <p class="text-on-surface">Expected {{ formatCents(shown.session.expectedCents) }} · counted {{ formatCents(shown.session.countedCents) }}</p>
      <p class="text-body-s">
        Start {{ formatCents(shown.session.openingFloatCents) }} + cash taken {{ formatCents(shown.session.cashSalesCents) }}
        − cash refunds {{ formatCents(shown.session.cashRefundsCents) }}
        <template v-if="shown.session.paidInCents"> + paid in {{ formatCents(shown.session.paidInCents) }}</template>
        <template v-if="shown.session.paidOutCents"> − paid out {{ formatCents(shown.session.paidOutCents) }}</template>
        <template v-if="shown.session.safeDropCents"> − safe drops {{ formatCents(shown.session.safeDropCents) }}</template>
      </p>
    </template>

    <template v-else-if="shown?.kind === 'accountPayment'">
      <p class="text-title-m text-on-surface">{{ shown.memberName }}</p>
      <p v-if="shown.changeCents">Paid {{ formatCents(-shown.payment.amountCents) }}</p>
      <p>New balance {{ formatCents(shown.payment.balanceCents) }}</p>
    </template>

    <template #extra>
      <template v-if="shown?.kind === 'sale'">
        <form class="flex items-start gap-2" @submit.prevent="sendEmail">
          <TextField
            v-model="email"
            class="flex-1 min-w-0"
            label="Email receipt to"
            type="email"
            autocomplete="off"
            :disabled="shown.sending"
          />
          <AppButton type="submit" variant="tonal" size="lg" class="mt-1" :icon="IconSend" :loading="shown.sending" :disabled="!email.trim()">
            Send
          </AppButton>
        </form>
        <AppButton v-if="shown.checkIn" variant="tonal" size="lg" block :icon="IconGolf" @click="emit('teesheet')">
          Back to tee sheet
        </AppButton>
      </template>
    </template>
  </ResultDialog>
</template>

<script setup>
// The one result dialog for the register: sale complete, void/refund done, drawer closed, account payment received.
// Big amount, notes, Print and Done (persistent; Done has the focus, so Enter moves on).
// result: { kind: 'sale', sale, warnings, membershipUntil, emailedTo, emailError, sending, checkIn }
//       | { kind: 'refund', sale, refund, warnings, memberUntil: { label, ended } | null }
//       | { kind: 'drawer', session }
//       | { kind: 'accountPayment', payment, changeCents, memberName }
// Emits print, done, email(address) (sale), teesheet (sale after a tee sheet check-in or booking).
import { computed, ref, watch } from 'vue'
import { formatCents } from '@/lib/money'
import ResultDialog from '@/components/ui/ResultDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import TextField from '@/components/ui/TextField.vue'
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded'
import IconUndo from '~icons/material-symbols/undo-rounded'
import IconCalculate from '~icons/material-symbols/calculate-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconSend from '~icons/material-symbols/send-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'

const props = defineProps({
  result: { type: Object, default: null },
})
const emit = defineEmits(['print', 'done', 'email', 'teesheet'])

const email = ref('')
watch(() => props.result?.sale?.id, () => { email.value = '' })
// Clear the field once the parent reports the receipt went out
watch(() => props.result?.emailedTo, to => { if (to) email.value = '' })

function sendEmail() {
  if (email.value.trim() && !props.result?.sending) emit('email', email.value.trim())
}

// The last result stays on screen while the dialog fades out
const last = ref(null)
watch(() => props.result, r => { if (r) last.value = r }, { immediate: true })

const shown = computed(() => props.result ?? last.value)

const view = computed(() => {
  const r = shown.value
  if (!r) return { title: '' }
  if (r.kind === 'sale') {
    return {
      title: `Sale #${r.sale.number} complete`,
      icon: IconCheckCircle,
      amountLabel: r.sale.changeCents ? 'Change due' : 'Total',
      amount: r.sale.changeCents || r.sale.totalCents,
      printLabel: 'Print receipt',
      doneLabel: 'New sale',
    }
  }
  if (r.kind === 'refund') {
    const label = { HOUSE_ACCOUNT: 'Credited to the house account', CARD_TERMINAL: 'Refunded to the card' }[r.refund.method] ?? 'Give the customer'
    return {
      title: `Sale #${r.sale.number} ${r.refund.kind === 'VOID' ? 'voided' : 'refunded'}`,
      icon: IconUndo,
      amountLabel: label,
      amount: r.refund.amountCents,
      printLabel: 'Print refund slip',
      doneLabel: 'Done',
    }
  }
  if (r.kind === 'drawer') {
    const os = r.session.overShortCents
    return {
      title: 'Drawer closed',
      icon: IconCalculate,
      amountLabel: os === 0 ? 'Balanced' : os > 0 ? 'Over' : 'Short',
      amount: Math.abs(os),
      printLabel: 'Print close slip',
      doneLabel: 'Done',
    }
  }
  return {
    title: 'Account payment received',
    icon: IconWallet,
    amountLabel: r.changeCents ? 'Change due' : 'Paid',
    amount: r.changeCents || -r.payment.amountCents,
    printLabel: 'Print receipt',
    doneLabel: 'Done',
  }
})
</script>
