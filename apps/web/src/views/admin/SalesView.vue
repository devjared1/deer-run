<template>
  <div class="font-body text-on-surface">
    <!-- Everything but the receipt area; hidden from print while a receipt-size document prints -->
    <div :class="printDoc ? 'print:hidden' : ''">
      <!-- AppTabs renders no root element of its own (no class on it) -->
      <div class="mb-4 print:hidden">
        <AppTabs v-model="tab" :tabs="TABS" label="Sales views" />
      </div>

      <!-- Filters, md and up: reload on change, receipt # debounced -->
      <section aria-label="Filters" class="hidden md:block mb-4 rounded-shape-md border border-outline-variant bg-surface p-4 print:hidden">
        <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
          <DateRangeField v-model="range" label="Dates" :presets="DATE_PRESETS" class="min-w-[20rem] flex-1" />
          <SelectField v-model="registerId" label="Register" :options="registerOptions" placeholder="All registers" class="w-56" />
        </div>
        <div v-if="tab === 'sales'" class="mt-3 grid grid-cols-[1fr_auto] items-start gap-x-6">
          <ChipGroup v-model="status" type="choice" label="Status" :options="STATUS_OPTIONS" class="mt-3 min-w-0" />
          <TextField
            v-model.trim="number"
            label="Find receipt #"
            inputmode="numeric"
            autocomplete="off"
            :leading-icon="IconSearch"
            class="w-48"
            helper="Searches every day"
          />
        </div>
      </section>

      <!-- Filters, phones: a Filters button (with the active count) opening a bottom sheet; receipt # stays visible -->
      <div class="md:hidden mb-4 flex items-start gap-2 print:hidden">
        <AppButton
          variant="tonal"
          :icon="IconFilter"
          class="mt-2"
          :aria-label="activeFilterCount ? `Filters, ${activeFilterCount} active` : 'Filters'"
          @click="filtersOpen = true"
        >
          Filters
          <span
            v-if="activeFilterCount"
            class="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-on-primary text-label-s"
            aria-hidden="true"
          >{{ activeFilterCount }}</span>
        </AppButton>
        <TextField
          v-if="tab === 'sales'"
          v-model.trim="number"
          label="Receipt #"
          inputmode="numeric"
          autocomplete="off"
          :leading-icon="IconSearch"
          class="flex-1 min-w-0"
        />
      </div>
      <p class="md:hidden -mt-2 mb-3 text-body-s text-on-surface-variant print:hidden">{{ filterSummary }}</p>

      <BottomSheet v-model:open="filtersOpen" title="Filters">
        <div class="space-y-4 pb-2">
          <DateRangeField v-model="range" label="Dates" :presets="DATE_PRESETS" />
          <SelectField v-model="registerId" label="Register" :options="registerOptions" placeholder="All registers" />
          <ChipGroup v-if="tab === 'sales'" v-model="status" type="choice" label="Status" :options="STATUS_OPTIONS" />
        </div>
        <template #actions="{ close }">
          <AppButton variant="text" :disabled="!activeFilterCount" @click="resetFilters">Reset</AppButton>
          <AppButton @click="close">Show results</AppButton>
        </template>
      </BottomSheet>

      <!-- ── Sales list ──────────────────────────────────────────────────── -->
      <section v-if="tab === 'sales'" aria-label="Sales">
        <div class="flex flex-wrap items-center gap-3 mb-3">
          <p v-if="list" class="text-body-m text-on-surface-variant" aria-live="polite">
            {{ list.total.toLocaleString('en-US') }} sale{{ list.total === 1 ? '' : 's' }}{{ number ? ` matching #${number}` : '' }}
          </p>
          <AppButton v-if="number" variant="text" :icon="IconClose" @click="number = ''">Clear search</AppButton>

          <!-- CSV export menu -->
          <Menu as="div" class="relative ml-auto inline-flex">
            <MenuButton :as="AppButton" variant="outlined" :icon="IconDownload" :loading="downloading" :trailing-icon="IconExpand">
              Export CSV
            </MenuButton>
            <Transition
              enter-active-class="transition duration-short-4 ease-emphasized-decelerate"
              enter-from-class="opacity-0 scale-95"
              leave-active-class="transition-opacity duration-short-2 ease-standard"
              leave-to-class="opacity-0"
            >
              <MenuItems class="absolute right-0 top-full mt-1 z-dialog min-w-[220px] py-2 origin-top-right rounded-shape-xs bg-surface-container text-on-surface shadow-elevation-2 focus:outline-none">
                <MenuItem v-for="item in EXPORTS" :key="item.detail" v-slot="{ active }">
                  <button
                    type="button"
                    :class="['state-layer flex items-center gap-3 w-full min-h-12 px-3 text-left text-body-l', active ? 'before:opacity-[.08]' : '']"
                    @click="downloadCsv(item.detail)"
                  >
                    <component :is="item.icon" class="w-6 h-6 text-on-surface-variant" aria-hidden="true" />
                    <span>{{ item.label }}</span>
                  </button>
                </MenuItem>
              </MenuItems>
            </Transition>
          </Menu>
        </div>
        <ErrorBanner v-if="downloadError" :message="downloadError" class="mb-3" @dismiss="downloadError = null" />

        <ErrorBanner v-if="error" :message="error" :retrying="loading" @retry="load" />
        <template v-else>
          <DataTable
            :columns="saleColumns"
            :rows="list?.sales ?? []"
            :loading="loading"
            :loading-rows="8"
            manual-sort
            caption="Sales"
            :row-label="s => `Receipt #${s.number}, ${money(s.totalCents)}, ${formatWhen(s.createdAt)}`"
            @row-click="s => openSale(s.id)"
          >
            <template #cell-number="{ row }">
              Receipt #{{ row.number }}
            </template>
            <template #cell-register="{ row }">
              <span class="whitespace-nowrap">{{ row.register?.name ?? '—' }}</span>
              <span class="block text-body-s text-on-surface-variant whitespace-nowrap">{{ [row.cashier?.firstName, row.cashier?.lastName].filter(Boolean).join(' ') }}</span>
            </template>
            <template #cell-customer="{ row }">
              {{ row.customer ? (row.customer.name || row.customer.email) : '—' }}
              <StatusChip v-if="row.isMemberPricing" label="Member" tone="primary" icon="member" size="sm" class="ml-1" />
            </template>
            <template #cell-totalCents="{ row }">
              <span class="tabular-nums">{{ money(row.totalCents) }}</span>
              <span v-if="row.refundedCents" class="block text-body-s text-tertiary tabular-nums">−{{ money(row.refundedCents) }} refunded</span>
            </template>
            <template #cell-status="{ row }">
              <StatusChip kind="sale" :status="row.status" size="sm" />
            </template>
            <template #empty>
              <EmptyState
                :icon="IconReceipt"
                :title="number ? `No receipt #${number}` : 'No sales found'"
                :message="number ? 'Check the number and try again.' : 'Try another date range, register or status.'"
                compact
              />
            </template>
          </DataTable>
          <AppPagination
            v-if="list"
            :page="list.page"
            :total="list.total"
            :page-size="list.limit"
            label="Sales pages"
            class="mt-3"
            @update:page="loadSales"
          />
        </template>
      </section>

      <!-- ── Drawer sessions ─────────────────────────────────────────────── -->
      <section v-else-if="tab === 'drawers'" aria-label="Cash drawers">
        <Skeleton v-if="loading && !drawers" variant="rect" height="200px" label="Loading drawer sessions" />
        <ErrorBanner v-else-if="error" :message="error" :retrying="loading" @retry="load" />
        <template v-else-if="drawers">
          <div class="rounded-shape-md border border-outline-variant bg-surface p-4">
            <DrawerSessionsTable v-if="drawers.sessions.length" :sessions="drawers.sessions" closable @close="startAdminClose" />
            <EmptyState v-else :icon="IconPointOfSale" title="No drawer sessions in this period" compact />
          </div>
          <p class="mt-3 text-body-s text-on-surface-variant">
            Drawers are opened and closed at the register. Close one here only if the register can't (the closing
            count still needs to be entered).
          </p>
        </template>
      </section>

      <!-- ── Report ──────────────────────────────────────────────────────── -->
      <section v-else aria-labelledby="report-title">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
          <h2 id="report-title" class="font-display text-headline-s text-primary">
            <span class="hidden print:inline">Deer Run · </span>{{ range.from === range.to ? 'End of day report' : 'Sales report' }}
          </h2>
          <span v-if="report" class="text-body-m text-on-surface-variant">
            {{ reportDateLabel(report, formatLocalDate) }} · {{ report.register?.name || 'All registers' }}
          </span>
          <div class="ml-auto flex flex-wrap gap-2 print:hidden">
            <AppButton variant="outlined" :icon="IconPrint" :disabled="!report" @click="printPage">Print</AppButton>
            <AppButton
              variant="outlined"
              :icon="IconReceipt"
              :disabled="!report"
              title="Print the report on the 80 mm receipt printer (this also opens the cash drawer)"
              @click="printSlip"
            >
              Print receipt-size
            </AppButton>
          </div>
        </div>
        <template v-if="loading && !report">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton v-for="n in 4" :key="n" variant="rect" height="96px" />
          </div>
          <Skeleton variant="rect" height="240px" class="mt-4" label="Loading the report" />
        </template>
        <ErrorBanner v-else-if="error" :message="error" :retrying="loading" @retry="load" />
        <SalesReport v-else-if="report" :report="report" />
      </section>

      <!-- Close a drawer from the admin panel -->
      <AppDialog v-model:open="adminCloseOpen" :title="adminClose ? `Close ${adminClose.session.register?.name ?? ''} drawer` : 'Close drawer'" size="sm" persistent>
        <template v-if="adminClose">
          <p class="text-body-m text-on-surface-variant mb-4">
            Opened {{ formatWhen(adminClose.session.openedAt) }} by {{ adminClose.session.openedBy?.firstName }}.
            Enter the cash counted in the drawer.
          </p>
          <form id="admin-close-form" novalidate class="space-y-1" @submit.prevent="submitAdminClose">
            <MoneyField v-model="adminClose.countedCents" label="Counted cash" :min="0" required data-autofocus />
            <TextField v-model="adminClose.note" label="Note" maxlength="250" autocomplete="off" placeholder="Why it's being closed here" />
            <ErrorBanner v-if="adminClose.error" :message="adminClose.error" />
          </form>
        </template>
        <template #actions="{ close }">
          <AppButton variant="text" :disabled="adminClose?.busy" @click="close">Cancel</AppButton>
          <AppButton
            type="submit"
            form="admin-close-form"
            :loading="adminClose?.busy"
            :disabled="adminClose?.countedCents === null || adminClose?.countedCents === undefined"
          >
            {{ adminClose?.busy ? 'Closing…' : 'Close drawer' }}
          </AppButton>
        </template>
      </AppDialog>

      <!-- Sale detail -->
      <AppDialog v-model:open="saleOpen" size="lg" persistent fullscreen-on-mobile :title="selected ? `Receipt #${selected.number}` : 'Receipt'">
        <template v-if="selected">
          <div class="flex flex-wrap items-center gap-2 mb-4 text-body-m">
            <span>{{ formatWhen(selected.createdAt) }} · {{ selected.register?.name }} · {{ selected.cashier?.firstName }} {{ selected.cashier?.lastName }}</span>
            <StatusChip kind="sale" :status="selected.status" size="sm" />
          </div>
          <div class="grid md:grid-cols-[auto,1fr] gap-6 pb-2">
            <div class="rounded-shape-sm border border-outline-variant overflow-hidden self-start justify-self-center bg-surface-container-lowest">
              <SaleReceipt :sale="selected" />
            </div>
            <div class="space-y-4 min-w-0">
              <div v-if="selected.refunds.length">
                <h3 class="text-title-s text-on-surface mb-1">Voids and refunds</h3>
                <ul class="space-y-2">
                  <li v-for="r in selected.refunds" :key="r.id" class="rounded-shape-sm border border-outline-variant px-3 py-2">
                    <div class="flex justify-between gap-3">
                      <span class="font-bold text-on-surface">{{ r.kind === 'VOID' ? 'Void' : 'Refund' }} · {{ money(r.amountCents) }}</span>
                      <span class="text-body-s">{{ formatWhen(r.createdAt) }}</span>
                    </div>
                    <div class="text-body-s mt-0.5">
                      “{{ r.reason }}” · by {{ r.cashier?.firstName }}<template v-if="r.approval?.approver">, approved by {{ r.approval.approver.firstName }} {{ r.approval.approver.lastName }}</template>
                      · {{ r.restocked ? 'restocked' : 'not restocked' }}
                    </div>
                  </li>
                </ul>
              </div>
              <p class="text-body-s">Voids and refunds are done at the register, where the money changes hands.</p>
              <form novalidate class="space-y-1" @submit.prevent="sendEmail">
                <div class="flex items-start gap-2">
                  <TextField
                    v-model.trim="emailTo"
                    label="Email this receipt"
                    type="email"
                    autocomplete="email"
                    placeholder="customer@example.com"
                    class="flex-1 min-w-0"
                  />
                  <AppButton type="submit" variant="tonal" :icon="IconMail" class="mt-2" :loading="emailing" :disabled="!emailTo">
                    {{ emailing ? 'Sending…' : 'Send' }}
                  </AppButton>
                </div>
                <ErrorBanner v-if="emailError" :message="emailError" />
              </form>
            </div>
          </div>
        </template>
        <template #actions="{ close }">
          <AppButton variant="outlined" :icon="IconPrint" @click="reprint">Reprint receipt</AppButton>
          <AppButton @click="close">Close</AppButton>
        </template>
      </AppDialog>
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
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useSnackbar } from '@/composables/useSnackbar'
import { printReceipt } from '@/lib/printReceipt'
import { localDate, formatLocalDate, COURSE_TZ } from '@/lib/timeclock'
import { reportDateLabel } from '@/components/pos/salesReport'
import { statusInfo } from '@/components/ui/statusChips'
import SaleReceipt from '@/components/pos/SaleReceipt.vue'
import SalesReport from '@/components/pos/SalesReport.vue'
import ZReportSlip from '@/components/pos/ZReportSlip.vue'
import DrawerSessionsTable from '@/components/pos/DrawerSessionsTable.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DateRangeField from '@/components/ui/DateRangeField.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import SelectField from '@/components/ui/SelectField.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconMonitoring from '~icons/material-symbols/monitoring-rounded'
import IconPointOfSale from '~icons/material-symbols/point-of-sale-rounded'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconFilter from '~icons/material-symbols/filter-list-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconDownload from '~icons/material-symbols/download-rounded'
import IconExpand from '~icons/material-symbols/expand-more-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconTable from '~icons/material-symbols/table-view-rounded'
import IconSell from '~icons/material-symbols/sell-rounded'

