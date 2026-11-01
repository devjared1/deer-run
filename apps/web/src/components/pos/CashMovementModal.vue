<template>
  <AppDialog :open="true" :title="copy.title" :icon="copy.icon" size="lg" persistent initial-focus="[data-autofocus]">
    <div class="font-body">
      <p class="text-center text-body-m text-on-surface-variant mb-4">{{ copy.help }}</p>

      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] items-start">
        <div class="min-w-0 space-y-3 sm:pt-1">
          <template v-if="type === 'PAID_OUT'">
            <TextField v-model="reason" label="What for" required maxlength="300" placeholder="e.g. Ice for the beverage cart" />
            <TextField v-model="recipient" label="Paid to (optional)" maxlength="300" placeholder="e.g. Ice delivery driver" />
          </template>
          <TextField v-else v-model="reason" label="Note (optional)" maxlength="300" :placeholder="copy.placeholder" />

          <div class="rounded-shape-md bg-surface-container-highest px-4 py-3 flex items-center justify-between gap-3">
            <span class="text-body-l text-on-surface-variant">{{ copy.amountLabel }}</span>
            <span class="font-display text-headline-m text-on-surface tabular-nums">{{ cents > 0 ? formatCents(cents) : '—' }}</span>
          </div>
          <p class="text-body-s text-on-surface-variant">A manager approves, then the drawer opens and a slip prints.</p>
        </div>

        <div class="w-full max-w-[22rem] mx-auto sm:w-[22rem] rounded-shape-lg bg-surface-container-lowest p-2">
          <NumericKeypad
            :model-value="amount"
            data-autofocus
            label="Amount"
            placeholder="$0.00"
            left-key="."
            :max-length="9"
            :format="keypadDollars"
            @update:model-value="v => amount = trimCents(v)"
            @submit="submit"
          />
        </div>
      </div>

      <ErrorBanner v-if="error" :message="error" class="mt-4" />
    </div>

    <template #actions>
      <AppButton variant="outlined" size="xl" :disabled="busy" @click="$emit('cancel')">Cancel</AppButton>
      <AppButton size="xl" :disabled="!canSubmit" :loading="busy" @click="submit">
        {{ busy ? 'Working…' : copy.button }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Paid in / paid out / safe drop on the open cash drawer: amount on the keypad (the physical keyboard types too;
// Enter submits), reason (required for a paid out) and "paid to". The register then asks a manager to approve.
//   <CashMovementModal type="PAID_OUT" :busy="busy" :error="error" @submit="record" @cancel="close" />
// Props: type 'PAID_IN' | 'PAID_OUT' | 'SAFE_DROP', busy, error. Emits submit({ amountCents, reason, recipient }), cancel.
import { ref, computed } from 'vue'
import { dollarsToCents, formatCents } from '@/lib/money'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import TextField from '@/components/ui/TextField.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import { trimCents, keypadDollars } from './keypadMoney.js'
import IconPaidIn from '~icons/material-symbols/move-to-inbox-rounded'
import IconPaidOut from '~icons/material-symbols/outbox-rounded'
import IconSafe from '~icons/material-symbols/savings-rounded'

const props = defineProps({
  type: { type: String, required: true }, // 'PAID_IN' | 'PAID_OUT' | 'SAFE_DROP'
  busy: { type: Boolean, default: false },
  error: { type: String, default: null },
})
const emit = defineEmits(['submit', 'cancel'])

const COPY = {
  PAID_IN: {
    title: 'Paid in',
    icon: IconPaidIn,
    help: 'Cash added to the drawer that isn\'t a sale, e.g. more change from the safe.',
    placeholder: 'e.g. Change from the safe',
    amountLabel: 'Into the drawer',
    button: 'Record paid in',
  },
  PAID_OUT: {
    title: 'Paid out',
    icon: IconPaidOut,
    help: 'Cash taken from the drawer to pay for something. Keep the receipt with the slip.',
    placeholder: '',
    amountLabel: 'Out of the drawer',
    button: 'Record paid out',
  },
  SAFE_DROP: {
    title: 'Safe drop',
    icon: IconSafe,
    help: 'Extra cash moved from the drawer to the safe.',
    placeholder: 'e.g. Bag #12',
    amountLabel: 'To the safe',
    button: 'Record safe drop',
  },
}
const copy = computed(() => COPY[props.type])

const amount    = ref('')
const reason    = ref('')
const recipient = ref('')

const cents = computed(() => dollarsToCents(amount.value) || 0)
const canSubmit = computed(() => !props.busy && Number.isInteger(cents.value) && cents.value > 0 && (props.type !== 'PAID_OUT' || reason.value.trim()))

function submit() {
  if (!canSubmit.value) return
  emit('submit', { amountCents: cents.value, reason: reason.value.trim(), recipient: recipient.value.trim() })
}
</script>
