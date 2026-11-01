<template>
  <div class="max-w-5xl space-y-4">
    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ChipGroup
        v-model="status"
        type="choice"
        label="Status"
        :options="TABS"
      />
      <FilterChip
        :selected="upcomingOnly"
        label="Upcoming and current only"
        @click="upcomingOnly = !upcomingOnly"
      />
      <AppButton
        variant="text"
        :icon="IconCalendar"
        to="/admin/schedule"
        class="ml-auto"
      >
        Open schedule
      </AppButton>
    </div>

    <div
      v-if="loading && !requests.length"
      class="space-y-3"
      role="status"
    >
      <span class="sr-only">Loading time off requests</span>
      <Skeleton
        v-for="n in 3"
        :key="n"
        variant="card"
      />
    </div>
    <ErrorBanner
      v-else-if="error"
      :message="error"
      :retrying="loading"
      @retry="load"
    />
    <EmptyState
      v-else-if="!requests.length"
      :icon="IconBeach"
      :title="status === 'PENDING' ? 'No requests waiting for a decision' : 'No requests found'"
      :message="upcomingOnly ? 'Only upcoming and current requests are shown.' : ''"
      class="rounded-shape-md bg-surface-container-low"
    />

    <ul
      v-else
      class="space-y-3"
      :aria-busy="loading ? 'true' : undefined"
    >
      <li
        v-for="r in requests"
        :key="r.id"
        class="rounded-shape-md border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 font-body"
      >
        <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div class="flex-1 min-w-[14rem] space-y-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 class="text-title-m text-on-surface">
                {{ r.employee?.firstName }} {{ r.employee?.lastName }}
              </h3>
              <span class="text-body-m text-on-surface-variant">{{ positionLabel(r.employee?.position) }}</span>
              <StatusChip
                v-if="r.employee && !r.employee.active"
                size="sm"
                label="Inactive"
                tone="neutral"
                icon="block"
              />
            </div>
            <p class="text-body-l text-on-surface">
              {{ formatRange(r) }}
              <span class="text-body-m text-on-surface-variant">· {{ r.days }} day{{ r.days === 1 ? '' : 's' }} · {{ TIME_OFF_LABELS[r.type] ?? r.type }}</span>
            </p>
            <p
              v-if="r.reason"
              class="text-body-m text-on-surface-variant"
            >
              “{{ r.reason }}”
            </p>
            <div
              v-if="r.scheduledShifts.length"
              class="flex items-start gap-2 mt-2 rounded-shape-sm bg-warning-container text-on-warning-container px-3 py-2 text-body-m"
            >
              <IconWarning
                class="w-5 h-5 flex-none mt-px"
                aria-hidden="true"
              />
              <div>
                <span class="sr-only">Warning: </span>
                {{ r.scheduledShifts.length }} shift{{ r.scheduledShifts.length === 1 ? '' : 's' }} scheduled during this time:
                <ul class="mt-0.5">
                  <li
                    v-for="(s, i) in r.scheduledShifts"
                    :key="s.id ?? i"
                  >
                    {{ formatLocalDate(s.date) }}, {{ longTime(s.startTime) }} – {{ longTime(s.endTime) }}
                  </li>
                </ul>
              </div>
            </div>
            <p class="text-body-s text-on-surface-variant pt-1">
              Requested {{ formatTimestamp(r.createdAt) }}
              <template v-if="r.reviewedAt">
                · {{ STATUS_LABELS[r.status] }} {{ formatTimestamp(r.reviewedAt) }}{{ r.reviewedByName ? ` by ${r.reviewedByName}` : '' }}
              </template>
            </p>
            <p
              v-if="r.reviewNote"
              class="text-body-s text-on-surface"
            >
              Note: {{ r.reviewNote }}
            </p>
          </div>
          <StatusChip
            kind="timeOff"
            :status="r.status"
          />
          <div
            v-if="r.status === 'PENDING'"
            class="flex flex-wrap gap-2 w-full sm:w-auto"
          >
            <AppButton
              :icon="IconCheck"
              @click="openDecision(r, 'approve')"
            >
              Approve
            </AppButton>
            <AppButton
              variant="danger"
              :icon="IconClose"
              @click="openDecision(r, 'deny')"
            >
              Deny
            </AppButton>
          </div>
          <div
            v-else-if="r.status === 'APPROVED' && r.endDate >= today"
            class="flex gap-2 w-full sm:w-auto"
          >
            <AppButton
              variant="danger"
              :icon="IconUndo"
              @click="openDecision(r, 'revoke')"
            >
              Revoke
            </AppButton>
          </div>
        </div>
      </li>
    </ul>

    <!-- Approve / deny / revoke -->
    <AppDialog
      v-model:open="decisionOpen"
      :title="deciding ? `${ACTION_LABELS[deciding.action]} ${deciding.action === 'revoke' ? 'approved time off' : 'time off'}?` : ''"
      persistent
    >
      <form
        v-if="deciding"
        id="time-off-decision"
        class="space-y-4"
        novalidate
        @submit.prevent="decide"
      >
        <div class="space-y-2">
          <p>
            {{ deciding.request.employee?.firstName }} {{ deciding.request.employee?.lastName }},
            {{ formatRange(deciding.request) }}. They'll get an email with your decision.
          </p>
          <p
            v-if="deciding.action === 'approve' && deciding.request.scheduledShifts.length"
            class="flex items-start gap-2 rounded-shape-sm bg-warning-container text-on-warning-container px-3 py-2"
          >
            <IconWarning
              class="w-5 h-5 flex-none"
              aria-hidden="true"
            />
            <span>
              Their {{ deciding.request.scheduledShifts.length }} scheduled shift{{ deciding.request.scheduledShifts.length === 1 ? '' : 's' }}
              during this time stay on the schedule (flagged) until you change them.
            </span>
          </p>
          <p v-if="deciding.action === 'revoke'">
            The request becomes Denied (with your note) and comes off the schedule. Add any shifts they should now work.
          </p>
        </div>
        <TextArea
          v-model="deciding.note"
          :label="deciding.action === 'revoke' ? 'Note to the employee' : 'Note to the employee (optional)'"
          :required="deciding.action === 'revoke'"
          :helper="deciding.action === 'revoke' ? 'Required: tell them why the approval is revoked' : ''"
          :rows="2"
          :maxlength="500"
          auto-grow
          data-autofocus
        />
        <ErrorBanner
          v-if="formError"
          :message="formError"
        />
      </form>
      <template #actions="{ close }">
        <AppButton
          variant="text"
          :disabled="saving"
          @click="close"
        >
          Cancel
        </AppButton>
        <AppButton
          v-if="deciding"
          type="submit"
          form="time-off-decision"
          :variant="deciding.action === 'approve' ? 'filled' : 'danger'"
          :icon="ACTION_ICONS[deciding.action]"
          :loading="saving"
          :disabled="deciding.action === 'revoke' && !deciding.note.trim()"
        >
          {{ ACTION_LABELS[deciding.action] }}
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { localDate, formatLocalDate } from '@/lib/timeclock'
import { longTime } from '@/lib/schedule'
import { positionLabel } from '@/data/employeePositions'
import { TIME_OFF_LABELS } from '@/components/schedule/scheduleDisplay'
import { STATUS_LABELS, formatRange } from '@/components/schedule/timeOffDisplay'
import { usePendingTimeOff } from '@/composables/usePendingTimeOff'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import FilterChip from '@/components/ui/FilterChip.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextArea from '@/components/ui/TextArea.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IconCheck from '~icons/material-symbols/check-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconUndo from '~icons/material-symbols/undo-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconCalendar from '~icons/material-symbols/calendar-month-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'

