<template>
  <div class="max-w-5xl font-body text-on-surface">
    <Teleport to="#admin-page-actions" defer>
      <!-- Phones: icon only, so the page title keeps its room -->
      <AppButton variant="gold" :icon="IconAdd" class="hidden sm:inline-flex" @click="openNew">Open account</AppButton>
      <IconButton variant="filled" :icon="IconAdd" label="Open account" class="sm:hidden" @click="openNew" />
    </Teleport>

    <!-- Filters: reload on change, search debounced -->
    <section aria-label="Filters" class="mb-4 flex flex-wrap items-start gap-x-4 gap-y-2">
      <TextField
        v-model="search"
        label="Search members"
        type="search"
        autocomplete="off"
        :leading-icon="IconSearch"
        class="w-full sm:w-72"
      />
      <ChipGroup v-model="status" type="choice" label="Status" :options="STATUS_OPTIONS" class="sm:mt-3" />
    </section>

    <p v-if="data" class="mb-3 text-body-m text-on-surface-variant" aria-live="polite">
      {{ data.totals.count }} account{{ data.totals.count === 1 ? '' : 's' }} ·
      <strong class="font-bold text-on-surface tabular-nums">{{ money(data.totals.owedCents) }}</strong> owed
    </p>

    <ErrorBanner v-if="error" :message="error" :retrying="loading" @retry="load" />

    <DataTable
      v-else
      :columns="columns"
      :rows="data?.accounts ?? []"
      :loading="loading && !data"
      caption="House accounts"
      :row-to="a => `/admin/house-accounts/${a.id}`"
      :row-label="a => `${a.user?.name || a.user?.email}, balance ${money(a.balanceCents)}`"
    >
      <template #cell-member="{ row }">
        {{ row.user?.name || row.user?.email }}
        <span v-if="row.user?.name" class="block text-body-s font-normal text-on-surface-variant break-words">{{ row.user.email }}</span>
      </template>
      <template #cell-balance="{ row }">
        <span :class="['tabular-nums', row.balanceCents > 0 ? 'font-bold' : 'text-on-surface-variant']">{{ money(row.balanceCents) }}</span>
        <StatusChip v-if="row.balanceCents > row.creditLimitCents" label="Over limit" tone="error" icon="warning" size="sm" class="ml-1" />
      </template>
      <template #cell-limit="{ row }">
        <span class="tabular-nums text-on-surface-variant">{{ money(row.creditLimitCents) }}</span>
      </template>
      <template #cell-autopay="{ row }">
        <span v-if="row.autopayEnabled" class="inline-flex items-center gap-1 whitespace-nowrap">
          <IconCard class="w-5 h-5 text-on-surface-variant" aria-hidden="true" />{{ cardLabel(row) }}
        </span>
        <span v-else class="text-on-surface-variant">Invoice</span>
      </template>
      <template #cell-pin="{ row }">
        <StatusChip v-if="row.pinLocked" label="Locked" tone="error" icon="lock" size="sm" />
        <span v-else-if="row.hasPin">Set</span>
        <span v-else class="text-on-surface-variant">Not set</span>
      </template>
      <template #cell-status="{ row }">
        <StatusChip kind="houseAccount" :status="row.status" size="sm" />
      </template>
      <template #empty>
        <EmptyState
          :icon="IconWallet"
          :title="search || status ? 'No accounts match' : 'No house accounts yet'"
          :message="search || status ? 'Try another search or status.' : 'Open one for a member so they can charge at the pro shop.'"
          compact
        />
      </template>
    </DataTable>

    <p class="mt-3 text-body-s text-on-surface-variant">
      Members charge to their account at the register with their PIN. Statements go out on the 1st for the previous
      month; members pay online or at the pro shop, or turn on autopay in My Account.
    </p>

    <!-- Open an account -->
    <AppDialog v-model:open="openingOpen" title="Open a house account" size="sm" persistent>
      <form v-if="opening" id="open-account-form" novalidate class="space-y-2 pt-2" @submit.prevent="createAccount">
        <!-- Member search (GET /api/admin/users?search=: any user, not only register customers) -->
        <div v-if="!opening.user">
          <TextField
            v-model="opening.search"
            label="Member"
            type="search"
            placeholder="Search name or email"
            autocomplete="off"
            :leading-icon="IconSearch"
            :helper="opening.search.trim().length === 1 ? 'Type at least 2 characters' : ''"
            aria-controls="open-account-results"
            data-autofocus
          />
          <div id="open-account-results">
            <div v-if="opening.searching" class="flex items-center gap-3 min-h-12 px-1 text-body-m text-on-surface-variant">
              <ProgressIndicator :size="20" /> Searching…
            </div>
            <ul v-else-if="opening.results.length" class="rounded-shape-xs border border-outline-variant divide-y divide-outline-variant max-h-60 overflow-y-auto" aria-label="Matching users">
              <li v-for="u in opening.results" :key="u.id">
                <button
                  type="button"
                  class="state-layer w-full min-h-12 px-3 py-2 text-left text-body-m text-on-surface"
                  @click="pickUser(u)"
                >
                  <span class="block">{{ u.name || u.email }}</span>
                  <span class="block text-body-s text-on-surface-variant">{{ u.email }} · {{ roleLabel(u.role) }}</span>
                </button>
              </li>
            </ul>
            <p v-else-if="opening.searched" class="min-h-12 flex items-center px-1 text-body-m text-on-surface-variant">
              No users match “{{ opening.searched }}”
            </p>
          </div>
          <span class="sr-only" role="status">{{ searchStatus }}</span>
        </div>

        <div v-else class="flex items-center gap-2 rounded-shape-xs border border-outline-variant pl-3 min-h-14">
          <div class="flex-1 min-w-0">
            <div class="text-body-s text-on-surface-variant">Member</div>
            <div class="text-body-l text-on-surface truncate">{{ opening.user.name || opening.user.email }}</div>
          </div>
          <IconButton :icon="IconClose" label="Choose a different member" @click="clearUser" />
        </div>

        <MoneyField
          v-model="opening.limitCents"
          label="Credit limit"
          :min="0"
          helper="The member sets their own PIN in My Account before charging."
        />
        <ErrorBanner v-if="opening.error" :message="opening.error" />
      </form>
      <template #actions="{ close }">
        <AppButton variant="text" :disabled="opening?.busy" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="open-account-form" :loading="opening?.busy" :disabled="!opening?.user">
          {{ opening?.busy ? 'Opening…' : 'Open account' }}
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { useSnackbar } from '@/composables/useSnackbar'
import { cardLabel } from '@/components/accounts/accountDisplay'
import { statusInfo } from '@/components/ui/statusChips'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconCard from '~icons/material-symbols/credit-card-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'CLOSED', label: 'Closed' },
]

