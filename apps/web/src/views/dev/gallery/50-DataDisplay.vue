<template>
  <div class="space-y-10">
    <div>
      <h3 class="text-title-m mb-3">PageHeader</h3>
      <div class="space-y-6 rounded-shape-md border border-outline-variant p-4">
        <PageHeader
          title="Smith, Alex"
          subtitle="House account · Gold member"
          :breadcrumbs="[{ label: 'Pro Shop', to: '/dev/ui' }, { label: 'House accounts', to: '/dev/ui' }, { label: 'Smith, Alex' }]"
          back="/dev/ui"
          back-label="All house accounts"
        >
          <template #secondary>
            <IconButton :icon="IconDownload" label="Export CSV" />
          </template>
          <template #actions>
            <AppButton :icon="IconAdd">New charge</AppButton>
          </template>
        </PageHeader>
        <PageHeader title="Section header (h2)" :level="2" subtitle="No breadcrumbs or back link" />
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">Card</h3>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="v in ['elevated', 'filled', 'outlined']" :key="v" :variant="v">
          <template #header>
            <h4 class="text-title-m">{{ v }}</h4>
          </template>
          <p class="text-body-m text-on-surface-variant">Static card with a header, body and footer.</p>
          <template #footer>
            <AppButton variant="text">Details</AppButton>
          </template>
        </Card>
        <Card variant="elevated" to="/dev/ui">
          <p class="text-title-m">Link card (to)</p>
          <p class="text-body-m text-on-surface-variant">The whole card is a RouterLink.</p>
        </Card>
        <Card variant="outlined" clickable @click="clicks++">
          <p class="text-title-m">Button card (clickable)</p>
          <p class="text-body-m text-on-surface-variant">Clicked {{ clicks }} time{{ clicks === 1 ? '' : 's' }}.</p>
        </Card>
        <Card variant="filled" padding="lg">
          <template #media>
            <div class="h-24 bg-primary-container text-on-primary-container flex items-center justify-center">
              <IconGolf class="w-10 h-10" aria-hidden="true" />
            </div>
          </template>
          <p class="text-title-m">Media + padding lg</p>
        </Card>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">StatCard</h3>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Rounds today"
          value="86"
          :icon="IconGolf"
          :trend="{ value: '+12%', direction: 'up', good: true, label: 'vs last Sat' }"
          :points="[52, 60, 58, 71, 66, 80, 86]"
          points-label="Last 7 days"
        />
        <StatCard
          label="Pro Shop sales"
          value="$1,284"
          :icon="IconPayments"
          :trend="{ value: '−8%', direction: 'down', good: false }"
          :points="[1500, 1420, 1390, 1284]"
          to="/dev/ui"
        />
        <StatCard label="Open drawers" value="2" :trend="{ value: '0', direction: 'flat' }" />
        <StatCard label="Loading" loading />
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">StatusChip</h3>
      <div class="space-y-3">
        <div v-for="(statuses, kind) in STATUS_MAP" :key="kind" class="flex flex-wrap items-center gap-2">
          <span class="w-28 text-label-m text-on-surface-variant">{{ kind }}</span>
          <StatusChip v-for="(_, status) in statuses" :key="status" :kind="kind" :status="status" />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="w-28 text-label-m text-on-surface-variant">sm / other</span>
          <StatusChip kind="sale" status="VOIDED" size="sm" />
          <StatusChip kind="booking" status="CONFIRMED" size="sm" />
          <StatusChip label="Working" tone="success" icon="check" />
          <StatusChip label="No icon" tone="info" :icon="false" />
          <StatusChip kind="sale" status="SOMETHING_NEW" />
        </div>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">AppTabs</h3>
      <div class="space-y-6">
        <AppTabs v-model="tab" :tabs="iconTabs" label="Sales views">
          <template #sales>
            <p class="text-body-m">Sales panel (primary tabs with icons and a badge).</p>
          </template>
          <template #report>
            <p class="text-body-m">End-of-day report panel.</p>
          </template>
          <template #drawers>
            <p class="text-body-m">Cash drawers panel.</p>
          </template>
        </AppTabs>
        <AppTabs v-model="tab2" :tabs="textTabs" variant="secondary" label="Settings sections">
          <template #default="{ tab: t }">
            <p class="text-body-m">{{ t.label }} settings (secondary tabs; this row scrolls on a phone).</p>
          </template>
        </AppTabs>
        <div>
          <AppTabs v-model="tab3" :tabs="[{ key: 'all', label: 'All' }, { key: 'open', label: 'Open', badge: 2 }, { key: 'closed', label: 'Closed' }]" label="Filter" />
          <p class="mt-2 text-body-m text-on-surface-variant">Tabs only (no panels), selected: {{ tab3 }}</p>
        </div>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">DataTable</h3>
      <div class="space-y-6">
        <div>
          <DataTable
            v-model:sort="sort"
            :columns="columns"
            :rows="pageRows"
            caption="Bookings"
            caption-visible
            @row-click="row => lastClicked = row.name"
          >
            <template #cell-status="{ row }">
              <StatusChip kind="booking" :status="row.status" size="sm" />
            </template>
            <template #actions="{ row }">
              <IconButton :icon="IconMore" :label="`Actions for ${row.name}`" size="sm" @click="lastClicked = `actions: ${row.name}`" />
            </template>
          </DataTable>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-body-m text-on-surface-variant">
              Sort: {{ sort.key }} {{ sort.dir }} · Last click: {{ lastClicked || '—' }}
            </p>
          </div>
          <AppPagination v-model:page="page" :total="bookings.length" :page-size="4" class="mt-2" />
        </div>
        <DataTable :columns="columns.slice(0, 4)" :rows="bookings.slice(0, 3)" dense caption="Dense, not clickable" caption-visible />
        <DataTable :columns="columns" :rows="[]" caption="Empty" caption-visible>
          <template #empty>No bookings for this day</template>
        </DataTable>
        <DataTable :columns="columns" :rows="[]" loading :loading-rows="3" caption="Loading" caption-visible />
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">AppPagination</h3>
      <div class="space-y-4">
        <AppPagination v-model:page="pageA" :page-count="12" />
        <AppPagination v-model:page="pageB" :total="312" :page-size="50" label="Sales pages" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Data display',
  galleryNote: 'Below the md breakpoint (768px) DataTable renders as a stacked list of cards: resize the window to see it.',
}
</script>

