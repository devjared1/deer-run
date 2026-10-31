<template>
  <div class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal-box max-w-sm">
      <h2 class="font-display font-bold text-bark mb-1">Manager Approval</h2>
      <p class="text-gray-500 text-sm font-body mb-4">{{ title }}</p>

      <div v-if="loading" class="text-gray-400 text-sm">Loading managers…</div>
      <template v-else>
        <p v-if="!managers.length" class="text-clay text-sm font-body mb-3">
          No manager has set a PIN yet. A manager can set one under Staff → Manager PIN.
        </p>
        <div class="space-y-3">
          <div>
            <label class="label-sm">Manager</label>
            <select v-model="managerId" class="input-field w-full">
              <option value="" disabled>Select a manager</option>
              <option v-for="m in managers" :key="m.id" :value="m.id">{{ m.firstName }} {{ m.lastName }}</option>
            </select>
          </div>
          <div>
            <label class="label-sm">PIN</label>
            <input
              ref="pinInput"
              v-model="pin"
              type="password"
              inputmode="numeric"
              autocomplete="off"
              maxlength="6"
              class="input-field w-full tracking-[0.4em] text-lg"
              @keyup.enter="approve"
            />
          </div>
        </div>
      </template>

      <div class="flex justify-end gap-3 mt-5">
        <button class="btn-outline-sm" @click="$emit('cancel')">Cancel</button>
        <button :disabled="busy || !managerId || pin.length < 4" class="btn-amber px-4 py-2 text-sm disabled:opacity-50" @click="approve">
          {{ busy ? 'Checking…' : 'Approve' }}
        </button>
      </div>
      <p v-if="error" class="text-red-500 text-sm mt-3 font-body">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { apiFetch } from '@/lib/api'

const props = defineProps({
  action: { type: String, required: true },
  title: { type: String, required: true },
  registerId: { type: String, default: null },
  reason: { type: String, default: null },
})
const emit = defineEmits(['approved', 'cancel'])

const managers  = ref([])
const managerId = ref('')
const pin       = ref('')
const loading   = ref(true)
const busy      = ref(false)
const error     = ref(null)
const pinInput  = ref(null)

async function approve() {
  if (!managerId.value || pin.value.length < 4) return
  busy.value  = true
  error.value = null
  try {
    const approval = await apiFetch('/api/staff/approvals', {
      method: 'POST',
      body: { action: props.action, managerId: managerId.value, pin: pin.value, registerId: props.registerId, reason: props.reason },
    })
    emit('approved', approval)
  } catch (e) {
    error.value = e.message
    pin.value = ''
    nextTick(() => pinInput.value?.focus())
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    managers.value = await apiFetch('/api/staff/register/managers')
    if (managers.value.length === 1) managerId.value = managers.value[0].id
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
    nextTick(() => pinInput.value?.focus())
  }
})
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
