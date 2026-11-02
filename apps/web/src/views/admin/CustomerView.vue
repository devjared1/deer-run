<template>
  <div class="space-y-6">
    <ErrorBanner v-if="error" :message="error" @retry="load" />

    <template v-else>
      <PageHeader :level="2" :title="title">
        <template #subtitle>
          <span v-if="data" class="inline-flex flex-wrap items-center gap-2">
            <span v-if="data.user.name" class="break-all">{{ data.user.email }}</span>
            <StatusChip kind="role" :status="data.user.role" size="sm" />
            <span v-if="membershipLine">{{ membershipLine }}</span>
          </span>
          <Skeleton v-else variant="text" width="16rem" label="Loading the customer" />
        </template>
        <template #actions>
          <AppButton v-if="data" variant="tonal" :icon="IconManage" @click="editing = data.user">Role and membership</AppButton>
        </template>
      </PageHeader>

      <!-- Totals -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Rounds played" :loading="!data" :value="data?.stats.roundsPlayed ?? ''" :icon="IconGolf">
          <p v-if="data" class="mt-1 text-body-m text-on-surface-variant">{{ data.stats.upcoming }} upcoming</p>
        </StatCard>
        <StatCard label="Spent at the register" :loading="!data" :value="data ? formatCents(data.stats.registerNetCents) : ''" :icon="IconPointOfSale">
          <p v-if="data" class="mt-1 text-body-m text-on-surface-variant">
            {{ data.stats.salesCount }} sale{{ data.stats.salesCount === 1 ? '' : 's' }}, after refunds
          </p>
        </StatCard>
        <StatCard label="Paid online" :loading="!data" :value="data ? formatCents(data.stats.onlinePaidCents) : ''" :icon="IconPayments">
          <p v-if="data" class="mt-1 text-body-m text-on-surface-variant">Tee time bookings</p>
        </StatCard>
        <StatCard
          label="House account"
          :loading="!data"
          :value="data?.houseAccount ? formatCents(data.houseAccount.balanceCents) : (data ? 'None' : '')"
          :icon="IconWallet"
          :to="data?.houseAccount ? `/admin/house-accounts/${data.houseAccount.id}` : undefined"
        >
          <p v-if="data?.houseAccount" class="mt-1 text-body-m text-on-surface-variant">
            Balance · {{ statusInfo('houseAccount', data.houseAccount.status).label }}
          </p>
          <p v-else-if="data" class="mt-1 text-body-m text-on-surface-variant">Open one in House Accounts</p>
        </StatCard>
      </div>

      <p v-if="data?.employee" class="flex items-center gap-2 text-body-m text-on-surface-variant">
        <IconBadge class="w-5 h-5 flex-none" aria-hidden="true" />
        Also an employee: {{ positionLabel(data.employee.position) }}<template v-if="!data.employee.active"> (inactive)</template>.
        <RouterLink to="/admin/employees" class="text-primary underline">Employees</RouterLink>
      </p>

      <!-- Tee times -->
      <section aria-labelledby="customer-bookings" class="space-y-3">
        <h3 id="customer-bookings" class="text-title-l text-on-surface">Tee times</h3>
        <DataTable
          :columns="bookingColumns"
          :rows="data?.bookings ?? []"
          :loading="!data"
          dense
          manual-sort
          caption="Tee times"
          empty-text="No tee times booked"
        >
          <template #cell-tee="{ row }">
            <span class="whitespace-nowrap">{{ row.slot ? `${formatLocalDate(row.slot.date)}, ${teeTime(row.slot.startTime)}` : '—' }}</span>
          </template>
          <template #cell-total="{ row }">
            <span class="tabular-nums">{{ formatCents(row.totalCents) }}</span>
            <span v-if="row.holdFeeCents != null && row.balanceDueCents" class="block text-body-s text-on-surface-variant whitespace-nowrap">
              {{ formatCents(row.balanceDueCents) }} due at course
            </span>
          </template>
          <template #cell-status="{ row }">
            <StatusChip kind="booking" :status="bookingStatus({ ...row, holdExpired: row.holdExpired })" size="sm" />
          </template>
        </DataTable>
      </section>

      <!-- Purchases -->
      <section aria-labelledby="customer-sales" class="space-y-3">
        <h3 id="customer-sales" class="text-title-l text-on-surface">Register purchases</h3>
        <DataTable
          :columns="saleColumns"
          :rows="data?.sales ?? []"
          :loading="!data"
          dense
          manual-sort
          caption="Register purchases"
          empty-text="No purchases with this customer attached"
          :row-to="s => ({ path: '/admin/sales', query: { sale: s.id } })"
          :row-label="s => `Receipt #${s.number}, ${formatCents(s.totalCents)}`"
        >
          <template #cell-number="{ row }">Receipt #{{ row.number }}</template>
          <template #cell-total="{ row }">
            <span class="tabular-nums">{{ formatCents(row.totalCents) }}</span>
            <span v-if="row.refundedCents" class="block text-body-s text-on-surface-variant whitespace-nowrap">
              −{{ formatCents(row.refundedCents) }} refunded
            </span>
          </template>
          <template #cell-status="{ row }"><StatusChip kind="sale" :status="row.status" size="sm" /></template>
        </DataTable>
        <p v-if="data && data.stats.salesCount > data.sales.length" class="text-body-s text-on-surface-variant">
          Showing the latest {{ data.sales.length }} of {{ data.stats.salesCount }}.
        </p>
      </section>
    </template>

    <UserEditDialog :user="editing" @close="editing = null" @saved="load" />
  </div>
