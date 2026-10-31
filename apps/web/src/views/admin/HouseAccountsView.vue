<template>
  <div class="max-w-5xl">
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-3">
      <div>
        <label class="label-sm">Search</label>
        <input v-model="search" type="text" class="input-field" placeholder="Member name or email" @keyup.enter="load">
      </div>
      <div>
        <label class="label-sm">Status</label>
        <select v-model="status" class="input-field" @change="load">
          <option value="">
            All
          </option>
          <option value="ACTIVE">
            Active
          </option>
          <option value="SUSPENDED">
            Suspended
          </option>
          <option value="CLOSED">
            Closed
          </option>
        </select>
      </div>
      <button class="btn-outline-sm" @click="load">
        Search
      </button>
      <div v-if="data" class="text-sm text-gray-500 font-body">
        {{ data.totals.count }} account{{ data.totals.count === 1 ? '' : 's' }} ·
        <span class="text-bark font-semibold">{{ formatCents(data.totals.owedCents) }}</span> owed
      </div>
      <button class="btn-amber px-4 py-2 text-sm ml-auto" @click="openNew">
        + Open Account
      </button>
    </div>

    <div v-if="loading && !data" class="text-gray-400 text-sm">
      Loading…
    </div>
    <div v-else-if="error" class="text-red-500 text-sm">
      {{ error }}
    </div>
    <div v-else-if="data" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full text-sm font-body">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-100 text-left">
            <th class="th">
              Member
            </th>
            <th class="th text-right">
              Balance
            </th>
            <th class="th text-right">
              Limit
            </th>
            <th class="th">
              Autopay
            </th>
            <th class="th">
              PIN
            </th>
            <th class="th">
              Status
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr
            v-for="a in data.accounts"
            :key="a.id"
            class="hover:bg-amber/5 cursor-pointer"
            @click="$router.push(`/admin/house-accounts/${a.id}`)"
          >
            <td class="td">
              <div class="font-semibold text-bark">
                {{ a.user?.name || a.user?.email }}
              </div>
              <div v-if="a.user?.name" class="text-xs text-gray-400">
                {{ a.user.email }}
              </div>
            </td>
            <td class="td text-right tabular-nums" :class="a.balanceCents > 0 ? 'text-bark font-semibold' : 'text-gray-500'">
              {{ formatCents(a.balanceCents) }}
              <div v-if="a.balanceCents > a.creditLimitCents" class="text-xs text-red-500 font-normal">
                over limit
              </div>
            </td>
            <td class="td text-right tabular-nums text-gray-500">
              {{ formatCents(a.creditLimitCents) }}
            </td>
            <td class="td text-xs">
              <span v-if="a.autopayEnabled" class="text-pine">{{ cardLabel(a) }}</span>
              <span v-else class="text-gray-400">Invoice</span>
            </td>
            <td class="td text-xs">
              <span v-if="a.pinLocked" class="text-red-500">Locked</span>
              <span v-else-if="a.hasPin" class="text-gray-500">Set</span>
              <span v-else class="text-gray-400">Not set</span>
            </td>
            <td class="td">
              <span :class="['text-xs px-2 py-0.5 rounded-full', STATUS_CLASSES[a.status]]">{{ STATUS_LABELS[a.status] }}</span>
            </td>
          </tr>
          <tr v-if="!data.accounts.length">
            <td colspan="6" class="px-5 py-8 text-center text-gray-400">
              No house accounts yet.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-gray-400 text-xs font-body mt-3">
      Members charge to their account at the register with their PIN. Statements go out on the 1st for the previous
      month; members pay online or at the pro shop, or turn on autopay in My Account.
    </p>

    <!-- Open an account -->
    <div v-if="opening" class="modal-overlay" @click.self="opening = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-4">
          Open a house account
        </h2>
        <label class="label-sm">Member</label>
        <input v-model="opening.search" type="text" class="input-field w-full" placeholder="Search name or email" @input="searchUsers">
        <ul v-if="opening.results.length && !opening.user" class="border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100 max-h-48 overflow-y-auto">
          <li v-for="u in opening.results" :key="u.id">
            <button class="w-full text-left px-3 py-2 text-sm font-body hover:bg-gray-50" @click="opening.user = u; opening.search = u.name || u.email">
              {{ u.name || u.email }} <span class="text-gray-400 text-xs">{{ u.email }} · {{ u.role }}</span>
            </button>
          </li>
        </ul>
        <label class="label-sm mt-3">Credit limit ($)</label>
        <input v-model="opening.limit" type="number" min="0" step="50" class="input-field w-full">
        <p class="text-xs text-gray-400 font-body mt-1">
          The member sets their own PIN in My Account before charging.
        </p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="opening = null">
            Cancel
          </button>
          <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="opening.busy || !opening.user" @click="createAccount">
            {{ opening.busy ? 'Opening…' : 'Open Account' }}
          </button>
        </div>
        <p v-if="opening.error" class="text-red-500 text-xs mt-2">
          {{ opening.error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents, dollarsToCents } from '@/lib/money'
import { STATUS_LABELS, STATUS_CLASSES, cardLabel } from '@/components/accounts/accountDisplay'

const router  = useRouter()
const data    = ref(null)
const loading = ref(false)
const error   = ref(null)
const search  = ref('')
const status  = ref('')
const opening = ref(null)
let searchTimer = null

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams()
    if (search.value) params.set('search', search.value)
    if (status.value) params.set('status', status.value)
    data.value = await apiFetch(`/api/admin/house-accounts?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openNew() {
  opening.value = { search: '', results: [], user: null, limit: '500', busy: false, error: null }
}

function searchUsers() {
  opening.value.user = null
  clearTimeout(searchTimer)
  const term = opening.value.search.trim()
  if (term.length < 2) { opening.value.results = []; return }
  searchTimer = setTimeout(async () => {
    try {
      const res = await apiFetch(`/api/admin/users?${new URLSearchParams({ search: term, limit: 10 })}`)
      if (opening.value) opening.value.results = res.users
    } catch (e) {
      if (opening.value) opening.value.error = e.message
    }
  }, 250)
}

async function createAccount() {
  const o = opening.value
  o.busy  = true
  o.error = null
  try {
    const account = await apiFetch('/api/admin/house-accounts', {
      method: 'POST', body: { userId: o.user.id, creditLimitCents: dollarsToCents(o.limit) ?? 0 },
    })
    opening.value = null
    router.push(`/admin/house-accounts/${account.id}`)
  } catch (e) {
    o.error = e.message
  } finally {
    o.busy = false
  }
}

onMounted(load)
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.th             { @apply px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold; }
.td             { @apply px-5 py-3; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