const TABS = [
  { key: 'sales',   label: 'Sales',   icon: IconReceipt },
  { key: 'report',  label: 'Report',  icon: IconMonitoring },
  { key: 'drawers', label: 'Drawers', icon: IconPointOfSale },
]
const DATE_PRESETS = ['today', 'yesterday', 'thisWeek', 'last7', 'thisMonth', 'lastMonth']
const SALE_STATUSES = ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED']
const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  ...SALE_STATUSES.map(s => ({ value: s, label: statusInfo('sale', s).label })),
]
const EXPORTS = [
  { detail: 'sales', label: 'Sales (one row per sale)', icon: IconTable },
  { detail: 'items', label: 'Items (one row per item)', icon: IconSell },
]
const PAYMENT_LABELS = { CASH: 'Cash', CARD_TERMINAL: 'Card', HOUSE_ACCOUNT: 'House account', PREPAID_ONLINE: 'Paid online', GIFT_CARD: 'Gift card' }

const authStore = useAuthStore()
const snackbar  = useSnackbar()

const tab        = ref('sales')
const today      = localDate()
const range      = ref({ from: today, to: today })
const registerId = ref(null)
const status     = ref('')
const number     = ref('')
const registers  = ref([])
const filtersOpen = ref(false)

const list          = ref(null)
const drawers       = ref(null)
const adminClose    = ref(null)
const adminCloseOpen = ref(false)
const report        = ref(null)
const loading       = ref(false)
const error         = ref(null)
const downloading   = ref(false)
const downloadError = ref(null)

