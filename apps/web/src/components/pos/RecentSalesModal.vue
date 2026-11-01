<template>
  <AppDialog
    :open="true"
    size="lg"
    fullscreen-on-mobile
    :aria-label="selected ? `Sale #${selected.number}` : 'Recent sales'"
    @update:open="v => !v && emit('close')"
  >
    <template #title>
      <span v-if="!selected">Recent sales</span>
      <span v-else class="flex items-center gap-2">
        <IconButton :icon="IconBack" label="Back to the list" class="-ml-3" @click="selected = null" />
        <span>Sale #{{ selected.number }}</span>
        <StatusChip v-if="selected.status !== 'COMPLETED'" kind="sale" :status="selected.status" size="sm" />
      </span>
    </template>

    <!-- List -->
    <template v-if="!selected">
      <div class="flex flex-wrap items-start gap-3 mb-3">
        <form class="flex items-start gap-2 w-full sm:w-auto" @submit.prevent="load">
          <TextField
            v-model="number"
            class="flex-1 sm:w-40"
            label="Receipt #"
            inputmode="numeric"
            autocomplete="off"
            enterkeyhint="search"
          />
          <IconButton type="submit" :icon="IconSearch" label="Find receipt" variant="tonal" class="mt-1" />
        </form>
        <SegmentedButton
          v-model="scope"
          size="lg"
          label="Registers"
          class="sm:ml-auto"
          :options="[{ value: 'register', label: registerName || 'This register' }, { value: 'all', label: 'All registers' }]"
          @update:model-value="number = ''; load()"
        />
      </div>
      <p class="mb-2 text-label-l text-on-surface-variant">{{ number.trim() ? `Receipt #${number.trim()}` : 'Today' }}</p>

      <ErrorBanner v-if="error" :message="error" class="mb-3" @retry="load" />
      <Skeleton v-if="loading" variant="text" :lines="6" label="Loading sales" />
      <ul v-else-if="sales.length" class="divide-y divide-outline-variant rounded-shape-md border border-outline-variant overflow-hidden">
        <li v-for="s in sales" :key="s.id">
          <button
            type="button"
            class="state-layer w-full min-h-14 px-4 py-2 flex items-center gap-4 text-left text-body-l text-on-surface cursor-pointer"
            @click="open(s.id)"
          >
            <span class="w-16 flex-none text-title-s tabular-nums">#{{ s.number }}</span>
            <span class="w-20 flex-none text-body-m text-on-surface-variant tabular-nums">{{ formatTime(s.createdAt) }}</span>
            <span class="flex-1 min-w-0 truncate text-body-m">{{ s.customer?.name || s.customer?.email || 'Walk-in' }}</span>
            <StatusChip v-if="s.status !== 'COMPLETED'" kind="sale" :status="s.status" size="sm" class="max-sm:hidden" />
            <span class="w-24 flex-none text-right tabular-nums">{{ formatCents(s.totalCents) }}</span>
          </button>
        </li>
      </ul>
      <EmptyState v-else-if="!error" compact :icon="IconReceipt" title="No sales found" />
    </template>

    <!-- Detail -->
    <template v-else>
      <p class="text-body-m text-on-surface-variant mb-3">
        {{ formatWhen(selected.createdAt) }} · {{ selected.register?.name }} · {{ selected.cashier?.firstName }}
        <template v-if="selected.customer"> · {{ selected.customer.name || selected.customer.email }}</template>
      </p>

      <table class="w-full text-body-m text-on-surface">
        <caption class="sr-only">Items</caption>
        <tbody class="divide-y divide-outline-variant">
          <tr v-for="item in selected.items" :key="item.id">
            <td class="py-2 pr-3">{{ item.quantity }} × {{ item.description }}</td>
            <td class="py-2 pr-3 text-body-s text-tertiary">
              <template v-if="item.refundedQuantity">{{ item.refundedQuantity }} refunded</template>
            </td>
            <td class="py-2 text-right tabular-nums">{{ formatCents(item.totalCents) }}</td>
          </tr>
        </tbody>
      </table>
      <dl class="border-t border-outline-variant mt-1 pt-2 text-body-m space-y-0.5">
        <div class="flex justify-between text-on-surface-variant"><dt>Tax</dt><dd class="tabular-nums">{{ formatCents(selected.taxCents) }}</dd></div>
        <div class="flex justify-between text-title-m text-on-surface"><dt>Total</dt><dd class="tabular-nums">{{ formatCents(selected.totalCents) }}</dd></div>
        <div v-if="selected.refundedCents" class="flex justify-between text-tertiary">
          <dt>Refunded</dt><dd class="tabular-nums">−{{ formatCents(selected.refundedCents) }}</dd>
        </div>
      </dl>

      <div v-if="selected.refunds.length" class="mt-4">
        <h3 class="text-title-s text-on-surface mb-1">Refunds</h3>
        <p v-for="r in selected.refunds" :key="r.id" class="text-body-m py-1">
          {{ r.kind === 'VOID' ? 'Voided' : 'Refunded' }} {{ formatCents(r.amountCents) }} · {{ formatWhen(r.createdAt) }}
          · approved by {{ r.approval?.approver?.firstName }} · “{{ r.reason }}”
        </p>
      </div>

      <ErrorBanner v-if="error" :message="error" class="mt-4" />
      <p v-if="!canRefund && !['VOIDED', 'REFUNDED'].includes(selected.status)" class="mt-4 text-body-s text-on-surface-variant">
        This sale has a payment the register can't refund. Refund it from the admin panel.
      </p>
    </template>

    <template #actions="{ close }">
      <template v-if="selected">
        <AppButton v-if="canVoid" variant="text-danger" :icon="IconBlock" class="mr-auto" @click="emit('void', selected)">Void sale</AppButton>
        <AppButton variant="outlined" size="lg" :icon="IconPrint" @click="emit('print', selected)">Reprint</AppButton>
        <AppButton v-if="canRefund" variant="tonal" size="lg" :icon="IconUndo" @click="emit('refund', selected)">Refund</AppButton>
      </template>
      <AppButton v-else variant="text" @click="close">Close</AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Today's sales at this register (or all registers, or one receipt number) with reprint, void and refund.
