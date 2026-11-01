<template>
  <AppDialog :open="true" :title="`${isVoid ? 'Void' : 'Refund'} sale #${sale.number}`" size="lg" persistent>
    <div class="font-body text-on-surface">
      <p class="text-body-m text-on-surface-variant mb-3">
        <template v-if="isVoid">Cancels the whole sale and returns tracked items to stock.</template>
        <template v-else>Choose what's being returned.</template>
      </p>

      <!-- Items -->
      <ul class="divide-y divide-outline-variant border-y border-outline-variant">
        <li v-for="(row, i) in rows" :key="row.item.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <div class="min-w-[10rem] flex-1">
            <div class="text-body-l">{{ row.item.description }}</div>
            <div class="text-body-s text-on-surface-variant">
              {{ row.item.quantity }} sold<template v-if="row.item.refundedQuantity"> · {{ row.item.refundedQuantity }} already refunded</template>
            </div>
          </div>
          <div class="flex items-center gap-1 ml-auto">
            <template v-if="!isVoid && row.remaining > 0">
              <!-- focusable-when-disabled: these disable themselves at the limit while focused (keyboard focus stays put) -->
              <IconButton :icon="IconRemove" variant="outlined" :label="`One fewer ${row.item.description}`" :disabled="row.quantity === 0" focusable-when-disabled @click="row.quantity--" />
              <span class="w-8 text-center text-title-m tabular-nums" aria-live="polite">{{ row.quantity }}</span>
              <IconButton :icon="IconAdd" variant="outlined" :label="`One more ${row.item.description}`" :disabled="row.quantity >= row.remaining" focusable-when-disabled @click="row.quantity++" />
              <AppButton variant="text" :aria-label="`Refund all ${row.item.description}`" :disabled="row.quantity === row.remaining" focusable-when-disabled @click="row.quantity = row.remaining">All</AppButton>
            </template>
            <span v-else-if="isVoid" class="text-body-m text-on-surface-variant tabular-nums">× {{ row.remaining }}</span>
            <span v-else class="text-body-s text-on-surface-variant">Fully refunded</span>
            <span class="w-20 text-right text-body-l tabular-nums">{{ row.quantity ? formatCents(previews[i].amountCents) : '—' }}</span>
          </div>
        </li>
      </ul>

      <Checkbox v-if="!isVoid" v-model="restock" label="Return items to stock" helper="Untick for damaged items" class="mt-3" />

      <!-- Reason -->
      <div class="mt-4">
        <div class="text-label-l text-on-surface-variant" aria-hidden="true">Reason</div>
        <ChipGroup v-model="reasonChoice" type="choice" size="lg" label="Reason" :options="reasonOptions" />
        <TextField
          v-if="reasonChoice === OTHER"
          v-model="otherReason"
          label="What happened?"
          maxlength="200"
          required
          class="mt-2"
        />
      </div>

      <!-- Where the money goes: back the way it was paid -->
      <div v-if="cardAvailable > 0 || accountAvailable > 0" class="mt-4">
        <div class="text-label-l text-on-surface-variant mb-1" aria-hidden="true">Refund to</div>
        <SegmentedButton v-model="method" :options="methodOptions" label="Refund to" size="lg" block />
        <p class="mt-1 text-body-s text-on-surface-variant">
          Up to {{ formatCents(limit) }} {{ { CARD_TERMINAL: 'back to the card', HOUSE_ACCOUNT: 'back to the house account' }[method] ?? 'in cash' }}<template v-if="method === 'CASH'">. Cash refunds need an open drawer</template>.
        </p>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3 rounded-shape-md bg-surface-container-highest px-4 py-3">
        <span class="text-body-l text-on-surface-variant">{{ { CARD_TERMINAL: 'Back to the card', HOUSE_ACCOUNT: 'Credit to the house account' }[method] ?? 'Cash to give back' }}</span>
        <span class="font-display text-headline-m tabular-nums">{{ formatCents(totalCents) }}</span>
      </div>

      <ErrorBanner
        v-if="overLimit"
        tone="warning"
        :message="`Only ${formatCents(limit)} can go back ${{ CARD_TERMINAL: 'to the card', HOUSE_ACCOUNT: 'to the account' }[method] ?? 'in cash'}. Refund fewer items this way.`"
        class="mt-3"
      />
      <ErrorBanner v-if="error" :message="error" class="mt-3" />
      <p class="mt-3 text-body-s text-on-surface-variant text-right">A manager approves before anything is refunded.</p>
    </div>

    <template #actions>
      <AppButton variant="outlined" size="xl" :disabled="busy" @click="$emit('cancel')">Cancel</AppButton>
      <AppButton size="xl" :variant="isVoid ? 'danger' : 'filled'" :disabled="!canSubmit" :loading="busy" @click="submit">
        {{ busy ? 'Working…' : isVoid ? 'Void sale' : 'Refund' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Void or refund a sale: quantities per line (48dp ±), restock, reason chips (Other → text), refund-to (money goes back
// the way it was paid: what's left of the card, house account or cash payments; cash needs an open drawer, which
// the server checks). A manager approves afterwards (the register opens ApprovalModal).
//   <RefundModal :sale="sale" mode="refund" :busy="busy" :error="error" @submit="refund" @cancel="close" />
// Props: sale, mode 'void' | 'refund', busy, error. Emits submit({ items, restock, reason, totalCents, method }), cancel.
import { ref, computed } from 'vue'
import { formatCents } from '@/lib/money'
import { refundForLine } from '@/lib/pricing'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import TextField from '@/components/ui/TextField.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconRemove from '~icons/material-symbols/remove-rounded'
import IconCard from '~icons/material-symbols/credit-card-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'
import IconCash from '~icons/material-symbols/payments-rounded'

const props = defineProps({
  sale: { type: Object, required: true },
  mode: { type: String, required: true }, // 'void' | 'refund'
  busy: { type: Boolean, default: false },
  error: { type: String, default: null },
})
const emit = defineEmits(['submit', 'cancel'])

const isVoid = computed(() => props.mode === 'void')

const rows = ref(props.sale.items.map(item => ({
  item,
  remaining: item.quantity - item.refundedQuantity,
  quantity: props.mode === 'void' ? item.quantity - item.refundedQuantity : 0,
})))
// Preview per row, worked out the same way as the database
const previews = computed(() => rows.value.map(r => (r.quantity ? refundForLine(r.item, r.quantity) : { amountCents: 0, taxCents: 0 })))

const restock = ref(true)

// Reason: a chip's text, or what's typed under Other
const OTHER = 'Other'
const reasonOptions = computed(() => (isVoid.value
  ? ['Rang wrong', 'Changed mind', OTHER]
  : ['Wrong size', 'Defective', 'Rang wrong', 'Changed mind', OTHER]
).map(r => ({ value: r, label: r })))
const reasonChoice = ref(null)
const otherReason  = ref('')
const reason = computed(() => (reasonChoice.value === OTHER ? otherReason.value.trim() : reasonChoice.value || ''))

const totalCents = computed(() => previews.value.reduce((sum, p) => sum + p.amountCents, 0))
// Money goes back the way it was paid: what's left of the card payment, and of the cash
const sumBy = (list, method) => list.filter(x => x.method === method).reduce((sum, x) => sum + x.amountCents, 0)
const cardAvailable = computed(() => Math.max(0, sumBy(props.sale.payments, 'CARD_TERMINAL') - sumBy(props.sale.refunds ?? [], 'CARD_TERMINAL')))
const cashAvailable = computed(() => Math.max(0, sumBy(props.sale.payments, 'CASH') - sumBy(props.sale.refunds ?? [], 'CASH')))
const accountAvailable = computed(() => Math.max(0, sumBy(props.sale.payments, 'HOUSE_ACCOUNT') - sumBy(props.sale.refunds ?? [], 'HOUSE_ACCOUNT')))
const method = ref(cardAvailable.value > 0 ? 'CARD_TERMINAL' : accountAvailable.value > 0 ? 'HOUSE_ACCOUNT' : 'CASH')
const limit = computed(() => ({ CARD_TERMINAL: cardAvailable.value, HOUSE_ACCOUNT: accountAvailable.value }[method.value] ?? cashAvailable.value))
const overLimit = computed(() => totalCents.value > limit.value)

const methodOptions = computed(() => [
  cardAvailable.value > 0 && { value: 'CARD_TERMINAL', label: 'Card', icon: IconCard },
  accountAvailable.value > 0 && { value: 'HOUSE_ACCOUNT', label: 'House account', icon: IconWallet },
  cashAvailable.value > 0 && { value: 'CASH', label: 'Cash', icon: IconCash },
].filter(Boolean))

const canSubmit = computed(() => !props.busy && reason.value && rows.value.some(r => r.quantity > 0) && !overLimit.value)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    items: rows.value.filter(r => r.quantity > 0).map(r => ({ saleItemId: r.item.id, quantity: r.quantity })),
    restock: restock.value,
    reason: reason.value,
    totalCents: totalCents.value,
    method: method.value,
  })
}
</script>
