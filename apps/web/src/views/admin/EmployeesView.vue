<template>
  <div>
    <!-- Filters -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
      <div>
        <label class="label-sm">Search</label>
        <input type="text" v-model="filters.search" @keyup.enter="load" class="input-field" placeholder="Name or email" />
      </div>
      <div>
        <label class="label-sm">Position</label>
        <select v-model="filters.position" @change="load" class="input-field">
          <option value="">All positions</option>
          <optgroup v-for="dept in departments" :key="dept" :label="dept">
            <option v-for="p in positionsIn(dept)" :key="p.value" :value="p.value">{{ p.label }}</option>
          </optgroup>
        </select>
      </div>
      <div>
        <label class="label-sm">Status</label>
        <select v-model="filters.status" @change="load" class="input-field">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>
      <button @click="load" class="btn-pine px-4 py-2 text-sm">Search</button>
      <button @click="resetFilters" class="btn-outline-sm">Reset</button>
      <button @click="openCreate" class="btn-amber px-4 py-2 text-sm ml-auto">+ New Employee</button>
    </div>

    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <template v-else>
      <p v-if="actionError" class="text-red-500 text-sm mb-3">{{ actionError }}</p>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm font-body">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100 text-left">
                <th class="th">Name</th>
                <th class="th">Position</th>
                <th class="th">Contact</th>
                <th class="th">Rate</th>
                <th class="th">Hired</th>
                <th class="th">Login</th>
                <th class="th">Status</th>
                <th class="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="emp in employees" :key="emp.id" class="hover:bg-gray-50/50 transition-colors">
                <td class="px-5 py-3 text-bark font-semibold whitespace-nowrap">{{ emp.firstName }} {{ emp.lastName }}</td>
                <td class="px-5 py-3 text-gray-600">{{ positionLabel(emp.position) }}</td>
                <td class="px-5 py-3 text-gray-600">
                  <div>{{ emp.email }}</div>
                  <div v-if="emp.phone" class="text-gray-400 text-xs">{{ emp.phone }}</div>
                </td>
                <td class="px-5 py-3 text-gray-600 whitespace-nowrap">{{ formatRate(emp.hourlyRateCents) }}</td>
                <td class="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{{ formatDate(emp.hireDate) }}</td>
                <td class="px-5 py-3">
                  <span
                    v-if="emp.userId"
                    class="text-xs px-2 py-0.5 rounded-full bg-pine/20 text-pine"
                  >Linked</span>
                  <span
                    v-else
                    class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                    title="No site account uses this email yet. It links automatically the first time they sign in with it."
                  >No account</span>
                </td>
                <td class="px-5 py-3">
                  <span
                    :class="emp.active ? 'bg-lake/20 text-lake' : 'bg-gray-100 text-gray-500'"
                    class="text-xs px-2 py-0.5 rounded-full"
                  >{{ emp.active ? 'Active' : 'Inactive' }}</span>
                  <div v-if="emp.managerPinLocked" class="text-xs text-red-600 mt-1">PIN locked</div>
                  <div v-else-if="emp.hasManagerPin" class="text-xs text-gray-400 mt-1">Manager PIN set</div>
                </td>
                <td class="px-5 py-3 whitespace-nowrap text-right space-x-3">
                  <button @click="openEdit(emp)" class="text-xs text-lake hover:text-pine">Edit</button>
                  <button @click="toggleActive(emp)" class="text-xs text-amber hover:text-clay">
                    {{ emp.active ? 'Deactivate' : 'Reactivate' }}
                  </button>
                  <button
                    v-if="emp.hasManagerPin"
                    class="text-xs text-lake hover:text-pine"
                    title="Clear the manager PIN so they can set a new one"
                    @click="resetPin(emp)"
                  >
                    Reset PIN
                  </button>
                  <button @click="confirmDelete(emp)" class="text-xs text-red-400 hover:text-red-600">Delete</button>
                </td>
              </tr>
              <tr v-if="!employees.length">
                <td colspan="8" class="px-5 py-8 text-center text-gray-400">No employees found.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="employees.length" class="px-5 py-3 border-t border-gray-100 text-xs text-gray-500 font-body">
          {{ employees.length }} employee{{ employees.length === 1 ? '' : 's' }}
        </div>
      </div>
    </template>

    <!-- Create / Edit modal -->
    <div v-if="showForm" class="modal-overlay">
      <div class="modal-box max-w-lg overflow-y-auto max-h-[90vh]">
        <h2 class="font-display font-bold text-bark mb-4">{{ formData.id ? 'Edit Employee' : 'New Employee' }}</h2>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label-sm">First Name *</label>
              <input type="text" v-model="formData.firstName" class="input-field w-full" />
            </div>
            <div>
              <label class="label-sm">Last Name *</label>
              <input type="text" v-model="formData.lastName" class="input-field w-full" />
            </div>
          </div>
          <div>
            <label class="label-sm">Email *</label>
            <input type="email" v-model="formData.email" class="input-field w-full" placeholder="name@example.com" />
            <p class="text-gray-400 text-xs mt-1 font-body">
              The employee signs in to the staff portal with a site account that uses this email.
            </p>
          </div>
          <div>
            <label class="label-sm">Phone</label>
            <input type="tel" v-model="formData.phone" class="input-field w-full" placeholder="(256) 555-0100" />
          </div>
          <div>
            <label class="label-sm">Position *</label>
            <select v-model="formData.position" class="input-field w-full">
              <option value="" disabled>Select a position</option>
              <optgroup v-for="dept in departments" :key="dept" :label="dept">
                <option v-for="p in positionsIn(dept)" :key="p.value" :value="p.value">{{ p.label }}</option>
              </optgroup>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label-sm">Hourly Rate ($)</label>
              <input type="number" v-model="formData.hourlyRate" min="0" step="0.01" class="input-field w-full" placeholder="—" />
            </div>
            <div>
              <label class="label-sm">Hire Date</label>
              <input type="date" v-model="formData.hireDate" class="input-field w-full" />
            </div>
          </div>
          <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
            <input type="checkbox" v-model="formData.active" class="rounded" /> Active
          </label>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button @click="showForm = false" class="btn-outline-sm">Cancel</button>
          <button @click="saveEmployee" :disabled="saving" class="btn-amber px-4 py-2 text-sm disabled:opacity-50">
            {{ saving ? 'Saving…' : (formData.id ? 'Save Changes' : 'Create Employee') }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">Delete Employee?</h2>
        <p class="text-gray-500 text-sm font-body mb-5">
          {{ deleting.firstName }} {{ deleting.lastName }} and their schedule and time off requests will be
          permanently removed. Employees with time clock history can't be deleted; deactivate them instead.
        </p>
        <div class="flex justify-end gap-3">
          <button @click="deleting = null" class="btn-outline-sm">Cancel</button>
          <button @click="deleteEmployee" :disabled="saving" class="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg font-body transition-colors">
            {{ saving ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { employeePositions, departments, positionLabel } from '@/data/employeePositions'

const authStore = useAuthStore()
const employees = ref([])
const loading   = ref(false)
const error     = ref(null)
const actionError = ref(null) // a failed row action (deactivate, reset PIN); shown above the table instead of replacing it
const saving   = ref(false)
const formError = ref(null)

const filters  = ref({ search: '', position: '', status: 'active' })
const showForm = ref(false)
const deleting = ref(null)
const formData = ref({})

const blankForm = () => ({
  id: null, firstName: '', lastName: '', email: '', phone: '',
  position: '', hourlyRate: '', hireDate: '', active: true,
})

function positionsIn(dept) {
  return employeePositions.filter(p => p.department === dept)
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
  })
  if (!res.ok) throw new Error((await res.json()).error || res.statusText)
  return res.json()
}

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ status: filters.value.status })
    if (filters.value.search)   params.set('search', filters.value.search)
    if (filters.value.position) params.set('position', filters.value.position)
    employees.value = await api(`/api/admin/employees?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.value = { search: '', position: '', status: 'active' }
  load()
}

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
    hourlyRate: emp.hourlyRateCents !== null ? (emp.hourlyRateCents / 100).toFixed(2) : '',
    hireDate: emp.hireDate ?? '',
    active: emp.active,
  }
  formError.value = null
  showForm.value  = true
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
      hourlyRateCents: f.hourlyRate !== '' && f.hourlyRate !== null ? Math.round(Number(f.hourlyRate) * 100) : null,
      hireDate: f.hireDate || null,
      active: f.active,
    }
    await api(f.id ? `/api/admin/employees/${f.id}` : '/api/admin/employees', {
      method: f.id ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    })
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function toggleActive(emp) {
  actionError.value = null
  if (emp.active && !window.confirm(
    `Deactivate ${emp.firstName} ${emp.lastName}? They won't be able to use the staff portal until they're reactivated.`,
  )) return
  try {
    await api(`/api/admin/employees/${emp.id}`, {
      method: 'PUT',
      body: JSON.stringify({ active: !emp.active }),
    })
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

async function resetPin(emp) {
  actionError.value = null
  if (!window.confirm(
    `Reset ${emp.firstName} ${emp.lastName}'s manager PIN? Their current PIN stops working until they set a new one.`,
  )) return
  try {
    await api(`/api/admin/employees/${emp.id}`, { method: 'PUT', body: JSON.stringify({ resetManagerPin: true }) })
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

function confirmDelete(emp) {
  deleting.value  = emp
  formError.value = null
}

async function deleteEmployee() {
  saving.value    = true
  formError.value = null
  try {
    await api(`/api/admin/employees/${deleting.value.id}`, { method: 'DELETE' })
    deleting.value = null
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function formatRate(cents) {
  return cents === null ? '—' : `$${(cents / 100).toFixed(2)}/hr`
}

function formatDate(date) {
  if (!date) return '—'
  // DATE columns come back as YYYY-MM-DD; format in UTC so the day doesn't shift
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

onMounted(load)
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.th             { @apply px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold; }
.btn-pine       { @apply bg-pine text-parch rounded-lg font-body font-semibold hover:bg-pine/90 transition-colors; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
