<template>
  <div>
    <PageHeader :level="2" :title="`Today, ${formatLocalDate(today, { weekday: 'long', month: 'short', day: 'numeric' })}`">
      <template #subtitle>
        <template v-if="data?.today">
          {{ data.today.players }} player{{ data.today.players === 1 ? '' : 's' }} on the tee sheet ·
          {{ sales ? `${money(sales.net.totalCents)} at the register` : 'register sales loading' }}
        </template>
        <template v-else>How the course is doing today</template>
      </template>
    </PageHeader>

    <Teleport to="#admin-page-actions" defer>
      <IconButton :icon="IconRefresh" label="Refresh dashboard" tooltip @click="loadAll" />
    </Teleport>

    <!-- Quick actions -->
    <nav aria-label="Quick actions" class="mb-6 flex flex-wrap gap-2">
      <AppButton variant="tonal" :icon="IconAdd" to="/staff/teesheet">New booking</AppButton>
      <AppButton variant="tonal" :icon="IconCalendarAdd" to="/admin/teetimes">Add tee times</AppButton>
      <AppButton variant="tonal" :icon="IconPointOfSale" to="/staff/register">Record a sale</AppButton>
      <AppButton variant="tonal" :icon="IconBeach" to="/admin/time-off">
        Review time off<template v-if="pendingTimeOff"> ({{ pendingTimeOff }} pending)</template>
      </AppButton>
    </nav>

    <ErrorBanner v-if="error" class="mb-6" :message="error" @retry="load" />

    <!-- Stat cards -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Players today"
        :loading="loading"
        :value="data?.today.players ?? ''"
        :icon="IconGolf"
        :trend="data && trendOf(data.today.players, data.lastWeek.players, `vs last ${weekdayShort}`)"
        :points="data?.series.map(d => d.players)"
        points-label="Players, last 7 days"
      >
        <p v-if="data" class="mt-1 text-body-m text-on-surface-variant">
          {{ data.today.bookings }} booking{{ data.today.bookings === 1 ? '' : 's' }}
        </p>
      </StatCard>
      <StatCard
        label="Revenue, last 7 days"
        :loading="loading"
        :value="data ? money(data.week.revenueCents) : ''"
        :icon="IconPayments"
        :trend="data && trendOf(data.week.revenueCents, data.week.previousRevenueCents, 'vs prior week')"
        :points="data?.series.map(d => d.revenueCents / 100)"
        points-label="Revenue by day booked, last 7 days, in dollars"
      >
        <p v-if="data" class="mt-1 text-body-m text-on-surface-variant">
          {{ data.week.confirmedBookings }} confirmed booking{{ data.week.confirmedBookings === 1 ? '' : 's' }}
        </p>
      </StatCard>
      <StatCard
        label="Payment not finished"
        :loading="loading"
        :value="data?.pendingBookings ?? ''"
        :icon="IconPending"
        to="/admin/bookings"
      >
        <p v-if="data" class="mt-1 text-body-m text-on-surface-variant">Bookings waiting for payment</p>
      </StatCard>
      <StatCard
        label="Accounts"
        :loading="loading"
        :value="data ? data.totalUsers.toLocaleString('en-US') : ''"
        :icon="IconGroup"
        to="/admin/users"
      >
        <p v-if="data" class="mt-1 text-body-m text-on-surface-variant">Registered users</p>
      </StatCard>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Register sales today -->
      <Card variant="outlined" tag="section" aria-labelledby="dash-sales" class="lg:col-span-2">
        <template #header>
          <div class="flex-1 min-w-0">
            <h3 id="dash-sales" class="text-title-l text-on-surface">Today's register sales</h3>
            <p v-if="sales" class="text-body-m text-on-surface-variant">
              {{ sales.sales.count }} sale{{ sales.sales.count === 1 ? '' : 's' }}
              <template v-if="returnsCount"> · {{ returnsCount }} void{{ returnsCount === 1 ? '' : 's' }} or refund{{ returnsCount === 1 ? '' : 's' }}</template>
            </p>
          </div>
          <AppButton variant="text" :trailing-icon="IconArrowForward" to="/admin/sales">Sales & reports</AppButton>
        </template>
        <ErrorBanner v-if="salesError" :message="salesError" @retry="loadSales" />
        <Skeleton v-else-if="!sales" variant="text" :lines="4" label="Loading register sales" />
        <div v-else class="space-y-4">
          <dl class="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt class="text-body-m text-on-surface-variant">Net sales</dt>
              <dd class="text-title-l text-on-surface tabular-nums">{{ money(sales.net.salesCents) }}</dd>
            </div>
            <div>
              <dt class="text-body-m text-on-surface-variant">Tax</dt>
              <dd class="text-title-l text-on-surface tabular-nums">{{ money(sales.net.taxCents) }}</dd>
            </div>
            <div>
              <dt class="text-body-m text-on-surface-variant">Total</dt>
              <dd class="text-title-l text-on-surface tabular-nums">{{ money(sales.net.totalCents) }}</dd>
            </div>
          </dl>
          <ul v-if="sales.categories.length" class="space-y-2" aria-label="Net sales by category">
            <li v-for="c in sales.categories" :key="c.name" class="grid grid-cols-[minmax(0,8rem)_1fr_auto] sm:grid-cols-[12rem_1fr_6rem] items-center gap-3 text-body-m">
              <span class="truncate text-on-surface">{{ c.name }}</span>
              <span class="block h-2 rounded-full bg-surface-container-highest overflow-hidden" aria-hidden="true">
                <span class="block h-full rounded-full bg-primary" :style="{ width: `${categoryWidth(c.netCents)}%` }" />
              </span>
              <span class="text-right tabular-nums text-on-surface">{{ money(c.netCents) }}</span>
            </li>
          </ul>
          <EmptyState v-else compact :icon="IconReceipt" title="No register sales yet today" />
        </div>
      </Card>

      <!-- On the clock -->
      <Card variant="outlined" tag="section" aria-labelledby="dash-clock">
        <template #header>
          <div class="flex-1 min-w-0">
            <h3 id="dash-clock" class="text-title-l text-on-surface">On the clock</h3>
            <p v-if="onClock" class="text-body-m text-on-surface-variant">{{ onClock.length }} {{ onClock.length === 1 ? 'person' : 'people' }}</p>
          </div>
          <AppButton variant="text" :trailing-icon="IconArrowForward" to="/admin/timesheets">Timesheets</AppButton>
        </template>
        <ErrorBanner v-if="onClockError" :message="onClockError" @retry="loadOnClock" />
        <Skeleton v-else-if="!onClock" variant="text" :lines="3" label="Loading who's on the clock" />
        <ul v-else-if="onClock.length" class="divide-y divide-outline-variant -my-2">
          <li v-for="e in onClock" :key="e.id" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="truncate text-body-l text-on-surface">{{ e.employee?.firstName }} {{ e.employee?.lastName }}</p>
              <p class="text-body-m text-on-surface-variant">
                {{ positionLabel(e.employee?.position) }} · since {{ formatClockTime(e.clockIn) }}
                <template v-if="e.date !== today">({{ formatLocalDate(e.date) }})</template>
              </p>
            </div>
            <StatusChip v-if="e.longOpen" size="sm" label="Missed clock-out?" tone="error" icon="warning" />
            <StatusChip v-else-if="e.status === 'break'" size="sm" label="On break" tone="warning" icon="pause" />
            <StatusChip v-else size="sm" label="Working" tone="success" icon="check" />
          </li>
        </ul>
        <EmptyState v-else compact :icon="IconPunchClock" title="Nobody is on the clock" />
      </Card>

      <!-- Upcoming tournaments -->
      <Card variant="outlined" tag="section" aria-labelledby="dash-events">
        <template #header>
          <h3 id="dash-events" class="flex-1 min-w-0 text-title-l text-on-surface">Upcoming tournaments</h3>
          <AppButton variant="text" :trailing-icon="IconArrowForward" to="/admin/tournaments">Manage</AppButton>
        </template>
        <p v-if="error" class="text-body-m text-on-surface-variant">Couldn't load the tournaments (see the message above).</p>
        <Skeleton v-else-if="loading" variant="text" :lines="3" label="Loading tournaments" />
        <ul v-else-if="data.upcomingEvents.length" class="divide-y divide-outline-variant -my-2">
          <li v-for="e in data.upcomingEvents" :key="e.id" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="truncate text-body-l text-on-surface">{{ e.name }}</p>
              <p class="text-body-m text-on-surface-variant">
                {{ formatLocalDate(e.eventDate.slice(0, 10), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }}
              </p>
            </div>
            <StatusChip v-if="e.featured" size="sm" label="Featured" tone="warning" icon="flag" />
          </li>
        </ul>
        <EmptyState v-else compact :icon="IconTrophy" title="No upcoming events" action-label="Add an event" to="/admin/tournaments" />
      </Card>

      <!-- Recent bookings -->
      <section aria-labelledby="dash-bookings" class="lg:col-span-2 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 id="dash-bookings" class="text-title-l text-on-surface">Recent bookings</h3>
          <AppButton variant="text" :trailing-icon="IconArrowForward" to="/admin/bookings">All bookings</AppButton>
        </div>
        <p v-if="error" class="text-body-m text-on-surface-variant">Couldn't load the recent bookings (see the message above).</p>
        <DataTable
          v-else
          :columns="bookingColumns"
          :rows="data?.recentBookings ?? []"
          :loading="loading"
          dense
          manual-sort
          caption="Recent bookings"
          empty-text="No bookings yet"
        >
          <template #cell-tee="{ row }">
            <span class="whitespace-nowrap">{{ row.TeeTimeSlot ? teeLabel(row.TeeTimeSlot) : '—' }}</span>
          </template>
          <template #cell-total="{ row }"><span class="tabular-nums">{{ money(row.totalCents) }}</span></template>
          <template #cell-status="{ row }"><StatusChip kind="booking" :status="row.status" size="sm" /></template>
        </DataTable>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { positionLabel } from '@/data/employeePositions'
import { formatClockTime, formatLocalDate, localDate } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import { apiFetch } from '@/lib/api'
import { usePendingTimeOff } from '@/composables/usePendingTimeOff'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconCalendarAdd from '~icons/material-symbols/calendar-add-on-rounded'
import IconPointOfSale from '~icons/material-symbols/point-of-sale-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'
import IconRefresh from '~icons/material-symbols/refresh-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconPending from '~icons/material-symbols/pending-actions-rounded'
import IconGroup from '~icons/material-symbols/group-rounded'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconPunchClock from '~icons/material-symbols/punch-clock-rounded'
// emoji_events has no rounded variant in the icon set; trophy-rounded is the same glyph
import IconTrophy from '~icons/material-symbols/trophy-rounded'

const today = localDate()
const weekdayShort = formatLocalDate(today, { weekday: 'short' })

const loading = ref(true)
const error   = ref(null)
const data    = ref(null)

const { pending: pendingTimeOff, refresh: refreshPendingTimeOff } = usePendingTimeOff()

// "$1,234.56"
const money = cents => ((cents ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const teeLabel = slot => `${formatLocalDate(slot.date)}, ${teeTime(slot.startTime)}`

const bookingColumns = [
  { key: 'name', label: 'Guest / member', primary: true, format: (_, b) => b.User?.name || b.guestName || b.User?.email || 'Guest' },
  { key: 'tee', label: 'Tee time' },
  { key: 'players', label: 'Players', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status' },
]

/** StatCard trend: percent change from `prev` (or "+n" when there was nothing before). */
function trendOf(cur, prev, label) {
  if (cur === prev) return { value: 'Same', direction: 'flat', label }
  if (!prev) return { value: 'New', direction: 'up', good: true, label }
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return { value: '0%', direction: 'flat', label }
  return { value: `${pct > 0 ? '+' : ''}${pct}%`, direction: pct > 0 ? 'up' : 'down', good: pct > 0, label }
}

async function load() {
  loading.value = true
  error.value   = null
  try {
    data.value = await apiFetch('/api/admin/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Loaded separately so a time clock problem doesn't break the rest of the dashboard
const onClock      = ref(null)
const onClockError = ref(null)
async function loadOnClock() {
  onClockError.value = null
  try {
    onClock.value = await apiFetch('/api/admin/timeclock')
  } catch (e) {
    onClockError.value = e.message
  }
}

// Today's register sales by category (same report as Admin → Sales → Report)
const sales      = ref(null)
const salesError = ref(null)
async function loadSales() {
  salesError.value = null
  try {
    sales.value = await apiFetch(`/api/admin/sales/report?date=${today}`)
  } catch (e) {
    salesError.value = e.message
  }
}
const returnsCount = computed(() => (sales.value ? sales.value.returns.voidCount + sales.value.returns.refundCount : 0))

function categoryWidth(cents) {
  const max = Math.max(1, ...sales.value.categories.map(c => c.netCents))
  return Math.max(0, Math.round((cents / max) * 100))
}

function loadAll() {
  load()
  loadOnClock()
  loadSales()
  refreshPendingTimeOff()
}

onMounted(loadAll)
</script>