// Mounted with v-if; Esc / Close emit close. initialSaleId opens that sale's detail (e.g. coming back from a
// cancelled refund). Emits print(sale), void(sale), refund(sale), close.
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { COURSE_TZ, localDate } from '@/lib/timeclock'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import TextField from '@/components/ui/TextField.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import IconBack from '~icons/material-symbols/arrow-back-rounded'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'
import IconUndo from '~icons/material-symbols/undo-rounded'
import IconBlock from '~icons/material-symbols/block-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'

const props = defineProps({
  registerId: { type: String, required: true },
  registerName: { type: String, default: '' },
  initialSaleId: { type: String, default: null },
})
const emit = defineEmits(['print', 'void', 'refund', 'close'])

const sales    = ref([])
const selected = ref(null)
const scope    = ref('register')
const number   = ref('')
const loading  = ref(false)
const error    = ref(null)

// The register refunds cash, card and house account payments
const refundable = computed(() => !!selected.value?.payments.every(p => ['CASH', 'CARD_TERMINAL', 'HOUSE_ACCOUNT'].includes(p.method)))
// A split (cash + card) sale is refunded in two passes instead of voided, so each part goes back its own way
const isSplit = computed(() => new Set((selected.value?.payments ?? []).map(p => p.method)).size > 1)
const canRefund = computed(() => refundable.value && !['VOIDED', 'REFUNDED'].includes(selected.value.status))
const canVoid = computed(() => refundable.value && !isSplit.value && selected.value.status === 'COMPLETED' &&
  !selected.value.refunds.length && localDate(selected.value.createdAt) === localDate())

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}
function formatWhen(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams()
    if (number.value.trim()) params.set('number', number.value.trim())
    else if (scope.value === 'register') params.set('registerId', props.registerId)
    sales.value = await apiFetch(`/api/staff/sales?${params}`)
    if (number.value.trim() && sales.value.length === 1) await open(sales.value[0].id)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function open(id) {
  error.value = null
  try {
    selected.value = await apiFetch(`/api/staff/sales/${id}`)
  } catch (e) {
    error.value = e.message
  }
}

onMounted(async () => {
  await load()
  if (props.initialSaleId) await open(props.initialSaleId)
})
</script>