const TABS = [
  { value: 'PENDING',   label: 'Pending' },
  { value: 'APPROVED',  label: 'Approved' },
  { value: 'DENIED',    label: 'Denied' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'all',       label: 'All' },
]

const ACTION_LABELS = { approve: 'Approve', deny: 'Deny', revoke: 'Revoke' }
const ACTION_ICONS  = { approve: IconCheck, deny: IconClose, revoke: IconUndo }
const DONE_LABELS   = { approve: 'Approved', deny: 'Denied', revoke: 'Approval revoked' }

const pendingTimeOff = usePendingTimeOff()
const snackbar       = useSnackbar()
const today          = localDate()

const status       = ref('PENDING')
const upcomingOnly = ref(true)
const requests     = ref([])
const loading      = ref(false)
const error        = ref(null)
const saving       = ref(false)
const formError    = ref(null)
const deciding     = ref(null)
const decisionOpen = ref(false)

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
  deciding.value     = { request, action, note: '' }
  formError.value    = null
  decisionOpen.value = true
}

async function decide() {
  const { request, action, note } = deciding.value
  if (action === 'revoke' && !note.trim()) return
  saving.value    = true
  formError.value = null
  try {
    const res = await apiFetch(`/api/admin/time-off/${request.id}`, { method: 'PUT', body: { action, note } })
    decisionOpen.value = false
    if (res.emailError) {
      snackbar.show({ message: `Saved, but the email to the employee failed: ${res.emailError}`, tone: 'error', duration: 8000 })
    } else {
      snackbar.show(`${DONE_LABELS[action]}. ${request.employee?.firstName ?? 'The employee'} has been emailed.`)
    }
    await Promise.all([load(), pendingTimeOff.refresh()])
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago',
  })
}
</script>
