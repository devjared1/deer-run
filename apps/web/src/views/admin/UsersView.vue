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
        @row-click="openEdit"
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
            :items="[{ label: 'Edit role and membership', icon: IconManage, onClick: () => openEdit(row) }]"
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
    <AppDialog :open="!!editing" title="Edit user" persistent @update:open="v => { if (!v) editing = null }">
      <template v-if="editing">
        <p class="mb-4 text-body-m text-on-surface-variant break-words">
          <template v-if="editing.name">{{ editing.name }} · </template>{{ editing.email }}
        </p>
        <form id="user-form" class="space-y-5" @submit.prevent="save">
          <RadioGroup
            v-model="newRole"
            label="Role"
            :options="ROLES.map(r => ({ value: r, label: statusInfo('role', r).label, description: ROLE_DESC[r] }))"
          />
          <div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <TextField v-model="membership.until" type="date" label="Member until" />
            <SelectField
              v-model="membership.tier"
              label="Tier"
              placeholder="None"
              :options="membershipTiers.map(t => ({ value: t.name, label: t.name }))"
            />
          </div>
          <p class="-mt-2 text-body-s text-on-surface-variant">
            Last day of membership. Leave it empty for no end date. Memberships sold at the register set this
            automatically; members drop to Guest after it passes.
          </p>
        </form>
        <ErrorBanner v-if="formError" class="mt-4" :message="formError" />
      </template>
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="user-form" :loading="saving" :disabled="!changed">Save</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatLocalDate, localDate, toUtcIso } from '@/lib/timeclock'
import { membershipTiers } from '@/data/membershipTiers'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import { statusInfo } from '@/components/ui/statusChips.js'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import Card from '@/components/ui/Card.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import SelectField from '@/components/ui/SelectField.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconManage from '~icons/material-symbols/manage-accounts-rounded'
import IconGroup from '~icons/material-symbols/group-rounded'

const confirm  = useConfirm()
const snackbar = useSnackbar()

const LIMIT = 25
const ROLES = ['GUEST', 'MEMBER', 'ADMIN']
const ROLE_OPTIONS = [{ value: '', label: 'All roles' }, ...ROLES.map(r => ({ value: r, label: statusInfo('role', r).label }))]
const ROLE_DESC = {
  GUEST:  'Limited access, no member pricing',
  MEMBER: 'Extended booking window + member-only slots',
  ADMIN:  'Full admin panel access',
}
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

// ── Edit ──
const editing    = ref(null)
const newRole    = ref('')
const membership = ref({ until: '', tier: null })
const saving     = ref(false)
const formError  = ref(null)

const changed = computed(() => !!editing.value && (newRole.value !== editing.value.role ||
  membership.value.until !== (editing.value.memberUntil ?? '') || (membership.value.tier ?? '') !== (editing.value.membershipTier ?? '')))

function openEdit(user) {
  editing.value = user
  newRole.value = user.role
  membership.value = { until: user.memberUntil ?? '', tier: user.membershipTier ?? null }
  formError.value = null
}

async function putUser(id, body) {
  return apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body })
}

async function save() {
  const user = editing.value
  if (!user || !changed.value) return
  const who = user.name || user.email
  if (newRole.value === 'ADMIN' && user.role !== 'ADMIN' && !(await confirm({
    title: `Make ${who} an admin?`,
    message: "They'll get full access to the admin panel.",
    confirmLabel: 'Make admin',
  }))) return

  saving.value = true
  formError.value = null
  try {
    await putUser(user.id, {
      ...(newRole.value !== user.role ? { role: newRole.value } : {}),
      memberUntil: membership.value.until || null,
      membershipTier: membership.value.tier || null,
    })
    editing.value = null
    // Undo puts the old role and membership back through the same API
    const before = { role: user.role, memberUntil: user.memberUntil ?? null, membershipTier: user.membershipTier ?? null }
    const roleChanged = newRole.value !== user.role
    snackbar.show({
      message: `Saved ${who}`,
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          await putUser(user.id, roleChanged ? before : { memberUntil: before.memberUntil, membershipTier: before.membershipTier })
          snackbar.show(`Restored ${who}`)
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
