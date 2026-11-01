<template>
  <AppDialog
    :open="open"
    :title="title"
    :icon="icon"
    size="sm"
    persistent
    @update:open="emit('update:open', $event)"
    @after-leave="emit('after-leave')"
  >
    <div class="text-center">
      <p v-if="amountLabel" class="text-label-l text-on-surface-variant">{{ amountLabel }}</p>
      <p v-if="amount != null && amount !== ''" class="font-display text-display-m text-primary tabular-nums">{{ amountText }}</p>
      <div v-if="$slots.default" class="mt-4 space-y-2 text-body-m text-on-surface-variant">
        <slot />
      </div>
    </div>
    <template #actions>
      <div class="flex flex-col w-full gap-2">
        <slot name="extra" />
        <AppButton v-if="printable" variant="outlined" size="lg" block :icon="IconPrint" @click="emit('print')">
          {{ printLabel }}
        </AppButton>
        <AppButton variant="gold" size="lg" block data-autofocus @click="done">{{ doneLabel }}</AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<script setup>
// POS result ("Sale complete", "Refund issued", "Drawer closed"): a big amount, notes, Print and Done. Persistent:
// only Done closes it (Done has the initial focus, so Enter starts the next sale).
//
//   <ResultDialog v-model:open="done" title="Sale #1042 complete" amount-label="Change due" :amount="sale.changeCents"
//                 @print="printReceipt" @done="startNewSale">
//     <p>Receipt emailed to jane@example.com</p>
//     <template #extra>…email field…</template>
//   </ResultDialog>
//
// Props: open (v-model), title, amount (Number = cents, formatted as $; String is shown as-is), amountLabel,
// icon (default check_circle), printable (default true), printLabel, doneLabel.
// Slots: default (lines and notes under the amount), extra (an extra action above Print).
// Emits: print, done (also closes: update:open false), after-leave.
import { computed } from 'vue'
import AppDialog from './AppDialog.vue'
import AppButton from './AppButton.vue'
import { formatCents } from '@/lib/money.js'
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'

const props = defineProps({
  open:        { type: Boolean, default: false },
  title:       { type: String, required: true },
  amount:      { type: [Number, String], default: null },
  amountLabel: { type: String, default: '' },
  icon:        { type: [Object, Function], default: () => IconCheckCircle },
  printable:   { type: Boolean, default: true },
  printLabel:  { type: String, default: 'Print receipt' },
  doneLabel:   { type: String, default: 'Done' },
})
const emit = defineEmits(['update:open', 'print', 'done', 'after-leave'])

const amountText = computed(() => (typeof props.amount === 'number' ? formatCents(props.amount) : props.amount))

function done() {
  emit('done')
  emit('update:open', false)
}
</script>