const selected   = ref(null)
const saleOpen   = ref(false)
const emailTo    = ref('')
const emailing   = ref(false)
const emailError = ref(null)
const printDoc   = ref(null)

const money = (cents) => (cents === null || cents === undefined
  ? '—'
  : `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

const saleColumns = [
  { key: 'number', label: 'Receipt', primary: true, class: 'whitespace-nowrap' },
  { key: 'createdAt', label: 'When', format: v => formatWhen(v), class: 'whitespace-nowrap' },
  { key: 'register', label: 'Register', hideOnMobile: true },
  { key: 'customer', label: 'Customer', class: 'min-w-[9rem]' },
  { key: 'tender', label: 'Tender', format: (_, s) => tenderLabel(s.payments) },
  { key: 'totalCents', label: 'Total', align: 'right', class: 'whitespace-nowrap' },
  { key: 'status', label: 'Status' },
]

const registerOptions = computed(() => registers.value.map(r => ({ value: r.id, label: r.name })))

// Filters that differ from the defaults (today, all registers, any status), for the phone Filters badge
const activeFilterCount = computed(() => [
  range.value.from !== today || range.value.to !== today,
  !!registerId.value,
  tab.value === 'sales' && !!status.value,
].filter(Boolean).length)

const filterSummary = computed(() => {
  const r = range.value
  const dates = !r.from || !r.to ? 'Pick dates'
    : r.from === r.to ? formatLocalDate(r.from, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : `${formatLocalDate(r.from, { month: 'short', day: 'numeric' })} – ${formatLocalDate(r.to, { month: 'short', day: 'numeric', year: 'numeric' })}`
  const reg = registers.value.find(x => x.id === registerId.value)?.name ?? 'All registers'
  const st = tab.value === 'sales' && status.value ? ` · ${statusInfo('sale', status.value).label}` : ''
  return `${dates} · ${reg}${st}`
})

function resetFilters() {
  range.value = { from: today, to: today }
  registerId.value = null
  status.value = ''
}

function filterParams() {
  const params = new URLSearchParams({ from: range.value.from, to: range.value.to })
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
  const { from, to } = range.value
  if (!from || !to || to < from) return
  if (tab.value === 'drawers') return loadDrawers()
  return tab.value === 'sales' ? loadSales(1) : loadReport()
}

// One filter rule: reload on change; the receipt # search is debounced
let numberTimer = null
watch([tab, () => range.value.from, () => range.value.to, registerId, status], () => {
  clearTimeout(numberTimer)
  load()
})
watch(number, () => {
  clearTimeout(numberTimer)
  numberTimer = setTimeout(() => { if (tab.value === 'sales') loadSales(1) }, 300)
})

function startAdminClose(session) {
  adminClose.value = { session, countedCents: null, note: '', busy: false, error: null }
  adminCloseOpen.value = true
}

async function submitAdminClose() {
  const c = adminClose.value
  if (!c || c.busy || c.countedCents === null) return
  c.busy  = true
  c.error = null
  try {
    await apiFetch(`/api/admin/drawer-sessions/${c.session.id}`, {
      method: 'POST',
      body: { action: 'close', countedCents: c.countedCents, note: c.note },
    })
    adminCloseOpen.value = false
    snackbar.show(`${c.session.register?.name ?? 'Drawer'} drawer closed`)
    await loadDrawers()
  } catch (e) {
    c.error = e.message
  } finally {
    c.busy = false
  }
}

onMounted(async () => {
  load()
  try {
    registers.value = await apiFetch('/api/admin/registers')
  } catch {
    // The register filter is optional
  }
})

// A failed open shows a message; the list stays
async function openSale(id) {
  emailError.value = null
  try {
    selected.value = await apiFetch(`/api/admin/sales/${id}`)
    emailTo.value  = selected.value.receiptEmail || selected.value.customer?.email || ''
    saleOpen.value = true
  } catch (e) {
    snackbar.show({ message: `Couldn't open the receipt: ${e.message}`, tone: 'error' })
  }
}

async function sendEmail() {
  if (!emailTo.value || emailing.value) return
  emailing.value   = true
  emailError.value = null
  try {
    await apiFetch(`/api/admin/sales/${selected.value.id}`, { method: 'POST', body: { action: 'email', email: emailTo.value } })
    snackbar.show(`Receipt sent to ${emailTo.value}`)
  } catch (e) {
    emailError.value = e.message
  } finally {
    emailing.value = false
  }
}

// GET /api/admin/sales?...&format=csv&detail=sales|items: the whole range (receipt # search doesn't apply)
async function downloadCsv(detail) {
  downloading.value   = true
  downloadError.value = null
  try {
    const params = filterParams()
    if (status.value) params.set('status', status.value)
    params.set('format', 'csv')
    params.set('detail', detail)
    const res = await fetch(`/api/admin/sales?${params}`, { headers: { Authorization: `Bearer ${authStore.getToken()}` } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText)
    const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? `sales-${detail}.csv`
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    snackbar.show(`Downloaded ${filename}`)
  } catch (e) {
    downloadError.value = `Couldn't export: ${e.message}`
  } finally {
    downloading.value = false
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
