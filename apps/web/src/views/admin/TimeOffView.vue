<template>
  <div class="max-w-5xl">
    <!-- Status tabs -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3">
      <div class="flex rounded-lg border border-gray-300 overflow-hidden">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          type="button"
          :class="['px-3 py-2 text-sm font-body transition-colors', status === tab.value ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
          @click="status = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-600 font-body">
        <input v-model="upcomingOnly" type="checkbox" class="rounded"> Upcoming and current only
      </label>
      <RouterLink to="/admin/schedule" class="ml-auto text-sm text-lake hover:text-pine font-body">
        Open schedule →
      </RouterLink>
    </div>

    <div v-if="loading" class="text-gray-400 text-sm">
      Loading…
    </div>
    <div v-else-if="error" class="text-red-500 text-sm">
      {{ error }}
    </div>
    <div v-else-if="!requests.length" class="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center text-gray-400 text-sm font-body">
      {{ status === 'PENDING' ? 'No requests waiting for a decision.' : 'No requests found.' }}
    </div>

    <ul v-else class="space-y-3">
      <li v-for="r in requests" :key="r.id" class="bg-white rounded-xl border border-gray-200 p-5 font-body">
        <div class="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div class="flex-1 min-w-[14rem]">
            <div class="font-semibold text-bark">
              {{ r.employee?.firstName }} {{ r.employee?.lastName }}
              <span class="font-normal text-gray-400 text-sm">· {{ positionLabel(r.employee?.position) }}</span>
              <span v-if="r.employee && !r.employee.active" class="text-xs text-red-500 ml-1">inactive</span>
            </div>
            <div class="text-bark mt-0.5">
              {{ formatRange(r) }}
              <span class="text-gray-400 text-sm">· {{ r.days }} day{{ r.days === 1 ? '' : 's' }} · {{ TIME_OFF_LABELS[r.type] }}</span>
            </div>
            <div v-if="r.reason" class="text-gray-600 text-sm mt-1">
              “{{ r.reason }}”
            </div>
            <div v-if="r.scheduledShifts.length" class="text-sm mt-2 text-clay">
              ⚠ Scheduled {{ r.scheduledShifts.length }} shift{{ r.scheduledShifts.length === 1 ? '' : 's' }} during this time:
              {{ r.scheduledShifts.map(s => `${formatLocalDate(s.date)} ${shortTime(s.startTime)}–${shortTime(s.endTime)}`).join(', ') }}
            </div>
            <div class="text-xs text-gray-400 mt-2">
              Requested {{ formatTimestamp(r.createdAt) }}
              <template v-if="r.reviewedAt">
                · {{ STATUS_LABELS[r.status] }} {{ formatTimestamp(r.reviewedAt) }}{{ r.reviewedByName ? ` by ${r.reviewedByName}` : '' }}
              </template>
            </div>
            <div v-if="r.reviewNote" class="text-xs text-bark mt-1">
              Note: {{ r.reviewNote }}
            </div>
          </div>
          <span :class="['text-xs px-2 py-0.5 rounded-full', STATUS_CLASSES[r.status]]">{{ STATUS_LABELS[r.status] }}</span>
          <div v-if="r.status === 'PENDING'" class="flex gap-2 w-full sm:w-auto">
            <button class="btn-pine px-4 py-2 text-sm" @click="openDecision(r, 'approve')">
              Approve
            </button>
            <button class="btn-outline-sm text-red-500" @click="openDecision(r, 'deny')">
              Deny
            </button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Approve / deny -->
    <div v-if="deciding" class="modal-overlay" @click.self="deciding = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">
          {{ deciding.action === 'approve' ? 'Approve' : 'Deny' }} time off?
        </h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          {{ deciding.request.employee?.firstName }} {{ deciding.request.employee?.lastName }},
          {{ formatRange(deciding.request) }}. They'll get an email with your decision.
          <span v-if="deciding.action === 'approve' && deciding.request.scheduledShifts.length" class="block mt-2 text-clay">
            Their {{ deciding.request.scheduledShifts.length }} scheduled shift{{ deciding.request.scheduledShifts.length === 1 ? '' : 's' }}
            during this time stay on the schedule (flagged) until you change them.
          </span>
        </p>
        <label class="label-sm">Note to the employee (optional)</label>
        <textarea v-model="deciding.note" rows="2" maxlength="500" class="input-field w-full" />
        <div class="flex justify-end gap-3 mt-4">
          <button class="btn-outline-sm" @click="deciding = null">
            Cancel
          </button>
          <button
            :class="[deciding.action === 'approve' ? 'btn-pine' : 'bg-red-500 hover:bg-red-600 text-white rounded-lg font-body', 'px-4 py-2 text-sm disabled:opacity-50']"
            :disabled="saving"
            @click="decide"
          >
            {{ saving ? 'Saving…' : deciding.action === 'approve' ? 'Approve' : 'Deny' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">
          {{ formError }}
        </p>
      </div>
    </div>

    <p v-if="notice" class="fixed bottom-5 right-5 bg-bark text-parch text-sm font-body rounded-lg px-4 py-3 shadow-lg">
      {{ notice }}
    </p>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { localDate, formatLocalDate } from '@/lib/timeclock'
import { shortTime } from '@/lib/schedule'
import { positionLabel } from '@/data/employeePositions'
import { TIME_OFF_LABELS } from '@/components/schedule/scheduleDisplay'
import { STATUS_LABELS, STATUS_CLASSES, formatRange } from '@/components/schedule/timeOffDisplay'
import { usePendingTimeOff } from '@/composables/usePendingTimeOff'

const TABS = [
  { value: 'PENDING',   label: 'Pending' },
  { value: 'APPROVED',  label: 'Approved' },
  { value: 'DENIED',    label: 'Denied' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'all',       label: 'All' },
]

const pendingTimeOff = usePendingTimeOff()

const status       = ref('PENDING')
const upcomingOnly = ref(true)
const requests     = ref([])
const loading      = ref(false)
const error        = ref(null)
const saving       = ref(false)
const formError    = ref(null)
const deciding     = ref(null)
const notice       = ref(null)

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ status: status.value })
    if (upcomingOnly.value) params.set('from', localDate())
    requests.value = await apiFetch(`/api/admin/time-off?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch([status, upcomingOnly], load, { immediate: true })

function openDecision(request, action) {
  deciding.value  = { request, action, note: '' }
  formError.value = null
}

async function decide() {
  saving.value    = true
  formError.value = null
  try {
    const { request, action, note } = deciding.value
    const res = await apiFetch(`/api/admin/time-off/${request.id}`, { method: 'PUT', body: { action, note } })
    deciding.value = null
    showNotice(res.emailError
      ? `Saved, but the email to the employee failed: ${res.emailError}`
      : `${action === 'approve' ? 'Approved' : 'Denied'}. ${request.employee?.firstName ?? 'The employee'} has been emailed.`)
    await Promise.all([load(), pendingTimeOff.refresh()])
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function showNotice(message) {
  notice.value = message
  setTimeout(() => { if (notice.value === message) notice.value = null }, 5000)
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago',
  })
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.btn-pine       { @apply bg-pine text-parch rounded-lg font-body font-semibold hover:bg-pine/90 transition-colors; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
