<template>
  <div class="max-w-md">
    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="loadError" class="text-red-500 text-sm">{{ loadError }}</div>

    <div v-else class="bg-white rounded-xl border border-gray-200 p-6">
      <p class="text-gray-500 text-sm font-body mb-4">
        Your manager PIN approves discounts, No Sale, voids and refunds when someone else is signed in at the
        register. Keep it private. If you forget it, an admin can reset it on the Employees page.
      </p>
      <p v-if="lockedUntil" class="text-clay text-sm font-body mb-4">
        Your PIN is locked after too many wrong tries until {{ formatClockTime(lockedUntil) }}.
      </p>

      <div class="space-y-3">
        <div v-if="hasPin">
          <label class="label-sm">Current PIN</label>
          <input v-model="currentPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="input-field w-full" />
        </div>
        <div>
          <label class="label-sm">{{ hasPin ? 'New PIN' : 'PIN' }} (4–6 digits)</label>
          <input v-model="newPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="input-field w-full" />
        </div>
        <div>
          <label class="label-sm">Confirm</label>
          <input v-model="confirmPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="input-field w-full" @keyup.enter="save" />
        </div>
      </div>

      <div class="flex items-center gap-4 mt-5">
        <button :disabled="saving || !valid" class="btn-amber px-5 py-2 text-sm disabled:opacity-50" @click="save">
          {{ saving ? 'Saving…' : hasPin ? 'Change PIN' : 'Set PIN' }}
        </button>
        <span v-if="saved" class="text-green-600 text-sm font-body">✓ Saved</span>
      </div>
      <p v-if="mismatch" class="text-clay text-xs mt-2 font-body">The PINs don't match.</p>
      <p v-if="error" class="text-red-500 text-sm mt-2 font-body">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatClockTime } from '@/lib/timeclock'

const loading     = ref(true)
const loadError   = ref(null)
const hasPin      = ref(false)
const lockedUntil = ref(null)
const currentPin  = ref('')
const newPin      = ref('')
const confirmPin  = ref('')
const saving      = ref(false)
const saved       = ref(false)
const error       = ref(null)

const mismatch = computed(() => confirmPin.value.length >= 4 && newPin.value !== confirmPin.value)
const valid = computed(() => /^\d{4,6}$/.test(newPin.value) && newPin.value === confirmPin.value &&
  (!hasPin.value || /^\d{4,6}$/.test(currentPin.value)))

async function save() {
  if (!valid.value) return
  saving.value = true
  saved.value  = false
  error.value  = null
  try {
    await apiFetch('/api/staff/pin', { method: 'PUT', body: { currentPin: currentPin.value, newPin: newPin.value } })
    hasPin.value = true
    lockedUntil.value = null
    currentPin.value = newPin.value = confirmPin.value = ''
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const data = await apiFetch('/api/staff/pin')
    hasPin.value = data.hasPin
    lockedUntil.value = data.lockedUntil
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.input-field { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm    { @apply block text-xs text-gray-500 mb-1 font-body; }
</style>
