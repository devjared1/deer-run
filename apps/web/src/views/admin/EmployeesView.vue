<template>
  <div>
    <Teleport to="#admin-page-actions" defer>
      <AppButton :icon="IconPersonAdd" class="hidden sm:inline-flex" @click="openCreate">New employee</AppButton>
      <IconButton :icon="IconPersonAdd" variant="filled" label="New employee" class="sm:hidden" @click="openCreate" />
    </Teleport>

    <!-- Filters: reload on change, search debounced -->
    <div class="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-start gap-3">
      <TextField
        v-model="filters.search"
        type="search"
        label="Search"
        placeholder="Name or email"
        :leading-icon="IconSearch"
        autocomplete="off"
      />
      <SelectField v-model="filters.position" label="Position" placeholder="All positions">
        <optgroup v-for="dept in departments" :key="dept" :label="dept">
          <option v-for="p in positionsIn(dept)" :key="p.value" :value="p.value">{{ p.label }}</option>
        </optgroup>
      </SelectField>
      <SegmentedButton
        v-model="filters.status"
        label="Status"
        class="sm:col-span-2 lg:col-span-1 lg:mt-2"
        :options="[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'all', label: 'All' }]"
      />
      <AppButton v-if="filtersChanged" variant="text" class="justify-self-start lg:mt-2" @click="resetFilters">Reset</AppButton>
    </div>

    <ErrorBanner v-if="error" :message="error" @retry="load" />

    <template v-else>
      <ErrorBanner v-if="actionError" class="mb-3" :message="actionError" @dismiss="actionError = null" />

      <DataTable
        :columns="columns"
        :rows="employees"
        :loading="loading && !loaded"
        caption="Employees"
        :row-label="emp => `Edit ${fullName(emp)}`"
        @row-click="openEdit"
      >
        <template #cell-name="{ row }">{{ fullName(row) }}</template>
        <template #cell-contact="{ row }">
          <span class="block [overflow-wrap:anywhere]">{{ row.email }}</span>
          <span v-if="row.phone" class="block whitespace-nowrap text-body-s text-on-surface-variant">{{ row.phone }}</span>
        </template>
        <template #cell-status="{ row }">
          <span class="inline-flex flex-wrap items-center gap-1">
            <StatusChip
              :label="row.active ? 'Active' : 'Inactive'"
              :tone="row.active ? 'success' : 'neutral'"
              :icon="row.active ? 'check' : 'block'"
              size="sm"
            />
            <span
              v-if="!row.userId"
              title="No site account uses this email yet. It links automatically the first time they sign in with it."
            >
              <StatusChip label="No login yet" tone="neutral" :icon="false" size="sm" />
            </span>
            <StatusChip v-if="row.managerPinLocked" label="PIN locked" tone="error" icon="lock" size="sm" />
            <StatusChip v-if="row.clockPinLocked" label="Clock PIN locked" tone="error" icon="lock" size="sm" />
          </span>
          <span v-if="pinNote(row)" class="block mt-1 text-body-s text-on-surface-variant">{{ pinNote(row) }}</span>
        </template>
        <template #empty>
          <EmptyState
            compact
            :icon="IconBadge"
            :title="filtersChanged ? 'No employees match' : 'No employees yet'"
            :message="filtersChanged ? 'Try another search or position.' : 'Add your staff so they can clock in and use the register.'"
            :action-label="filtersChanged ? 'Reset filters' : 'New employee'"
            @action="filtersChanged ? resetFilters() : openCreate()"
          />
        </template>
        <template #actions="{ row }">
          <RowActionsMenu :label="`Actions for ${fullName(row)}`" :items="rowActions(row)" />
        </template>
      </DataTable>

      <p v-if="employees.length" class="mt-3 text-body-m text-on-surface-variant" aria-live="polite">
        {{ employees.length }} employee{{ employees.length === 1 ? '' : 's' }}
      </p>
    </template>

    <!-- Create / edit -->
    <AppDialog
      v-model:open="showForm"
      :title="formData.id ? 'Edit employee' : 'New employee'"
      persistent
      fullscreen-on-mobile
      :confirm-label="formData.id ? 'Save' : 'Create'"
      :confirm-loading="saving"
      @confirm="submitForm"
    >
      <form id="employee-form" ref="formEl" class="space-y-4 pt-2 pb-2" @submit.prevent="submitForm">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField v-model="formData.firstName" label="First name" required autocomplete="off" data-autofocus />
          <TextField v-model="formData.lastName" label="Last name" required autocomplete="off" />
        </div>
        <TextField
          v-model="formData.email"
          type="email"
          label="Email"
          required
          autocomplete="off"
          helper="The employee signs in to the staff portal with a site account that uses this email."
        />
        <TextField v-model="formData.phone" type="tel" label="Phone" autocomplete="off" placeholder="(256) 555-0100" />
        <SelectField v-model="formData.position" label="Position" required placeholder="Select a position">
          <optgroup v-for="dept in departments" :key="dept" :label="dept">
            <option v-for="p in positionsIn(dept)" :key="p.value" :value="p.value">{{ p.label }}</option>
          </optgroup>
        </SelectField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MoneyField v-model="formData.hourlyRateCents" label="Hourly rate" :min="0" :max="100000" helper="Optional" />
          <TextField v-model="formData.hireDate" type="date" label="Hire date" float-label />
        </div>
        <Switch v-model="formData.active" label="Active" helper="Inactive employees can't use the staff portal." />
        <ErrorBanner v-if="formError" :message="formError" />
      </form>
      <template #actions="{ close }">
        <AppButton variant="text" :disabled="saving" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="employee-form" :loading="saving">
          {{ formData.id ? 'Save changes' : 'Create employee' }}
        </AppButton>
      </template>
    </AppDialog>

    <!-- Time clock (kiosk) PIN, set by an admin: staff without a login, or a forgotten PIN -->
    <AppDialog
      :open="!!clockPinFor"
      :title="clockPinFor ? `Time clock PIN for ${fullName(clockPinFor)}` : ''"
      persistent
      size="sm"
      @update:open="v => { if (!v) clockPinFor = null }"
    >
      <template v-if="clockPinFor">
        <p class="mb-4 text-body-m text-on-surface-variant">
          {{ clockPinFor.firstName }} uses it on the time clock iPad. Tell them the PIN; they can change it later on the
          staff portal's Time Clock page.{{ clockPinFor.hasClockPin ? ' This replaces their current PIN.' : '' }}
        </p>
        <div class="flex justify-center">
          <NumericKeypad
            v-model="clockPin"
            label="New PIN"
            :max-length="6"
            autofocus
            :hint="clockPinError || '4 to 6 digits'"
            :error="!!clockPinError"
            submit-label="Save PIN"
            :loading="clockPinSaving"
            @submit="saveClockPin"
          />
        </div>
      </template>
      <template #actions="{ close }">
        <AppButton variant="text" :disabled="clockPinSaving" @click="close">Cancel</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { formatLocalDate } from '@/lib/timeclock'
