<template>
  <div class="max-w-xl">
    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <form v-else @submit.prevent="save" class="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <label class="label-sm">Price Per Player (cents)</label>
        <div class="flex items-center gap-3">
          <input type="number" v-model.number="form.pricePerPlayerCents" min="100" step="100" class="input-field w-40" />
          <span class="text-gray-400 text-sm font-body">=  ${{ (form.pricePerPlayerCents / 100).toFixed(2) }}</span>
        </div>
        <p class="text-gray-400 text-xs mt-1 font-body">Stored and charged in cents. e.g. 4500 = $45.00</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label-sm">Public Booking Window (days)</label>
          <input type="number" v-model.number="form.publicBookingDays" min="1" max="90" class="input-field w-full" />
        </div>
        <div>
          <label class="label-sm">Member Booking Window (days)</label>
          <input type="number" v-model.number="form.memberBookingDays" min="1" max="90" class="input-field w-full" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label-sm">First Tee Time</label>
          <input type="time" v-model="form.firstTeeTime" class="input-field w-full" />
        </div>
        <div>
          <label class="label-sm">Last Tee Time</label>
          <input type="time" v-model="form.lastTeeTime" class="input-field w-full" />
        </div>
      </div>

      <div>
        <label class="label-sm">Tee Time Interval (minutes)</label>
        <select v-model.number="form.intervalMinutes" class="input-field w-40">
          <option :value="8">8</option>
          <option :value="9">9</option>
          <option :value="10">10</option>
          <option :value="12">12</option>
          <option :value="15">15</option>
        </select>
      </div>

      <div class="pt-2 flex items-center gap-4">
        <button type="submit" :disabled="saving" class="btn-amber px-5 py-2 text-sm">
          {{ saving ? 'Saving…' : 'Save Settings' }}
        </button>
        <span v-if="saved" class="text-green-600 text-sm font-body">✓ Saved</span>
        <span v-if="saveError" class="text-red-500 text-sm font-body">{{ saveError }}</span>
      </div>
    </form>

    <div class="mt-4 bg-amber/10 border border-amber/30 rounded-xl p-4 text-sm font-body text-bark">
      <strong class="font-semibold">Note:</strong> Changing price or booking window takes effect immediately for all new bookings.
      Existing pending/confirmed bookings are not affected.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const loading   = ref(true)
const error     = ref(null)
const saving    = ref(false)
const saved     = ref(false)
const saveError = ref(null)

const form = ref({
  pricePerPlayerCents: 4500,
  publicBookingDays: 7,
  memberBookingDays: 14,
  firstTeeTime: '07:30',
  lastTeeTime: '17:00',
  intervalMinutes: 10,
})

async function load() {
  loading.value = true
  error.value   = null
  try {
    const res = await fetch('/api/admin/settings', {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    const data = await res.json()
    form.value = {
      pricePerPlayerCents: data.pricePerPlayerCents,
      publicBookingDays:   data.publicBookingDays,
      memberBookingDays:   data.memberBookingDays,
      firstTeeTime:        data.firstTeeTime,
      lastTeeTime:         data.lastTeeTime,
      intervalMinutes:     data.intervalMinutes,
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value   = true
  saved.value    = false
  saveError.value = null
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
      body: JSON.stringify(form.value),
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.input-field { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm    { @apply block text-xs text-gray-500 mb-1 font-body; }
</style>