</template>

<script setup>
// Admin → Users → one customer (/admin/users/:id): who they are, membership, rounds, what they've spent, their house
// account, and their tee times and register purchases (each purchase opens its receipt). GET /api/admin/users/:id.
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { teeTime } from '@/lib/teesheet'
import { formatLocalDate, localDate, toUtcIso } from '@/lib/timeclock'
import { positionLabel } from '@/data/employeePositions'
import { bookingStatus, statusInfo } from '@/components/ui/statusChips'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import UserEditDialog from '@/components/admin/users/UserEditDialog.vue'
import IconManage from '~icons/material-symbols/manage-accounts-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconPointOfSale from '~icons/material-symbols/point-of-sale-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'
import IconBadge from '~icons/material-symbols/badge-rounded'

const route = useRoute()

const data    = ref(null)
const error   = ref(null)
const editing = ref(null)

const today = localDate()
const title = computed(() => data.value?.user.name || data.value?.user.email || 'Customer')

const membershipLine = computed(() => {
  const u = data.value?.user
  if (!u?.memberUntil && u?.role !== 'MEMBER') return ''
  const tier = u.membershipTier ? `${u.membershipTier} member` : 'Member'
  if (!u.memberUntil) return `${tier}, no end date`
  const date = formatLocalDate(u.memberUntil, { month: 'short', day: 'numeric', year: 'numeric' })
  return u.memberUntil < today ? `${tier}, ended ${date}` : `${tier} through ${date}`
})

const SOURCES = { ONLINE: 'Online', POS: 'Pro shop', PHONE: 'Phone' }
const bookingColumns = [
  { key: 'tee', label: 'Tee time', primary: true },
  { key: 'players', label: 'Players', align: 'right' },
  { key: 'source', label: 'Booked', hideOnMobile: true, format: v => SOURCES[v] ?? v },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status' },
]

const formatWhen = iso => new Date(toUtcIso(iso)).toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago',
})
const saleColumns = [
  { key: 'number', label: 'Receipt', primary: true },
  { key: 'createdAt', label: 'When', format: v => formatWhen(v) },
  { key: 'register', label: 'Register', hideOnMobile: true, format: (_, s) => s.register?.name ?? '—' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status' },
]

async function load() {
  error.value = null
  try {
    data.value = await apiFetch(`/api/admin/users/${encodeURIComponent(route.params.id)}`)
  } catch (e) {
    error.value = e.message
  }
}

// Search can jump from one customer to another without leaving the page
watch(() => route.params.id, id => { if (id) { data.value = null; load() } }, { immediate: true })
</script>
