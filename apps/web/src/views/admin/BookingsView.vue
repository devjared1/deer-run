<template>
  <div>
    <!-- Filters -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
      <div>
        <label class="block text-xs text-gray-500 mb-1 font-body">Status</label>
        <select v-model="filters.status" class="input-field">
          <option value="">All statuses</option>
          <option>PENDING</option>
          <option>CONFIRMED</option>
          <option>CANCELLED</option>
          <option>REFUNDED</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1 font-body">Date</label>
        <input type="date" v-model="filters.date" class="input-field" />
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
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Guest / Member</th>
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Tee Time</th>
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Players</th>
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Total</th>
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Status</th>
                <th class="px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Created</th>
                <th class="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="b in bookings" :key="b.id" class="hover:bg-gray-50/50 transition-colors">
                <td class="px-5 py-3">
                  <div class="text-bark font-semibold">{{ b.User?.name || b.guestName || '—' }}</div>
                  <div class="text-gray-400 text-xs">{{ b.User?.email || b.guestEmail || 'Guest' }}</div>
                </td>
                <td class="px-5 py-3 text-gray-600">
                  {{ b.TeeTimeSlot?.date }}<br><span class="text-gray-400">{{ b.TeeTimeSlot?.startTime }}</span>
                </td>
                <td class="px-5 py-3 text-gray-600">{{ b.players }}</td>
                <td class="px-5 py-3 text-gray-600">${{ (b.totalCents / 100).toFixed(2) }}</td>
                <td class="px-5 py-3">
                  <span :class="statusClass(b.status)" class="text-xs px-2 py-0.5 rounded-full">{{ b.status }}</span>
                </td>
                <td class="px-5 py-3 text-gray-400 text-xs">{{ formatDate(b.createdAt) }}</td>
                <td class="px-5 py-3">
                  <button @click="openStatusModal(b)" class="text-xs text-lake hover:text-pine">Change status</button>
                </td>
              </tr>
              <tr v-if="!bookings.length">
                <td colspan="7" class="px-5 py-8 text-center text-gray-400">No bookings found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="total > 0" class="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-body">
          <span>{{ total }} total · page {{ page }} of {{ totalPages }}</span>
          <div class="flex gap-2">
            <button @click="load(page - 1)" :disabled="page <= 1" class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 transition-colors">Prev</button>
            <button @click="load(page + 1)" :disabled="page >= totalPages" class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 transition-colors">Next</button>
          </div>
        </div>
      </div>
    </template>

    <!-- Status modal -->
    <div v-if="editing" class="modal-overlay" @click.self="editing = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">Update Booking Status</h2>
        <p class="text-gray-400 text-xs mb-4 font-body">{{ editing.User?.name || editing.guestName }} · {{ editing.TeeTimeSlot?.date }}</p>
        <div class="space-y-2">
          <label
            v-for="s in ['PENDING','CONFIRMED','CANCELLED','REFUNDED']"
            :key="s"
            class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <input type="radio" :value="s" v-model="newStatus" class="text-pine" />
            <span :class="statusClass(s)" class="text-xs px-2 py-0.5 rounded-full">{{ s }}</span>
          </label>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button @click="editing = null" class="btn-outline-sm">Cancel</button>
          <button @click="updateStatus" :disabled="saving || newStatus === editing.status" class="btn-amber px-4 py-2 text-sm disabled:opacity-50">
            {{ saving ? 'Saving…' : 'Update' }}
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
const bookings  = ref([])
const loading   = ref(false)
const error     = ref(null)
const total     = ref(0)
const page      = ref(1)
const limit     = 25

const filters = ref({ status: '', date: '' })
const editing   = ref(null)
const newStatus = ref('')
const saving    = ref(false)
const formError = ref(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

async function load(p = 1) {
  page.value  = p
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ page: p, limit })
    if (filters.value.status) params.set('status', filters.value.status)
    if (filters.value.date)   params.set('date', filters.value.date)
    const res = await fetch(`/api/admin/bookings?${params}`, {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    const data = await res.json()
    bookings.value = data.bookings
    total.value    = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.value = { status: '', date: '' }
  load(1)
}

function openStatusModal(booking) {
  editing.value = booking
  newStatus.value = booking.status
  formError.value = null
}

async function updateStatus() {
  saving.value = true
  formError.value = null
  try {
    const res = await fetch(`/api/admin/bookings/${editing.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
      body: JSON.stringify({ status: newStatus.value }),
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

function statusClass(status) {
  return {
    PENDING:   'bg-yellow-100 text-yellow-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
    REFUNDED:  'bg-red-100 text-red-600',
  }[status] || 'bg-gray-100 text-gray-500'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(() => load(1))
</script>

<style scoped>
.modal-overlay { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box     { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field   { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.btn-pine      { @apply bg-pine text-parch rounded-lg font-body font-semibold hover:bg-pine/90 transition-colors; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
