<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-box max-w-3xl max-h-[92vh] flex flex-col">
      <!-- List -->
      <template v-if="!selected">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <h2 class="font-display font-bold text-bark mr-auto">Recent Sales</h2>
          <input
            v-model="number"
            type="text"
            inputmode="numeric"
            class="input-field w-36"
            placeholder="Receipt #"
            @keyup.enter="load"
          />
          <select v-model="scope" class="input-field" @change="load">
            <option value="register">Today · {{ registerName }}</option>
            <option value="all">Today · all registers</option>
          </select>
        </div>
        <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
        <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>
        <div v-else class="overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
          <button
            v-for="s in sales"
            :key="s.id"
            class="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-4 font-body text-sm"
            @click="open(s.id)"
          >
            <span class="w-16 text-bark font-semibold">#{{ s.number }}</span>
            <span class="w-20 text-gray-500">{{ formatTime(s.createdAt) }}</span>
            <span class="flex-1 min-w-0 truncate text-gray-600">{{ s.customer?.name || s.customer?.email || 'Walk-in' }}</span>
            <span v-if="s.status !== 'COMPLETED'" :class="['badge', statusClass(s.status)]">{{ statusLabel(s.status) }}</span>
            <span class="w-20 text-right tabular-nums text-bark">{{ formatCents(s.totalCents) }}</span>
          </button>
          <p v-if="!sales.length" class="px-4 py-6 text-center text-gray-400 text-sm">No sales found.</p>
        </div>
        <div class="flex justify-end mt-4">
          <button class="btn-outline-sm" @click="$emit('close')">Close</button>
        </div>
      </template>

      <!-- Detail -->
      <template v-else>
        <div class="flex items-center gap-3 mb-1">
          <button class="text-lake hover:text-pine text-sm font-body" @click="selected = null">← Back</button>
          <h2 class="font-display font-bold text-bark">Sale #{{ selected.number }}</h2>
          <span v-if="selected.status !== 'COMPLETED'" :class="['badge', statusClass(selected.status)]">{{ statusLabel(selected.status) }}</span>
        </div>
        <p class="text-gray-400 text-xs font-body mb-4">
          {{ formatWhen(selected.createdAt) }} · {{ selected.register?.name }} · {{ selected.cashier?.firstName }}
          <template v-if="selected.customer"> · {{ selected.customer.name || selected.customer.email }}</template>
        </p>

        <div class="overflow-y-auto">
          <table class="w-full text-sm font-body">
            <tbody class="divide-y divide-gray-50">
              <tr v-for="item in selected.items" :key="item.id">
                <td class="py-1.5 pr-3 text-bark">{{ item.quantity }} × {{ item.description }}</td>
                <td class="py-1.5 pr-3 text-xs text-clay">
                  <template v-if="item.refundedQuantity">{{ item.refundedQuantity }} refunded</template>
                </td>
                <td class="py-1.5 text-right tabular-nums">{{ formatCents(item.totalCents) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="border-t border-gray-100 mt-2 pt-2 text-sm font-body space-y-0.5">
            <div class="flex justify-between text-gray-500"><span>Tax</span><span class="tabular-nums">{{ formatCents(selected.taxCents) }}</span></div>
            <div class="flex justify-between text-bark font-semibold"><span>Total</span><span class="tabular-nums">{{ formatCents(selected.totalCents) }}</span></div>
            <div v-if="selected.refundedCents" class="flex justify-between text-clay">
              <span>Refunded</span><span class="tabular-nums">−{{ formatCents(selected.refundedCents) }}</span>
            </div>
          </div>

          <div v-if="selected.refunds.length" class="mt-4">
            <h3 class="text-xs text-gray-500 uppercase tracking-wider font-body mb-1">Refunds</h3>
            <div v-for="r in selected.refunds" :key="r.id" class="text-sm font-body text-gray-600 py-1">
              {{ r.kind === 'VOID' ? 'Voided' : 'Refunded' }} {{ formatCents(r.amountCents) }} · {{ formatWhen(r.createdAt) }}
              · approved by {{ r.approval?.approver?.firstName }} · “{{ r.reason }}”
            </div>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-2 mt-5">
          <button class="btn-outline-sm" @click="$emit('print', selected)">Reprint</button>
          <button v-if="canRefund" class="btn-outline-sm" @click="$emit('refund', selected)">Refund…</button>
          <button v-if="canVoid" class="btn-outline-sm text-red-600 border-red-200" @click="$emit('void', selected)">Void Sale…</button>
        </div>
        <p v-if="!canRefund && !['VOIDED', 'REFUNDED'].includes(selected.status)" class="text-gray-400 text-xs font-body mt-2 text-right">
          This sale has a payment the register can't refund. Refund it from the admin panel.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { COURSE_TZ, localDate } from '@/lib/timeclock'

const props = defineProps({
  registerId: { type: String, required: true },
  registerName: { type: String, default: '' },
  initialSaleId: { type: String, default: null },
})
defineEmits(['print', 'void', 'refund', 'close'])

const sales    = ref([])
const selected = ref(null)
const scope    = ref('register')
const number   = ref('')
const loading  = ref(false)
const error    = ref(null)

const STATUS = {
  PARTIALLY_REFUNDED: ['Partly refunded', 'bg-amber/20 text-bark'],
  VOIDED: ['Voided', 'bg-red-100 text-red-700'],
  REFUNDED: ['Refunded', 'bg-gray-100 text-gray-600'],
}
const statusLabel = (s) => STATUS[s]?.[0] ?? s
const statusClass = (s) => STATUS[s]?.[1] ?? ''

// The register refunds cash and card payments (house accounts etc. go through the admin panel)
const refundable = computed(() => !!selected.value?.payments.every(p => p.method === 'CASH' || p.method === 'CARD_TERMINAL'))
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

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.badge          { @apply text-xs px-2 py-0.5 rounded-full font-body; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
