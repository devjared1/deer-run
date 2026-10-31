<template>
  <div class="max-w-4xl space-y-6">
    <!-- Request form -->
    <div class="bg-white rounded-xl border border-gray-200 p-5">
      <h2 class="font-display font-bold text-bark mb-4">
        Request Time Off
      </h2>
      <div class="grid sm:grid-cols-3 gap-3">
        <div>
          <label class="label-sm">First day off *</label>
          <input v-model="form.startDate" type="date" :min="today" class="input-field w-full" @change="syncEnd">
        </div>
        <div>
          <label class="label-sm">Last day off *</label>
          <input v-model="form.endDate" type="date" :min="form.startDate || today" class="input-field w-full">
        </div>
        <div>
          <label class="label-sm">Type *</label>
          <select v-model="form.type" class="input-field w-full">
            <option v-for="(label, value) in TIME_OFF_LABELS" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>
      </div>
      <div class="mt-3">
        <label class="label-sm">Reason (optional)</label>
        <textarea
          v-model="form.reason"
          rows="2"
          maxlength="500"
          class="input-field w-full"
          placeholder="Anything your manager should know"
        />
      </div>
      <div class="flex flex-wrap items-center gap-3 mt-4">
        <button class="btn-amber px-5 py-2 text-sm disabled:opacity-50" :disabled="saving || !form.startDate || !form.endDate" @click="submit">
          {{ saving ? 'Sending…' : 'Send Request' }}
        </button>
        <span v-if="requestDays" class="text-sm text-gray-500 font-body">{{ requestDays }} day{{ requestDays === 1 ? '' : 's' }}</span>
        <span v-if="formError" class="text-sm text-red-500 font-body">{{ formError }}</span>
      </div>
      <div v-if="submitted" class="mt-4 bg-pine/10 border border-pine/20 rounded-lg px-4 py-3 text-sm font-body text-pine">
        Request sent. You'll get an email when a manager approves or denies it.
        <div v-if="submitted.scheduledShifts?.length" class="mt-1 text-bark">
          Heads up: you're on the schedule
          {{ submitted.scheduledShifts.map(s => `${formatLocalDate(s.date)} ${shortTime(s.startTime)}–${shortTime(s.endTime)}`).join(', ') }}.
          Your manager will see this when reviewing the request.
        </div>
      </div>
    </div>

    <!-- My requests -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 font-semibold text-bark font-body">
        My Requests
      </div>
      <div v-if="loading" class="px-5 py-6 text-gray-400 text-sm">
        Loading…
      </div>
      <div v-else-if="error" class="px-5 py-6 text-red-500 text-sm">
        {{ error }}
      </div>
      <div v-else-if="!requests.length" class="px-5 py-8 text-center text-gray-400 text-sm font-body">
        You haven't requested any time off yet.
      </div>
      <ul v-else class="divide-y divide-gray-50">
        <li v-for="r in requests" :key="r.id" class="px-5 py-3 flex flex-wrap items-start gap-x-4 gap-y-1 font-body text-sm">
          <div class="flex-1 min-w-[12rem]">
            <div class="font-semibold text-bark">
              {{ formatRange(r) }}
              <span class="font-normal text-gray-400">· {{ r.days }} day{{ r.days === 1 ? '' : 's' }} · {{ TIME_OFF_LABELS[r.type] }}</span>
            </div>
            <div v-if="r.reason" class="text-gray-500 text-xs mt-0.5">
              {{ r.reason }}
            </div>
            <div v-if="r.reviewNote" class="text-xs mt-0.5 text-bark">
              Manager's note: {{ r.reviewNote }}
            </div>
          </div>
          <span :class="['text-xs px-2 py-0.5 rounded-full', STATUS_CLASSES[r.status]]">{{ STATUS_LABELS[r.status] }}</span>
          <button
            v-if="r.status === 'PENDING'"
            class="text-xs text-red-400 hover:text-red-600"
            :disabled="saving"
            @click="cancel(r)"
          >
            Cancel
          </button>
        </li>
      </ul>
    </div>
    <p class="text-gray-400 text-xs font-body">
      You can cancel a request while it's pending. Once it's approved or denied, talk to your manager about changes.
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { localDate, formatLocalDate, daysBetween, isValidYmd } from '@/lib/timeclock'
import { shortTime } from '@/lib/schedule'
import { TIME_OFF_LABELS } from '@/components/schedule/scheduleDisplay'
import { STATUS_LABELS, STATUS_CLASSES, formatRange } from '@/components/schedule/timeOffDisplay'

const today     = localDate()
const requests  = ref([])
const loading   = ref(false)
const error     = ref(null)
const saving    = ref(false)
const formError = ref(null)
const submitted = ref(null)
const form      = ref({ startDate: '', endDate: '', type: 'VACATION', reason: '' })

const requestDays = computed(() => {
  const { startDate, endDate } = form.value
  if (!isValidYmd(startDate) || !isValidYmd(endDate) || endDate < startDate) return 0
  return daysBetween(startDate, endDate) + 1
})

// Default the last day to the first day, and keep it from falling before it
function syncEnd() {
  if (!form.value.endDate || form.value.endDate < form.value.startDate) form.value.endDate = form.value.startDate
}

async function load() {
  loading.value = true
  error.value   = null
  try {
    requests.value = await apiFetch('/api/staff/time-off')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function submit() {
  saving.value    = true
  formError.value = null
  submitted.value = null
  try {
    submitted.value = await apiFetch('/api/staff/time-off', { method: 'POST', body: form.value })
    form.value = { startDate: '', endDate: '', type: form.value.type, reason: '' }
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function cancel(r) {
  if (!confirm(`Cancel your time off request for ${formatRange(r)}?`)) return
  saving.value = true
  error.value  = null
  try {
    await apiFetch(`/api/staff/time-off/${r.id}`, { method: 'PUT', body: { action: 'cancel' } })
    await load()
  } catch (e) {
    error.value = e.message
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
