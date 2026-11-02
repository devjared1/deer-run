<template>
  <div class="space-y-6">
    <!-- Filters: every change reloads (search after a 300 ms pause) -->
    <Card variant="outlined">
      <div class="space-y-4">
        <TextField
          v-model="search"
          type="search"
          label="Search"
          placeholder="Name or email"
          :leading-icon="IconSearch"
          autocomplete="off"
        />
        <div class="space-y-1">
          <p class="text-label-l text-on-surface-variant" aria-hidden="true">Role</p>
          <ChipGroup v-model="role" type="choice" :options="ROLE_OPTIONS" label="Role" scroll />
        </div>
      </div>
    </Card>

    <ErrorBanner v-if="error" :message="error" @retry="load" />

    <template v-else>
      <DataTable
        :columns="columns"
        :rows="users"
        :loading="loading"
        manual-sort
        caption="Users"
        :row-label="u => `${u.name || u.email}, ${statusInfo('role', u.role).label}`"
        :row-to="u => `/admin/users/${u.id}`"
      >
        <template #cell-name="{ row }">
          <span class="block">{{ row.name || row.email }}</span>
          <span v-if="row.name" class="block text-body-s font-normal text-on-surface-variant md:hidden">{{ row.email }}</span>
        </template>
        <template #cell-role="{ row }"><StatusChip kind="role" :status="row.role" size="sm" /></template>
        <template #cell-membership="{ row }">
          <template v-if="row.memberUntil">
            <span :class="row.memberUntil < today ? 'text-error' : 'text-on-surface'">
              {{ row.memberUntil < today ? 'Ended' : 'Through' }} {{ formatYmd(row.memberUntil) }}
            </span>
            <span v-if="row.membershipTier" class="text-on-surface-variant"> · {{ row.membershipTier }}</span>
          </template>
          <span v-else-if="row.role === 'MEMBER'" class="text-on-surface-variant">
            No end date<template v-if="row.membershipTier"> · {{ row.membershipTier }}</template>
          </span>
          <span v-else class="text-on-surface-variant">—</span>
        </template>
        <template #cell-createdAt="{ row }">{{ formatJoined(row.createdAt) }}</template>
        <template #actions="{ row }">
          <RowActionsMenu
            :label="`Actions for ${row.name || row.email}`"
            :items="[
              { label: 'Open customer page', icon: IconPerson, onClick: () => router.push(`/admin/users/${row.id}`) },
              { label: 'Edit role and membership', icon: IconManage, onClick: () => { editing = row } },
            ]"
          />
        </template>
        <template #empty>
          <EmptyState
            compact
            :icon="IconGroup"
            :title="search || role ? 'No users match' : 'No users yet'"
            :message="search || role ? 'Try another name or role.' : 'Accounts appear here when people sign up or sign in.'"
            :action-label="search || role ? 'Clear filters' : ''"
            @action="clearFilters"
          />
        </template>
      </DataTable>

      <AppPagination v-model:page="page" :total="total" :page-size="LIMIT" label="Users pages" />
    </template>

    <!-- Edit role + membership -->
    <UserEditDialog :user="editing" @close="editing = null" @saved="load" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatLocalDate, localDate, toUtcIso } from '@/lib/timeclock'
import { statusInfo } from '@/components/ui/statusChips.js'
import AppPagination from '@/components/ui/AppPagination.vue'
import Card from '@/components/ui/Card.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import UserEditDialog from '@/components/admin/users/UserEditDialog.vue'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconManage from '~icons/material-symbols/manage-accounts-rounded'
import IconGroup from '~icons/material-symbols/group-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'

const router = useRouter()

const LIMIT = 25
const ROLES = ['GUEST', 'MEMBER', 'ADMIN']
const ROLE_OPTIONS = [{ value: '', label: 'All roles' }, ...ROLES.map(r => ({ value: r, label: statusInfo('role', r).label }))]
const columns = [
  { key: 'name', label: 'Name', primary: true },
  { key: 'email', label: 'Email', hideOnMobile: true },
  { key: 'role', label: 'Role' },
  { key: 'membership', label: 'Membership' },
  { key: 'createdAt', label: 'Joined', hideOnMobile: true, class: 'whitespace-nowrap' },
]

const users   = ref([])
const loading = ref(true)
const error   = ref(null)
const total   = ref(0)
const page    = ref(1)
const search  = ref('')
const role    = ref('')
const today   = localDate()

const formatYmd = ymd => formatLocalDate(ymd, { month: 'short', day: 'numeric', year: 'numeric' })
const formatJoined = iso => new Date(toUtcIso(iso)).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago',
})

let loadSeq = 0
async function load() {
  const seq = ++loadSeq
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ page: page.value, limit: LIMIT })
    if (role.value) params.set('role', role.value)
    if (search.value.trim()) params.set('search', search.value.trim())
    const data = await apiFetch(`/api/admin/users?${params}`)
    if (seq !== loadSeq) return
    users.value = data.users
    total.value = data.total
  } catch (e) {
    if (seq === loadSeq) error.value = e.message
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function reloadFromFirstPage() {
  if (page.value === 1) load()
  else page.value = 1
}
watch(page, load)
watch(role, reloadFromFirstPage)
let searchTimer = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(reloadFromFirstPage, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

function clearFilters() {
  search.value = ''
  role.value = ''
}

// ── Edit (UserEditDialog) ──
const editing = ref(null)

onMounted(load)
</script>
