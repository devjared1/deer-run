<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div class="flex gap-2">
        <button
          v-for="tab in ['upcoming', 'past', 'all']"
          :key="tab"
          @click="activeTab = tab; load()"
          :class="['px-4 py-2 rounded-lg text-sm font-body transition-colors capitalize',
            activeTab === tab ? 'bg-pine text-parch' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50']"
        >{{ tab }}</button>
      </div>
      <button @click="openCreate" class="btn-amber px-4 py-2 text-sm">+ New Event</button>
    </div>

    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <div v-else class="space-y-3">
      <div v-for="ev in events" :key="ev.id"
        class="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-display font-bold text-bark">{{ ev.name }}</h3>
            <span v-if="ev.featured" class="text-xs bg-amber/20 text-amber px-2 py-0.5 rounded-full font-body">Featured</span>
            <span v-if="ev.memberOnly" class="text-xs bg-lake/20 text-lake px-2 py-0.5 rounded-full font-body">Members only</span>
            <span v-if="ev.past" class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-body">Past</span>
          </div>
          <p class="text-gray-500 text-sm font-body mt-1">{{ formatDate(ev.eventDate) }} at {{ ev.startTime }} · {{ ev.format }}</p>
          <p class="text-gray-400 text-sm font-body mt-1 line-clamp-2">{{ ev.description }}</p>
          <div class="flex gap-4 mt-2 text-xs text-gray-400 font-body">
            <span v-if="ev.entry">Entry: ${{ (ev.entry / 100).toFixed(0) }}</span>
            <span v-if="ev.spotsTotal">Spots: {{ ev.spotsTotal }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button @click="openEdit(ev)" class="text-xs text-lake hover:text-pine font-body">Edit</button>
          <button @click="confirmDelete(ev)" class="text-xs text-red-400 hover:text-red-600 font-body">Delete</button>
        </div>
      </div>
      <div v-if="!events.length" class="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center text-gray-400 text-sm">
        No events found.
      </div>
    </div>

    <!-- Create / Edit modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal-box max-w-lg overflow-y-auto max-h-[90vh]">
        <h2 class="font-display font-bold text-bark mb-4">{{ formData.id ? 'Edit Event' : 'New Tournament Event' }}</h2>
        <div class="space-y-3">
          <div>
            <label class="label-sm">Name *</label>
            <input type="text" v-model="formData.name" class="input-field w-full" placeholder="Spring Scramble" />
          </div>
          <div>
            <label class="label-sm">Description *</label>
            <textarea v-model="formData.description" class="input-field w-full" rows="3" placeholder="Event details…"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label-sm">Date *</label>
              <input type="date" v-model="formData.eventDate" class="input-field w-full" />
            </div>
            <div>
              <label class="label-sm">Start Time *</label>
              <input type="time" v-model="formData.startTime" class="input-field w-full" />
            </div>
          </div>
          <div>
            <label class="label-sm">Format *</label>
            <input type="text" v-model="formData.format" class="input-field w-full" placeholder="18-Hole Scramble" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label-sm">Entry Fee ($ whole dollars)</label>
              <input type="number" v-model.number="formData.entryDollars" min="0" class="input-field w-full" placeholder="0" />
            </div>
            <div>
              <label class="label-sm">Total Spots</label>
              <input type="number" v-model.number="formData.spotsTotal" min="0" class="input-field w-full" placeholder="—" />
            </div>
          </div>
          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
              <input type="checkbox" v-model="formData.featured" class="rounded" /> Featured
            </label>
            <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
              <input type="checkbox" v-model="formData.memberOnly" class="rounded" /> Members only
            </label>
            <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer">
              <input type="checkbox" v-model="formData.past" class="rounded" /> Mark as past
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button @click="showForm = false" class="btn-outline-sm">Cancel</button>
          <button @click="saveEvent" :disabled="saving" class="btn-amber px-4 py-2 text-sm">
            {{ saving ? 'Saving…' : (formData.id ? 'Save Changes' : 'Create Event') }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">Delete Event?</h2>
        <p class="text-gray-500 text-sm font-body mb-5">{{ deleting.name }} — this cannot be undone.</p>
        <div class="flex justify-end gap-3">
          <button @click="deleting = null" class="btn-outline-sm">Cancel</button>
          <button @click="deleteEvent" :disabled="saving" class="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg font-body transition-colors">
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

const authStore = useAuthStore()
const events    = ref([])
const loading   = ref(false)
const error     = ref(null)
const saving    = ref(false)
const formError = ref(null)
const activeTab = ref('upcoming')

const showForm  = ref(false)
const deleting  = ref(null)
const formData  = ref({})

const blankForm = () => ({
  id: null, name: '', description: '', eventDate: '', startTime: '08:00',
  format: '', entryDollars: '', spotsTotal: '', featured: false, memberOnly: false, past: false,
})

async function load() {
  loading.value = true
  error.value   = null
  try {
    const past = activeTab.value === 'past' ? '?past=true' : activeTab.value === 'upcoming' ? '?past=false' : ''
    const res = await fetch(`/api/admin/events${past}`, {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    events.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openCreate() {
  formData.value = blankForm()
  formError.value = null
  showForm.value = true
}

function openEdit(ev) {
  formData.value = {
    id: ev.id,
    name: ev.name,
    description: ev.description,
    eventDate: ev.eventDate.split('T')[0],
    startTime: ev.startTime,
    format: ev.format,
    entryDollars: ev.entry !== null ? ev.entry / 100 : '',
    spotsTotal: ev.spotsTotal ?? '',
    featured: ev.featured,
    memberOnly: ev.memberOnly,
    past: ev.past,
  }
  formError.value = null
  showForm.value = true
}

async function saveEvent() {
  saving.value = true
  formError.value = null
  try {
    const body = {
      name: formData.value.name,
      description: formData.value.description,
      eventDate: formData.value.eventDate,
      startTime: formData.value.startTime,
      format: formData.value.format,
      entry: formData.value.entryDollars !== '' ? Math.round(Number(formData.value.entryDollars) * 100) : null,
      spotsTotal: formData.value.spotsTotal !== '' ? Number(formData.value.spotsTotal) : null,
      featured: formData.value.featured,
      memberOnly: formData.value.memberOnly,
      past: formData.value.past,
    }
    const url    = formData.value.id ? `/api/admin/events/${formData.value.id}` : '/api/admin/events'
    const method = formData.value.id ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function confirmDelete(ev) {
  deleting.value = ev
  formError.value = null
}

async function deleteEvent() {
  saving.value = true
  formError.value = null
  try {
    const res = await fetch(`/api/admin/events/${deleting.value.id}`, {
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

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.modal-overlay { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box     { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field   { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm      { @apply block text-xs text-gray-500 mb-1 font-body; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
