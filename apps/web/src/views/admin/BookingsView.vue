<template>
  <div class="space-y-6">
    <!-- Filters: every change reloads (search after a 300 ms pause) -->
    <Card variant="outlined">
      <div class="space-y-4">
        <div class="flex flex-col gap-4 md:flex-row md:items-start">
          <TextField
            v-model="search"
            type="search"
            label="Search"
            placeholder="Guest or member name, email"
            :leading-icon="IconSearch"
            autocomplete="off"
            class="flex-1 min-w-0"
          />
          <AppButton v-if="hasFilters" variant="text" :icon="IconClose" class="md:mt-2" @click="clearFilters">Clear filters</AppButton>
        </div>
        <div class="space-y-1">
          <p class="text-label-l text-on-surface-variant" aria-hidden="true">Status</p>
          <ChipGroup v-model="statuses" :options="STATUS_OPTIONS" label="Status" scroll />
        </div>
        <DateRangeField v-model="range" label="Tee dates" :presets="['today', 'thisWeek', 'last7', 'thisMonth']" />
      </div>
    </Card>

    <ErrorBanner v-if="error" :message="error" @retry="load" />

    <template v-else>
      <DataTable
        :columns="columns"
        :rows="bookings"
        :loading="loading"
        manual-sort
        caption="Bookings"
        :row-label="b => `${nameOf(b)}, ${teeLabel(b)}`"
      >
        <template #cell-name="{ row }">
          <span class="block">{{ nameOf(row) }}</span>
          <span class="block text-body-s font-normal text-on-surface-variant">{{ row.User?.email || row.guestEmail || 'Guest' }}</span>
        </template>
        <template #cell-tee="{ row }">
          <span class="whitespace-nowrap">{{ teeLabel(row) }}</span>
        </template>
        <template #cell-total="{ row }"><span class="tabular-nums">{{ money(row.totalCents) }}</span></template>
        <template #cell-status="{ row }">
          <StatusChip kind="booking" :status="bookingStatus(row)" size="sm" />
        </template>
        <template #cell-createdAt="{ row }">{{ formatCreated(row.createdAt) }}</template>
        <template #actions="{ row }">
          <RowActionsMenu
            :label="`Actions for ${nameOf(row)}`"
            :items="[{ label: 'Change status', icon: IconEditNote, onClick: () => openStatusDialog(row) }]"
          />
        </template>
        <template #empty>
          <EmptyState
            compact
            :icon="IconBookOnline"
            :title="hasFilters ? 'No bookings match' : 'No bookings yet'"
            :message="hasFilters ? 'Try other dates or statuses, or clear the filters.' : 'Online, phone and walk-in bookings show up here.'"
            :action-label="hasFilters ? 'Clear filters' : ''"
            @action="clearFilters"
          />
        </template>
      </DataTable>

      <AppPagination v-model:page="page" :total="total" :page-size="LIMIT" label="Bookings pages" />
    </template>

    <!-- Status change: status only, no money moves -->
    <AppDialog :open="!!editing" title="Change booking status" persistent @update:open="v => { if (!v) editing = null }">
      <template v-if="editing">
        <p class="mb-4 text-body-m text-on-surface-variant">{{ nameOf(editing) }} · {{ teeLabel(editing) }}</p>
        <RadioGroup
          v-model="newStatus"
          label="Status"
          :options="STATUSES.map(s => ({
            value: s,
            label: statusInfo('booking', s).label,
            description: STATUS_ONLY.includes(s) ? 'Status only: no money moves' : undefined,
          }))"
        />
        <p class="mt-4 text-body-m text-on-surface-variant">
          This changes the booking's status only. To give money back, refund the sale on the register or in Stripe.
        </p>
        <ErrorBanner v-if="formError" class="mt-4" :message="formError" />
      </template>
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton :loading="saving" :disabled="!editing || newStatus === editing.status" @click="updateStatus">Update</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatLocalDate, isValidYmd, toUtcIso } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import { bookingStatus, statusInfo } from '@/components/ui/statusChips.js'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import Card from '@/components/ui/Card.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DateRangeField from '@/components/ui/DateRangeField.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconEditNote from '~icons/material-symbols/edit-note-rounded'
import IconBookOnline from '~icons/material-symbols/book-online-rounded'