import { employeePositions, departments, positionLabel } from '@/data/employeePositions'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import IconButton from '@/components/ui/IconButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField from '@/components/ui/SelectField.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import Switch from '@/components/ui/Switch.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import IconPin from '~icons/material-symbols/pin-rounded'
import IconPersonAdd from '~icons/material-symbols/person-add-rounded'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconBadge from '~icons/material-symbols/badge-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconLockReset from '~icons/material-symbols/lock-reset-rounded'
import IconPersonOff from '~icons/material-symbols/person-off-rounded'
import IconPersonCheck from '~icons/material-symbols/person-check-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'

const confirm  = useConfirm()
const snackbar = useSnackbar()

const employees = ref([])
const loading   = ref(false)
const loaded    = ref(false)
const error     = ref(null)
const actionError = ref(null) // a failed row action; shown above the table instead of replacing it
const saving    = ref(false)
const formError = ref(null)
const formEl    = ref(null)

const DEFAULT_FILTERS = { search: '', position: null, status: 'active' }
const filters  = ref({ ...DEFAULT_FILTERS })
const showForm = ref(false)
const formData = ref({})

const filtersChanged = computed(() =>
  filters.value.search.trim() !== '' || !!filters.value.position || filters.value.status !== 'active')

const columns = [
  { key: 'name', label: 'Name', primary: true },
  { key: 'position', label: 'Position', format: v => positionLabel(v) },
  { key: 'contact', label: 'Contact', class: 'min-w-[12rem]' },
  { key: 'hourlyRateCents', label: 'Rate', align: 'right', class: 'whitespace-nowrap tabular-nums', format: formatRate },
  { key: 'hireDate', label: 'Hired', class: 'whitespace-nowrap hidden xl:table-cell', hideOnMobile: true, format: v => (v ? formatLocalDate(v, { month: 'short', day: 'numeric', year: 'numeric' }) : '—') },
  { key: 'status', label: 'Status' },
]

