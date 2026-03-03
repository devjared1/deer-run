<template>
  <div>
    <!-- Filters -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
      <div>
        <label class="block text-xs text-gray-500 mb-1 font-body">Search</label>
        <input type="text" v-model="filters.search" @keyup.enter="load(1)" class="input-field" placeholder="Name or email" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1 font-body">Role</label>
        <select v-model="filters.role" class="input-field">
          <option value="">All roles</option>
          <option>GUEST</option>
          <option>MEMBER</option>
          <option>ADMIN</option>
        </select>
      </div>
      <button @click="load(1)" class="btn-pine px-4 py-2 text-sm">Search</button>
      <button @click="resetFilters" class="btn-outline-sm">Reset</button>
    </div>

    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <template v-else>
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm font-body">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100 text-left">
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Name</th>
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Email</th>
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Role</th>
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Joined</th>
                <th class="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="u in users" :key="u.id" class="hover:bg-gray-50/50 transition-colors">
                <td class="px-5 py-3 text-bark font-semibold">{{ u.name || '—' }}</td>
                <td class="px-5 py-3 text-gray-600">{{ u.email }}</td>
                <td class="px-5 py-3">
                  <span :class="roleClass(u.role)" class="text-xs px-2 py-0.5 rounded-full">{{ u.role }}</span>
                </td>
                <td class="px-5 py-3 text-gray-400 text-xs">{{ formatDate(u.createdAt) }}</td>
                <td class="px-5 py-3">
                  <button @click="openRoleModal(u)" class="text-xs text-lake hover:text-pine">Change role</button>
                </td>
              </tr>
              <tr v-if="!users.length">
                <td colspan="5" class="px-5 py-8 text-center text-gray-400">No users found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="total > 0" class="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-body">
          <span>{{ total }} total · page {{ page }} of {{ totalPages }}</span>
          <div class="flex gap-2">
            <button @click="load(page - 1)" :disabled="page <= 1" class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 transition-colors">Prev</button>
            <button @click="load(page + 1)" :disabled="page >= totalPages" class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 transition-colors">Next</button>
          </div>
        </div>
      </div>
    </template>

    <!-- Role modal -->
    <div v-if="editing" class="modal-overlay" @click.self="editing = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">Change Role</h2>
        <p class="text-gray-400 text-xs mb-4 font-body">{{ editing.email }}</p>
        <div class="space-y-2">
          <label
            v-for="r in ['GUEST', 'MEMBER', 'ADMIN']"
            :key="r"
            class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <input type="radio" :value="r" v-model="newRole" class="text-pine" />
            <span :class="roleClass(r)" class="text-xs px-2 py-0.5 rounded-full">{{ r }}</span>
            <span class="text-gray-500 text-xs font-body">{{ roleDesc[r] }}</span>
          </label>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button @click="editing = null" class="btn-outline-sm">Cancel</button>
          <button @click="updateRole" :disabled="saving || newRole === editing.role" class="btn-amber px-4 py-2 text-sm disabled:opacity-50">
            {{ saving ? 'Saving…' : 'Update Role' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const users     = ref([])
const loading   = ref(false)
const error     = ref(null)
const total     = ref(0)
const page      = ref(1)
const limit     = 25

const filters   = ref({ search: '', role: '' })
const editing   = ref(null)
const newRole   = ref('')
const saving    = ref(false)
const formError = ref(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

const roleDesc = {
  GUEST:  'Limited access, no member pricing',
  MEMBER: 'Extended booking window + member-only slots',
  ADMIN:  'Full admin panel access',
}

async function load(p = 1) {
  page.value    = p
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ page: p, limit })
    if (filters.value.role)   params.set('role', filters.value.role)
    if (filters.value.search) params.set('search', filters.value.search)
    const res = await fetch(`/api/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    const data = await res.json()
    users.value = data.users
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.value = { search: '', role: '' }
  load(1)
}

function openRoleModal(user) {
  editing.value = user
  newRole.value = user.role
  formError.value = null
}

async function updateRole() {
  saving.value = true
  formError.value = null
  try {
    const res = await fetch(`/api/admin/users/${editing.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
      body: JSON.stringify({ role: newRole.value }),
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    editing.value = null
    await load(page.value)
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function roleClass(role) {
  return {
    GUEST:  'bg-gray-100 text-gray-600',
    MEMBER: 'bg-lake/20 text-lake',
    ADMIN:  'bg-pine/20 text-pine font-semibold',
  }[role] || 'bg-gray-100 text-gray-500'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(() => load(1))
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.btn-pine       { @apply bg-pine text-parch rounded-lg font-body font-semibold hover:bg-pine/90 transition-colors; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
