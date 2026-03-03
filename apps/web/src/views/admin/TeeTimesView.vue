<template>
  <div>
    <!-- Controls -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
      <div>
        <label class="block text-xs text-gray-500 mb-1 font-body">From</label>
        <input type="date" v-model="start" class="input-field" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1 font-body">To</label>
        <input type="date" v-model="end" class="input-field" />
      </div>
      <button @click="load" class="btn-pine px-4 py-2 text-sm">Load Slots</button>
      <button @click="showCreate = true" class="btn-amber px-4 py-2 text-sm ml-auto">+ New Slot</button>
    </div>

    <!-- Slots grouped by date -->
    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <template v-else>
      <div v-if="!Object.keys(grouped).length" class="text-gray-400 text-sm">No slots in range.</div>

      <div v-for="(slots, date) in grouped" :key="date" class="mb-6">
        <h3 class="font-display font-bold text-bark text-sm mb-2">{{ formatDate(date) }}</h3>
        <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          <div v-for="slot in slots" :key="slot.id" class="flex items-center gap-4 px-5 py-3">
            <div class="w-14 font-body font-semibold text-bark text-sm">{{ slot.startTime }}</div>
            <div class="flex items-center gap-2 flex-1">
              <span class="text-xs font-body text-gray-500">{{ slot.bookedPlayers }}/{{ slot.maxPlayers }} players</span>
              <span v-if="slot.memberOnly" class="text-xs bg-lake/20 text-lake px-2 py-0.5 rounded-full font-body">Members only</span>
              <span v-if="slot.available === 0" class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-body">Full</span>
            </div>
            <div class="flex items-center gap-2">
              <button @click="startEdit(slot)" class="text-xs text-lake hover:text-pine font-body">Edit</button>
              <button @click="confirmDelete(slot)" class="text-xs text-red-400 hover:text-red-600 font-body">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-4">New Tee Time Slot</h2>
        <div class="space-y-3">
          <div>
            <label class="label-sm">Date</label>
            <input type="date" v-model="form.date" class="input-field w-full" />
          </div>
          <div>
            <label class="label-sm">Start Time (HH:MM)</label>
            <input type="time" v-model="form.startTime" class="input-field w-full" />
          </div>
          <div>
            <label class="label-sm">Max Players</label>
            <input type="number" v-model.number="form.maxPlayers" min="1" max="8" class="input-field w-full" />
          </div>
          <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
            <input type="checkbox" v-model="form.memberOnly" class="rounded" />
            Members only
          </label>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button @click="showCreate = false" class="btn-outline-sm">Cancel</button>
          <button @click="createSlot" :disabled="saving" class="btn-amber px-4 py-2 text-sm">
            {{ saving ? 'Saving…' : 'Create' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>

    <!-- Edit modal -->
    <div v-if="editing" class="modal-overlay" @click.self="editing = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-4">Edit Slot · {{ editing.date }} {{ editing.startTime }}</h2>
        <div class="space-y-3">
          <div>
            <label class="label-sm">Max Players</label>
            <input type="number" v-model.number="editForm.maxPlayers" min="1" max="8" class="input-field w-full" />
          </div>
          <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
            <input type="checkbox" v-model="editForm.memberOnly" class="rounded" />
            Members only
          </label>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button @click="editing = null" class="btn-outline-sm">Cancel</button>
          <button @click="saveEdit" :disabled="saving" class="btn-amber px-4 py-2 text-sm">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">Delete Slot?</h2>
        <p class="text-gray-500 text-sm font-body mb-5">
          {{ deleting.date }} at {{ deleting.startTime }} — this cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <button @click="deleting = null" class="btn-outline-sm">Cancel</button>
          <button @click="deleteSlot" :disabled="saving" class="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg font-body transition-colors">
            {{ saving ? 'Deleting…' : 'Delete' }}
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

const today   = new Date().toISOString().split('T')[0]
const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

const start   = ref(today)
const end     = ref(twoWeeks)
const slots   = ref([])
const loading = ref(false)
const error   = ref(null)
const saving  = ref(false)
const formError = ref(null)

const showCreate = ref(false)
const editing    = ref(null)
const deleting   = ref(null)

const form     = ref({ date: today, startTime: '08:00', maxPlayers: 4, memberOnly: false })
const editForm = ref({})

const grouped = computed(() => {
  const g = {}
  for (const s of slots.value) {
    if (!g[s.date]) g[s.date] = []
    g[s.date].push(s)
  }
  return g
})

async function load() {
  loading.value = true
  error.value   = null
  try {
    const res = await fetch(`/api/admin/teetimes?start=${start.value}&end=${end.value}`, {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    slots.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function createSlot() {
  saving.value = true
  formError.value = null
  try {
    const res = await fetch('/api/admin/teetimes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
      body: JSON.stringify(form.value),
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    showCreate.value = false
    form.value = { date: today, startTime: '08:00', maxPlayers: 4, memberOnly: false }
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function startEdit(slot) {
  editing.value = slot
  editForm.value = { maxPlayers: slot.maxPlayers, memberOnly: slot.memberOnly }
  formError.value = null
}

async function saveEdit() {
  saving.value = true
  formError.value = null
  try {
    const res = await fetch(`/api/admin/teetimes/${editing.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
      body: JSON.stringify(editForm.value),
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    editing.value = null
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function confirmDelete(slot) {
  deleting.value = slot
  formError.value = null
}

async function deleteSlot() {
  saving.value = true
  formError.value = null
  try {
    const res = await fetch(`/api/admin/teetimes/${deleting.value.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    deleting.value = null
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4;
}
.modal-box {
  @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md;
}
.input-field {
  @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40;
}
.label-sm {
  @apply block text-xs text-gray-500 mb-1 font-body;
}
.btn-pine {
  @apply bg-pine text-parch rounded-lg font-body font-semibold hover:bg-pine/90 transition-colors;
}
.btn-outline-sm {
  @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors;
}
</style>