const blankForm = () => ({
  id: null, firstName: '', lastName: '', email: '', phone: '',
  position: null, hourlyRateCents: null, hireDate: '', active: true,
})

const fullName = emp => `${emp.firstName} ${emp.lastName}`

function positionsIn(dept) {
  return employeePositions.filter(p => p.department === dept)
}

function formatRate(cents) {
  return cents === null || cents === undefined ? '—' : `${formatCents(cents)}/hr`
}

function rowActions(emp) {
  return [
    { label: 'Edit', icon: IconEdit, onClick: () => openEdit(emp) },
    ...(emp.hasManagerPin ? [{ label: 'Reset manager PIN', icon: IconLockReset, onClick: () => resetPin(emp) }] : []),
    // Time clock PIN: once the database has it (migration 13)
    ...(emp.hasClockPin !== undefined
      ? [
          { label: emp.hasClockPin ? 'Change time clock PIN' : 'Set time clock PIN', icon: IconPin, onClick: () => openClockPin(emp) },
          ...(emp.hasClockPin ? [{ label: 'Remove time clock PIN', icon: IconLockReset, onClick: () => clearClockPin(emp) }] : []),
        ]
      : []),
    emp.active
      ? { label: 'Deactivate', icon: IconPersonOff, onClick: () => setActive(emp, false) }
      : { label: 'Activate', icon: IconPersonCheck, onClick: () => setActive(emp, true) },
    { label: 'Delete', icon: IconDelete, danger: true, onClick: () => deleteEmployee(emp) },
  ]
}

// ─── Load ───────────────────────────────────────────────────────────────────

let loadSeq = 0
async function load() {
  const seq = ++loadSeq
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ status: filters.value.status })
    const search = filters.value.search.trim()
    if (search)                 params.set('search', search)
    if (filters.value.position) params.set('position', filters.value.position)
    const data = await apiFetch(`/api/admin/employees?${params}`)
    if (seq !== loadSeq) return
    employees.value = data
    loaded.value = true
  } catch (e) {
    if (seq === loadSeq) error.value = e.message
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

let searchTimer = null
watch(() => filters.value.search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})
watch(() => [filters.value.position, filters.value.status], load)
onBeforeUnmount(() => clearTimeout(searchTimer))

function resetFilters() {
  clearTimeout(searchTimer)
  filters.value = { ...DEFAULT_FILTERS }
}

// ─── Create / edit ──────────────────────────────────────────────────────────

function openCreate() {
  formData.value  = blankForm()
  formError.value = null
  showForm.value  = true
}

function openEdit(emp) {
  formData.value = {
    id: emp.id,
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    phone: emp.phone ?? '',
    position: emp.position,
    hourlyRateCents: emp.hourlyRateCents ?? null,
    hireDate: emp.hireDate ?? '',
    active: emp.active,
  }
  formError.value = null
  showForm.value  = true
}

function submitForm() {
  if (!formEl.value?.reportValidity()) return
  saveEmployee()
}

