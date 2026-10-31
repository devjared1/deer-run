<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-box max-w-md">
      <h2 class="font-display font-bold text-bark mb-3">Attach Customer</h2>
      <input
        ref="searchInput"
        v-model="search"
        type="text"
        class="input-field w-full"
        placeholder="Name or email"
        @input="queueSearch"
      />
      <div class="mt-3 max-h-80 overflow-y-auto divide-y divide-gray-50">
        <button
          v-for="u in results"
          :key="u.id"
          class="w-full text-left px-2 py-2.5 hover:bg-gray-50 rounded-lg flex items-center justify-between gap-3"
          @click="$emit('pick', u)"
        >
          <span class="min-w-0">
            <span class="block font-body text-sm text-bark truncate">{{ u.name || u.email }}</span>
            <span v-if="u.name" class="block font-body text-xs text-gray-400 truncate">{{ u.email }}</span>
          </span>
          <span v-if="u.isMember ?? u.role === 'MEMBER'" class="text-xs px-2 py-0.5 rounded-full bg-lake/20 text-lake font-body flex-shrink-0">Member</span>
          <span v-else-if="u.role === 'MEMBER'" class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-body flex-shrink-0">Membership expired</span>
        </button>
        <p v-if="searching" class="text-gray-400 text-sm py-2">Searching…</p>
        <p v-else-if="search.trim().length >= 2 && !results.length" class="text-gray-400 text-sm py-2">No customers found.</p>
        <p v-if="error" class="text-red-500 text-sm py-2">{{ error }}</p>
      </div>
      <div class="flex justify-end mt-4">
        <button class="btn-outline-sm" @click="$emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'

defineEmits(['pick', 'close'])

const search      = ref('')
const results     = ref([])
const searching   = ref(false)
const error       = ref(null)
const searchInput = ref(null)
let timer = null

function queueSearch() {
  clearTimeout(timer)
  timer = setTimeout(runSearch, 300)
}

async function runSearch() {
  const term = search.value.trim()
  if (term.length < 2) {
    results.value = []
    return
  }
  searching.value = true
  error.value     = null
  try {
    results.value = await apiFetch(`/api/staff/register/customers?${new URLSearchParams({ search: term })}`)
  } catch (e) {
    error.value = e.message
  } finally {
    searching.value = false
  }
}

onMounted(() => searchInput.value?.focus())
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