<script setup>
import { computed, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Card from '@/components/ui/Card.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import { STATUS_MAP } from '@/components/ui/statusChips.js'
import AppTabs from '@/components/ui/AppTabs.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconDownload from '~icons/material-symbols/download-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconMore from '~icons/material-symbols/more-vert-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'

const clicks = ref(0)

const tab = ref('sales')
const tab2 = ref('booking')
const tab3 = ref('all')
const iconTabs = [
  { key: 'sales', label: 'Sales', icon: IconReceipt },
  { key: 'report', label: 'Report', icon: IconPayments },
  { key: 'drawers', label: 'Drawers', icon: IconWallet, badge: 1 },
]
const textTabs = ['Booking', 'Payroll', 'Point of Sale', 'Tipping', 'On Course', 'House Accounts']
  .map(label => ({ key: label.toLowerCase().replace(/ /g, '-'), label }))

const columns = [
  { key: 'name', label: 'Name', sortable: true, primary: true },
  { key: 'time', label: 'Tee time', sortable: true, sortValue: r => r.minutes },
  { key: 'players', label: 'Players', align: 'right', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'totalCents', label: 'Total', align: 'right', sortable: true, format: v => `$${(v / 100).toFixed(2)}` },
  { key: 'email', label: 'Email', hideOnMobile: true },
]
const bookings = [
  { id: 1, name: 'Smith party', time: '7:30 AM', minutes: 450, players: 4, status: 'CONFIRMED', totalCents: 18000, email: 'smith@example.com' },
  { id: 2, name: 'Jones, Pat', time: '7:40 AM', minutes: 460, players: 2, status: 'CHECKED_IN', totalCents: 9000, email: 'pat@example.com' },
  { id: 3, name: 'Walk-in', time: '8:10 AM', minutes: 490, players: 1, status: 'PENDING', totalCents: 4500, email: '' },
  { id: 4, name: 'Garcia, Lee', time: '9:00 AM', minutes: 540, players: 3, status: 'CANCELLED', totalCents: 13500, email: 'lee@example.com' },
  { id: 5, name: 'Brown, Sam', time: '10:20 AM', minutes: 620, players: 4, status: 'REFUNDED', totalCents: 18000, email: 'sam@example.com' },
  { id: 6, name: 'Online guest', time: '11:00 AM', minutes: 660, players: 2, status: 'HOLD_EXPIRED', totalCents: 9000, email: 'guest@example.com' },
]
const sort = ref({ key: 'time', dir: 'asc' })
const lastClicked = ref('')
const page = ref(1)
// The gallery pages an unsorted list; real pages sort server-side (manual-sort) or page after sorting
const pageRows = computed(() => bookings.slice((page.value - 1) * 4, page.value * 4))

const pageA = ref(5)
const pageB = ref(1)
</script>