async function saveEmployee() {
  saving.value    = true
  formError.value = null
  try {
    const f = formData.value
    const body = {
      firstName: f.firstName,
      lastName: f.lastName,
      email: f.email,
      phone: f.phone || null,
      position: f.position,
      hourlyRateCents: f.hourlyRateCents ?? null,
      hireDate: f.hireDate || null,
      active: f.active,
    }
    await apiFetch(f.id ? `/api/admin/employees/${f.id}` : '/api/admin/employees', {
      method: f.id ? 'PUT' : 'POST',
      body,
    })
    showForm.value = false
    snackbar.show(f.id ? `${f.firstName} ${f.lastName} saved` : `${f.firstName} ${f.lastName} added`)
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ─── Row actions ────────────────────────────────────────────────────────────

async function setActive(emp, active, { undo = true } = {}) {
  actionError.value = null
  try {
    await apiFetch(`/api/admin/employees/${emp.id}`, { method: 'PUT', body: { active } })
    await load()
    if (!active && undo) {
      snackbar.show({
        message: `${fullName(emp)} deactivated`,
        actionLabel: 'Undo',
        onAction: () => setActive(emp, true, { undo: false }),
      })
    } else {
      snackbar.show(`${fullName(emp)} ${active ? 'activated' : 'deactivated'}`)
    }
  } catch (e) {
    actionError.value = e.message
  }
}

async function resetPin(emp) {
  actionError.value = null
  const ok = await confirm({
    title: 'Reset manager PIN?',
    message: `${fullName(emp)}'s current PIN stops working until they set a new one.`,
    confirmLabel: 'Reset PIN',
  })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/employees/${emp.id}`, { method: 'PUT', body: { resetManagerPin: true } })
    snackbar.show(`${fullName(emp)}'s manager PIN was reset`)
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

// "Manager PIN set · Time clock PIN set" under the status chips (locked PINs show as chips instead)
function pinNote(emp) {
  return [
    !emp.managerPinLocked && emp.hasManagerPin ? 'Manager PIN set' : '',
    emp.hasClockPin === false ? 'No time clock PIN' : !emp.clockPinLocked && emp.hasClockPin ? 'Time clock PIN set' : '',
  ].filter(Boolean).join(' · ')
}

// ─── Time clock PIN ─────────────────────────────────────────────────────────

const clockPinFor    = ref(null)
const clockPin       = ref('')
const clockPinError  = ref('')
const clockPinSaving = ref(false)

function openClockPin(emp) {
  clockPinFor.value = emp
  clockPin.value = ''
  clockPinError.value = ''
}

async function saveClockPin() {
  if (!/^\d{4,6}$/.test(clockPin.value)) {
    clockPinError.value = 'Use 4 to 6 digits'
    return
  }
  const emp = clockPinFor.value
  clockPinSaving.value = true
  clockPinError.value = ''
  try {
    await apiFetch(`/api/admin/employees/${emp.id}`, { method: 'PUT', body: { clockPin: clockPin.value } })
    clockPinFor.value = null
    snackbar.show(`${fullName(emp)}'s time clock PIN was saved`)
    await load()
  } catch (e) {
    clockPinError.value = e.message
  } finally {
    clockPinSaving.value = false
    clockPin.value = ''
  }
}

async function clearClockPin(emp) {
  actionError.value = null
  const ok = await confirm({
    title: 'Remove time clock PIN?',
    message: `${fullName(emp)} can't use the time clock iPad until they or a manager set a new PIN. Their punches are kept.`,
    confirmLabel: 'Remove PIN',
  })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/employees/${emp.id}`, { method: 'PUT', body: { clockPin: null } })
    snackbar.show(`${fullName(emp)}'s time clock PIN was removed`)
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

async function deleteEmployee(emp) {
  actionError.value = null
  const ok = await confirm({
    title: 'Delete employee?',
    message: `${fullName(emp)} and their schedule and time off requests will be permanently removed. Employees with time clock history can't be deleted; deactivate them instead.`,
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/employees/${emp.id}`, { method: 'DELETE' })
    snackbar.show(`${fullName(emp)} deleted`)
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

onMounted(load)
</script>