const confirm  = useConfirm()
const snackbar = useSnackbar()

const LIMIT = 25
const STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED']
const STATUS_OPTIONS = STATUSES.map(s => ({ value: s, label: statusInfo('booking', s).label }))
// Statuses an admin can set here that sound like money moves but don't
const STATUS_ONLY = ['CANCELLED', 'REFUNDED']

const columns = [
  { key: 'name', label: 'Guest / member', primary: true },
  { key: 'tee', label: 'Tee time' },
  { key: 'players', label: 'Players', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Booked', hideOnMobile: true },
]

const bookings = ref([])
const loading  = ref(true)
const error    = ref(null)
const total    = ref(0)
const page     = ref(1)

const search   = ref('')
const statuses = ref([])
const range    = ref({ from: '', to: '' })

const hasFilters = computed(() => !!(search.value.trim() || statuses.value.length || range.value.from || range.value.to))

// "$1,234.56"
const money = cents => ((cents ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const nameOf = b => b.User?.name || b.guestName || b.User?.email || b.guestEmail || 'Guest'
const teeLabel = b => (b.TeeTimeSlot
  ? `${formatLocalDate(b.TeeTimeSlot.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}, ${teeTime(b.TeeTimeSlot.startTime)}`
  : 'No tee time')
const formatCreated = iso => new Date(toUtcIso(iso)).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago',
})

// A from-only or to-only range is fine; "to before from" waits until it's fixed
const rangeReady = r => (!r.from || isValidYmd(r.from)) && (!r.to || isValidYmd(r.to)) && !(r.from && r.to && r.to < r.from)

let loadSeq = 0
async function load() {
  if (!rangeReady(range.value)) return
  const seq = ++loadSeq
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams({ page: page.value, limit: LIMIT })
    if (statuses.value.length) params.set('status', statuses.value.join(','))
    if (range.value.from) params.set('from', range.value.from)
    if (range.value.to) params.set('to', range.value.to)
    if (search.value.trim()) params.set('search', search.value.trim())
    const data = await apiFetch(`/api/admin/bookings?${params}`)
    if (seq !== loadSeq) return
    bookings.value = data.bookings
    total.value = data.total
  } catch (e) {
    if (seq === loadSeq) error.value = e.message
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

// Filter changes go back to page 1; a page change just loads that page
function reloadFromFirstPage() {
  if (page.value === 1) load()
  else page.value = 1
}
watch(page, load)
watch([statuses, range], reloadFromFirstPage, { deep: true })
let searchTimer = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(reloadFromFirstPage, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

function clearFilters() {
  search.value = ''
  statuses.value = []
  range.value = { from: '', to: '' }
}

// ── Status change ──
const editing   = ref(null)
const newStatus = ref('')
const saving    = ref(false)
const formError = ref(null)

function openStatusDialog(booking) {
  editing.value = booking
  newStatus.value = booking.status
  formError.value = null
}

async function setStatus(id, status) {
  return apiFetch(`/api/admin/bookings/${id}`, { method: 'PUT', body: { status } })
}

async function updateStatus() {
  const booking = editing.value
  const status = newStatus.value
  const label = statusInfo('booking', status).label
  if (STATUS_ONLY.includes(status) && !(await confirm({
    title: `Mark this booking ${label.toLowerCase()}?`,
    message: 'This changes the status only: no money is refunded through this. Refund the payment on the register or in Stripe.',
    confirmLabel: `Mark ${label.toLowerCase()}`,
    destructive: true,
  }))) return

  saving.value = true
  formError.value = null
  try {
    await setStatus(booking.id, status)
    editing.value = null
    const previous = booking.status
    // Undo puts the old status back; not after cancelling an unpaid booking (its payment was stopped)
    snackbar.show(previous === 'PENDING'
      ? `${nameOf(booking)}: ${label}`
      : {
        message: `${nameOf(booking)}: ${label}`,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await setStatus(booking.id, previous)
            snackbar.show(`${nameOf(booking)}: back to ${statusInfo('booking', previous).label}`)
            await load()
          } catch (e) {
            snackbar.show({ message: `Couldn't undo: ${e.message}`, tone: 'error' })
          }
        },
      })
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
