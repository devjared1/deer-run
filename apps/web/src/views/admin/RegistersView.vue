<template>
  <div class="max-w-3xl">
    <div class="flex items-center justify-between mb-6">
      <p class="text-gray-500 text-sm font-body">
        Each register is a checkout station. A PC chooses which register it is the first time it opens
        the register screen.
      </p>
      <button class="btn-amber px-4 py-2 text-sm flex-shrink-0 ml-4" @click="openForm(null)">+ New Register</button>
    </div>

    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full text-sm font-body">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-100 text-left">
            <th class="th">Name</th>
            <th class="th">Card Reader</th>
            <th class="th">Status</th>
            <th class="th" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="r in registers" :key="r.id">
            <td class="td text-bark font-semibold">{{ r.name }}</td>
            <td class="td text-gray-600">
              <code v-if="r.stripeReaderId" class="text-xs">{{ r.stripeReaderId }}</code>
              <span v-else class="text-gray-400 text-xs">Not assigned</span>
            </td>
            <td class="td">
              <span :class="r.active ? 'bg-lake/20 text-lake' : 'bg-gray-100 text-gray-500'" class="text-xs px-2 py-0.5 rounded-full">
                {{ r.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="td text-right whitespace-nowrap space-x-3 text-xs">
              <button class="text-lake hover:text-pine" @click="openForm(r)">Edit</button>
              <button class="text-red-400 hover:text-red-600" @click="remove(r)">Delete</button>
            </td>
          </tr>
          <tr v-if="!registers.length">
            <td colspan="4" class="px-5 py-8 text-center text-gray-400">No registers yet.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="form" class="modal-overlay" @click.self="form = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-4">{{ form.id ? 'Edit Register' : 'New Register' }}</h2>
        <div class="space-y-3">
          <div>
            <label class="label-sm">Name *</label>
            <input v-model="form.name" type="text" class="input-field w-full" placeholder="Pro Shop" />
          </div>
          <div>
            <label class="label-sm">Stripe Card Reader ID</label>
            <input v-model="form.stripeReaderId" type="text" class="input-field w-full" placeholder="tmr_…" />
            <p class="text-gray-400 text-xs mt-1 font-body">From the Stripe dashboard once the reader is set up. Card payments come in a later phase.</p>
          </div>
          <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
            <input v-model="form.active" type="checkbox" class="rounded" /> Active
          </label>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="form = null">Cancel</button>
          <button :disabled="saving" class="btn-amber px-4 py-2 text-sm disabled:opacity-50" @click="save">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'

const registers = ref([])
const loading   = ref(false)
const error     = ref(null)
const form      = ref(null)
const saving    = ref(false)
const formError = ref(null)

async function load() {
  loading.value = true
  error.value   = null
  try {
    registers.value = await apiFetch('/api/admin/registers')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openForm(r) {
  form.value = { id: r?.id ?? null, name: r?.name ?? '', stripeReaderId: r?.stripeReaderId ?? '', active: r?.active ?? true }
  formError.value = null
}

async function save() {
  saving.value    = true
  formError.value = null
  try {
    const { id, ...body } = form.value
    await apiFetch(id ? `/api/admin/registers/${id}` : '/api/admin/registers', { method: id ? 'PUT' : 'POST', body })
    form.value = null
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function remove(r) {
  error.value = null
  try {
    await apiFetch(`/api/admin/registers/${r.id}`, { method: 'DELETE' })
    await load()
  } catch (e) {
    error.value = e.message
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