const columns = [
  { key: 'member', label: 'Member', primary: true, class: 'min-w-[14rem]' },
  { key: 'balance', label: 'Balance', align: 'right' },
  { key: 'limit', label: 'Limit', align: 'right' },
  { key: 'autopay', label: 'Billing' },
  { key: 'pin', label: 'PIN', hideOnMobile: true },
  { key: 'status', label: 'Status' },
]

const router   = useRouter()
const snackbar = useSnackbar()
const data     = ref(null)
const loading  = ref(false)
const error    = ref(null)
const search   = ref('')
const status   = ref('')
const opening  = ref(null)
const openingOpen = ref(false)

const money = (cents) => (cents === null || cents === undefined
  ? '—'
  : `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

const roleLabel = (role) => statusInfo('role', role).label

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams()
    if (search.value.trim()) params.set('search', search.value.trim())
    if (status.value) params.set('status', status.value)
    data.value = await apiFetch(`/api/admin/house-accounts?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// One filter rule: reload on change, debounce typing
let listTimer = null
watch(search, () => {
  clearTimeout(listTimer)
  listTimer = setTimeout(load, 300)
})
watch(status, () => {
  clearTimeout(listTimer)
  load()
})

// ── Open an account ──
let searchTimer = null
let searchNo = 0

const searchStatus = computed(() => {
  const o = opening.value
  if (!o || o.user) return ''
  if (o.searching) return 'Searching'
  if (!o.searched) return ''
  return o.results.length ? `${o.results.length} user${o.results.length === 1 ? '' : 's'} found` : 'No users found'
})

function openNew() {
  opening.value = { search: '', results: [], searched: '', searching: false, user: null, limitCents: 50000, busy: false, error: null }
  openingOpen.value = true
}

watch(() => opening.value?.search, (value) => {
  const o = opening.value
  if (!o || o.user || value === undefined) return
  clearTimeout(searchTimer)
  const term = value.trim()
  const no = ++searchNo
  if (term.length < 2) {
    Object.assign(o, { results: [], searched: '', searching: false })
    return
  }
  searchTimer = setTimeout(async () => {
    o.searching = true
    o.error = null
    try {
      const res = await apiFetch(`/api/admin/users?${new URLSearchParams({ search: term, limit: 10 })}`)
      if (no !== searchNo || opening.value !== o) return
      o.results = res.users
      o.searched = term
    } catch (e) {
      if (no === searchNo && opening.value === o) o.error = e.message
    } finally {
      if (no === searchNo) o.searching = false
    }
  }, 300)
})

function pickUser(u) {
  opening.value.user = u
}

function clearUser() {
  opening.value.user = null
}

async function createAccount() {
  const o = opening.value
  if (!o?.user || o.busy) return
  o.busy  = true
  o.error = null
  try {
    const account = await apiFetch('/api/admin/house-accounts', {
      method: 'POST', body: { userId: o.user.id, creditLimitCents: o.limitCents ?? 0 },
    })
    openingOpen.value = false
    snackbar.show(`House account opened for ${o.user.name || o.user.email}`)
    router.push(`/admin/house-accounts/${account.id}`)
  } catch (e) {
    o.error = e.message
  } finally {
    o.busy = false
  }
}

onMounted(load)
</script>
