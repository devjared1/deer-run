<template>
  <div>
    <!-- Everything but the receipt area; hidden from print while a receipt-size document prints -->
    <div :class="printDoc ? 'print:hidden' : ''">
    <!-- Tabs + filters -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-3 print:hidden">
      <div class="flex rounded-lg border border-gray-300 overflow-hidden self-end">
        <button
          v-for="t in TABS"
          :key="t.value"
          type="button"
          :class="['px-3 py-2 text-sm font-body transition-colors', tab === t.value ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
          @click="tab = t.value"
        >
          {{ t.label }}
        </button>
      </div>
      <div>
        <label class="label-sm">From</label>
        <input v-model="from" type="date" class="input-field" @change="onFromChange">
      </div>
      <div>
        <label class="label-sm">To</label>
        <input v-model="to" type="date" :min="from" class="input-field">
      </div>
      <div class="flex gap-1 self-end">
        <button class="btn-outline-sm" @click="setRange('today')">
          Today
        </button>
        <button class="btn-outline-sm" @click="setRange('yesterday')">
          Yesterday
        </button>
        <button class="btn-outline-sm" @click="setRange('month')">
          This month
        </button>
      </div>
      <div>
        <label class="label-sm">Register</label>
        <select v-model="registerId" class="input-field">
          <option value="">
            All registers
          </option>
          <option v-for="r in registers" :key="r.id" :value="r.id">
            {{ r.name }}
          </option>
        </select>
      </div>
      <div v-if="tab === 'sales'">
        <label class="label-sm">Status</label>
        <select v-model="status" class="input-field">
          <option value="">
            Any status
          </option>
          <option v-for="(label, value) in SALE_STATUS_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </div>
      <div v-if="tab === 'sales'" class="ml-auto">
        <label class="label-sm">Find receipt #</label>
        <input v-model.trim="number" type="text" inputmode="numeric" class="input-field w-28" placeholder="1042" @keyup.enter="loadSales(1)">
      </div>
    </div>

    <!-- ── Sales list ──────────────────────────────────────────────────── -->
    <template v-if="tab === 'sales'">
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <span v-if="list" class="text-sm text-gray-500 font-body">
          {{ list.total }} sale{{ list.total === 1 ? '' : 's' }}{{ number ? ` matching #${number}` : '' }}
        </span>
        <button v-if="number" class="text-xs text-lake hover:text-pine font-body" @click="number = ''; loadSales(1)">
          Clear search
        </button>
        <div class="ml-auto flex gap-2">
          <button class="btn-outline-sm" :disabled="downloading" @click="downloadCsv('sales')">
            Export Sales CSV
          </button>
          <button class="btn-outline-sm" :disabled="downloading" @click="downloadCsv('items')">
            Export Items CSV
          </button>
        </div>
      </div>
      <p v-if="downloadError" class="text-red-500 text-sm mb-3">
        {{ downloadError }}
      </p>

      <div v-if="loading && !list" class="text-gray-400 text-sm">
        Loading…
      </div>
      <div v-else-if="error" class="text-red-500 text-sm">
        {{ error }}
      </div>
      <div v-else-if="list" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm font-body">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100 text-left">
                <th class="th">
                  Receipt
                </th>
                <th class="th">
                  When
                </th>
                <th class="th">
                  Register
                </th>
                <th class="th">
                  Cashier
                </th>
                <th class="th">
                  Customer
                </th>
                <th class="th">
                  Tender
                </th>
                <th class="th text-right">
                  Total
                </th>
                <th class="th">
                  Status
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr
                v-for="s in list.sales"
                :key="s.id"
                class="hover:bg-gold/5 cursor-pointer transition-colors"
                @click="openSale(s.id)"
              >
                <td class="td font-semibold text-bark">
                  #{{ s.number }}
                </td>
                <td class="td text-gray-600 whitespace-nowrap">
                  {{ formatWhen(s.createdAt) }}
                </td>
                <td class="td text-gray-600">
                  {{ s.register?.name }}
                </td>
                <td class="td text-gray-600">
                  {{ s.cashier?.firstName }} {{ s.cashier?.lastName }}
                </td>
                <td class="td text-gray-600">
                  {{ s.customer ? (s.customer.name || s.customer.email) : '—' }}
                  <span v-if="s.isMemberPricing" class="text-xs text-pine">· member</span>
                </td>
                <td class="td text-gray-600">
                  {{ tenderLabel(s.payments) }}
                </td>
                <td class="td text-right tabular-nums text-bark">
                  {{ formatCents(s.totalCents) }}
                  <div v-if="s.refundedCents" class="text-xs text-clay">
                    −{{ formatCents(s.refundedCents) }}
                  </div>
                </td>
                <td class="td">
                  <span :class="['text-xs px-2 py-0.5 rounded-full whitespace-nowrap', SALE_STATUS_CLASSES[s.status]]">{{ SALE_STATUS_LABELS[s.status] }}</span>
                </td>
              </tr>
              <tr v-if="!list.sales.length">
                <td colspan="8" class="px-5 py-8 text-center text-gray-400">
                  No sales found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="pages > 1" class="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm font-body">
          <button class="btn-outline-sm" :disabled="list.page <= 1" @click="loadSales(list.page - 1)">
            ← Newer
          </button>
          <span class="text-gray-500">Page {{ list.page }} of {{ pages }}</span>
          <button class="btn-outline-sm" :disabled="list.page >= pages" @click="loadSales(list.page + 1)">
            Older →
          </button>
        </div>
      </div>
    </template>

    <!-- ── Drawer sessions ─────────────────────────────────────────────── -->
    <template v-else-if="tab === 'drawers'">
      <div v-if="loading && !drawers" class="text-gray-400 text-sm">
        Loading…
      </div>
      <div v-else-if="error" class="text-red-500 text-sm">
        {{ error }}
      </div>
      <div v-else-if="drawers" class="bg-white rounded-xl border border-gray-200 p-5">
        <DrawerSessionsTable v-if="drawers.sessions.length" :sessions="drawers.sessions" closable @close="startAdminClose" />
        <p v-else class="text-gray-400 text-sm font-body text-center py-6">
          No drawer sessions in this period.
        </p>
        <p class="text-xs text-gray-400 font-body mt-4">
          Drawers are opened and closed at the register. Close one here only if the register can't (the closing
          count still needs to be entered).
        </p>
      </div>
    </template>

    <!-- ── Report ──────────────────────────────────────────────────────── -->
    <template v-else>
      <div class="flex flex-wrap items-baseline gap-3 mb-4">
        <h2 class="font-display font-bold text-bark text-xl">
          <span class="hidden print:inline">Deer Run · </span>{{ from === to ? 'End of Day Report' : 'Sales Report' }}
        </h2>
        <span v-if="report" class="text-sm text-gray-500 font-body">
          {{ reportDateLabel(report, formatLocalDate) }} · {{ report.register?.name || 'All registers' }}
        </span>
        <div class="ml-auto flex gap-2 print:hidden">
          <button class="btn-outline-sm" :disabled="!report" @click="printPage">
            🖨 Print
          </button>
          <button
            class="btn-outline-sm"
            :disabled="!report"
            title="Print the report on the 80 mm receipt printer (this also opens the cash drawer)"
            @click="printSlip"
          >
            Print receipt-size
          </button>
        </div>
      </div>
      <div v-if="loading && !report" class="text-gray-400 text-sm">
        Loading…
      </div>
      <div v-else-if="error" class="text-red-500 text-sm">
        {{ error }}
      </div>
      <SalesReport v-else-if="report" :report="report" />
    </template>

    <!-- Close a drawer from the admin panel -->
    <div v-if="adminClose" class="modal-overlay print:hidden" @click.self="adminClose = null">
      <div class="modal-box max-w-sm">
        <h2 class="font-display font-bold text-bark mb-1">
          Close {{ adminClose.session.register?.name }} drawer
        </h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          Opened {{ formatWhen(adminClose.session.openedAt) }} by {{ adminClose.session.openedBy?.firstName }}.
          Enter the cash counted in the drawer.
        </p>
        <label class="label-sm">Counted cash ($)</label>
        <input v-model="adminClose.amount" type="number" min="0" step="0.01" class="input-field w-full">
        <label class="label-sm mt-3">Note</label>
        <input v-model="adminClose.note" type="text" maxlength="250" class="input-field w-full" placeholder="Why it's being closed here">
        <p v-if="adminClose.error" class="text-red-500 text-xs mt-2 font-body">
          {{ adminClose.error }}
        </p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="adminClose = null">
            Cancel
          </button>
          <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="adminClose.busy || adminClose.amount === ''" @click="submitAdminClose">
            {{ adminClose.busy ? 'Closing…' : 'Close Drawer' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Sale detail -->
    <div v-if="selected" class="modal-overlay print:hidden" @click.self="selected = null">
      <div class="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-start gap-3 mb-4">
          <div>
            <h2 class="font-display font-bold text-bark">
              Receipt #{{ selected.number }}
            </h2>
            <div class="text-sm text-gray-500 font-body">
              {{ formatWhen(selected.createdAt) }} · {{ selected.register?.name }} · {{ selected.cashier?.firstName }} {{ selected.cashier?.lastName }}
            </div>
          </div>
          <span :class="['ml-auto text-xs px-2 py-0.5 rounded-full', SALE_STATUS_CLASSES[selected.status]]">{{ SALE_STATUS_LABELS[selected.status] }}</span>
        </div>
        <div class="grid md:grid-cols-[auto,1fr] gap-6">
          <div class="border border-gray-200 rounded-lg overflow-hidden self-start">
            <SaleReceipt :sale="selected" />
          </div>
          <div class="font-body text-sm space-y-4">
            <div v-if="selected.refunds.length">
              <h3 class="font-semibold text-bark mb-1">
                Voids and refunds
              </h3>
              <ul class="space-y-2">
                <li v-for="r in selected.refunds" :key="r.id" class="border border-gray-100 rounded-lg px-3 py-2">
                  <div class="flex justify-between gap-3">
                    <span class="font-semibold text-bark">{{ r.kind === 'VOID' ? 'Void' : 'Refund' }} · {{ formatCents(r.amountCents) }}</span>
                    <span class="text-gray-400 text-xs">{{ formatWhen(r.createdAt) }}</span>
                  </div>
                  <div class="text-gray-600 text-xs mt-0.5">
                    “{{ r.reason }}” · by {{ r.cashier?.firstName }}<template v-if="r.approval?.approver">, approved by {{ r.approval.approver.firstName }} {{ r.approval.approver.lastName }}</template>
                    · {{ r.restocked ? 'restocked' : 'not restocked' }}
                  </div>
                </li>
              </ul>
            </div>
            <p class="text-gray-400 text-xs">
              Voids and refunds are done at the register, where the money changes hands.
            </p>
            <div>
              <label class="label-sm">Email this receipt</label>
              <div class="flex gap-2">
                <input v-model.trim="emailTo" type="email" class="input-field flex-1" placeholder="customer@example.com">
                <button class="btn-outline-sm" :disabled="emailing || !emailTo" @click="sendEmail">
                  {{ emailing ? 'Sending…' : 'Send' }}
                </button>
              </div>
              <p v-if="emailMessage" :class="['text-xs mt-1', emailMessage.ok ? 'text-pine' : 'text-red-500']">
                {{ emailMessage.text }}
              </p>
            </div>
            <div class="flex gap-2 pt-2">
              <button class="btn-outline-sm" @click="reprint">
                Reprint receipt
              </button>
              <button class="btn-outline-sm ml-auto" @click="selected = null">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    </div>

    <!-- What the 80 mm printer prints -->
    <div v-if="printDoc" class="hidden print:block receipt-print">
      <SaleReceipt v-if="printDoc.type === 'sale'" :sale="printDoc.sale" />
      <ZReportSlip v-else-if="printDoc.type === 'z'" :report="printDoc.report" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { formatCents, dollarsToCents } from '@/lib/money'
import { printReceipt } from '@/lib/printReceipt'
import { localDate, addDays, formatLocalDate, COURSE_TZ } from '@/lib/timeclock'
import { reportDateLabel, SALE_STATUS_LABELS, SALE_STATUS_CLASSES } from '@/components/pos/salesReport'
import SaleReceipt from '@/components/pos/SaleReceipt.vue'
import SalesReport from '@/components/pos/SalesReport.vue'
import ZReportSlip from '@/components/pos/ZReportSlip.vue'
import DrawerSessionsTable from '@/components/pos/DrawerSessionsTable.vue'

const TABS = [
  { value: 'sales',  label: 'Sales' },
  { value: 'report', label: 'Report' },
  { value: 'drawers', label: 'Drawers' },
]
const PAYMENT_LABELS = { CASH: 'Cash', CARD_TERMINAL: 'Card', HOUSE_ACCOUNT: 'House account', PREPAID_ONLINE: 'Paid online', GIFT_CARD: 'Gift card' }

const authStore = useAuthStore()

const tab        = ref('sales')
const today      = localDate()
const from       = ref(today)
const to         = ref(today)
const registerId = ref('')
const status     = ref('')
const number     = ref('')
const registers  = ref([])

const list          = ref(null)
const drawers       = ref(null)
const adminClose    = ref(null)
const report        = ref(null)
const loading       = ref(false)
const error         = ref(null)
const downloading   = ref(false)
const downloadError = ref(null)

const selected     = ref(null)
const emailTo      = ref('')
const emailing     = ref(false)
const emailMessage = ref(null)
const printDoc     = ref(null)

const pages = computed(() => (list.value ? Math.max(1, Math.ceil(list.value.total / list.value.limit)) : 1))

function onFromChange() {
  if (!to.value || to.value < from.value) to.value = from.value
}

function setRange(which) {
  if (which === 'today') { from.value = today; to.value = today }
  if (which === 'yesterday') { from.value = addDays(today, -1); to.value = from.value }
  if (which === 'month') { from.value = `${today.slice(0, 7)}-01`; to.value = today }
}

function filterParams() {
  const params = new URLSearchParams({ from: from.value, to: to.value })
  if (registerId.value) params.set('registerId', registerId.value)
  return params
}

async function loadSales(page = 1) {
  loading.value = true
  error.value   = null
  try {
    const params = filterParams()
    if (status.value) params.set('status', status.value)
    if (number.value) params.set('number', number.value)
    params.set('page', page)
    list.value = await apiFetch(`/api/admin/sales?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadReport() {
  loading.value = true
  error.value   = null
  try {
    report.value = await apiFetch(`/api/admin/sales/report?${filterParams()}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadDrawers() {
  loading.value = true
  error.value   = null
  try {
    drawers.value = await apiFetch(`/api/admin/drawer-sessions?${filterParams()}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function load() {
  if (!from.value || !to.value) return
  if (tab.value === 'drawers') return loadDrawers()
  return tab.value === 'sales' ? loadSales(1) : loadReport()
}

function startAdminClose(session) {
  adminClose.value = { session, amount: '', note: '', busy: false, error: null }
}

async function submitAdminClose() {
  const c = adminClose.value
  c.busy  = true
  c.error = null
  try {
    await apiFetch(`/api/admin/drawer-sessions/${c.session.id}`, {
      method: 'POST',
      body: { action: 'close', countedCents: dollarsToCents(c.amount), note: c.note },
    })
    adminClose.value = null
    await loadDrawers()
  } catch (e) {
    c.error = e.message
  } finally {
    c.busy = false
  }
}

watch([tab, from, to, registerId, status], load)

onMounted(async () => {
  load()
  try {
    registers.value = await apiFetch('/api/admin/registers')
  } catch {
    // The register filter is optional
  }
})

async function openSale(id) {
  emailMessage.value = null
  try {
    selected.value = await apiFetch(`/api/admin/sales/${id}`)
    emailTo.value  = selected.value.receiptEmail || selected.value.customer?.email || ''
  } catch (e) {
    error.value = e.message
  }
}

async function sendEmail() {
  emailing.value     = true
  emailMessage.value = null
  try {
    await apiFetch(`/api/admin/sales/${selected.value.id}`, { method: 'POST', body: { action: 'email', email: emailTo.value } })
    emailMessage.value = { ok: true, text: `Sent to ${emailTo.value}` }
  } catch (e) {
    emailMessage.value = { ok: false, text: e.message }
  } finally {
    emailing.value = false
  }
}

// Receipt-size prints go through printReceipt() so the 80 mm page size applies only to them
async function printDocument(doc) {
  printDoc.value = doc
  await nextTick()
  window.addEventListener('afterprint', () => { printDoc.value = null }, { once: true })
  printReceipt()
}

function reprint() {
  printDocument({ type: 'sale', sale: selected.value })
}

function printSlip() {
  printDocument({ type: 'z', report: { ...report.value, printedBy: authStore.profile?.name || authStore.profile?.email } })
}

// Letter-size report: hide the receipt area so only the page content prints
async function printPage() {
  printDoc.value = null
  await nextTick()
  window.print()
}

function tenderLabel(payments) {
  if (!payments?.length) return 'No charge'
  return [...new Set(payments.map(p => PAYMENT_LABELS[p.method] ?? p.method))].join(' + ')
}

function formatWhen(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.th             { @apply px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold; }
.td             { @apply px-5 py-2.5; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-3 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent; }
</style>
