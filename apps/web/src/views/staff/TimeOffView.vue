<template>
  <div class="max-w-4xl space-y-4 pb-24">
    <!-- After a request: shifts already on the schedule during it -->
    <ErrorBanner
      v-if="submitted?.scheduledShifts?.length"
      tone="warning"
      title="You're on the schedule then"
      @dismiss="submitted = null"
    >
      {{ submitted.scheduledShifts.map(s => `${formatLocalDate(s.date)} ${shortTime(s.startTime)}–${shortTime(s.endTime)}`).join(', ') }}.
      Your manager will see this when reviewing the request.
    </ErrorBanner>

    <!-- My requests -->
    <section
      aria-labelledby="my-requests"
      class="space-y-2"
    >
      <h2
        id="my-requests"
        class="text-title-m text-on-surface"
      >
        My requests
      </h2>

      <Skeleton
        v-if="loading && !requests.length"
        variant="rect"
        height="200px"
        label="Loading your requests"
      />
      <ErrorBanner
        v-else-if="error"
        :message="error"
        :retrying="loading"
        @retry="load"
      />
      <Card
        v-else-if="!requests.length"
        variant="outlined"
      >
        <EmptyState
          :icon="IconBeach"
          title="No time off requests yet"
          message="Ask for days off and your manager will approve or deny them. You'll get an email either way."
          action-label="Request time off"
          :action-icon="IconAdd"
          @action="openForm"
        />
      </Card>
      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="r in requests"
          :key="r.id"
        >
          <Card padding="none">
            <div class="flex items-start gap-3 px-4 py-3">
              <div class="flex-1 min-w-0">
                <div class="text-title-s text-on-surface">
                  {{ formatRange(r) }}
                </div>
                <div class="text-body-m text-on-surface-variant">
                  {{ r.days }} day{{ r.days === 1 ? '' : 's' }} · {{ TIME_OFF_LABELS[r.type] ?? r.type }}
                </div>
                <p
                  v-if="r.reason"
                  class="mt-1 text-body-m text-on-surface-variant break-words"
                >
                  {{ r.reason }}
                </p>
                <p
                  v-if="r.reviewNote"
                  class="mt-1 text-body-m text-on-surface break-words"
                >
                  <span class="text-label-l">Manager's note:</span> {{ r.reviewNote }}
                </p>
              </div>
              <StatusChip
                kind="timeOff"
                :status="r.status"
                class="flex-none"
              />
            </div>
            <div
              v-if="r.status === 'PENDING'"
              class="flex justify-end px-2 pb-2 -mt-1"
            >
              <AppButton
                variant="text-danger"
                :icon="IconCancel"
                :disabled="saving"
                @click="cancel(r)"
              >
                Cancel request
              </AppButton>
            </div>
          </Card>
        </li>
      </ul>
      <p class="text-body-s text-on-surface-variant">
        You can cancel a request while it's pending. Once it's approved or denied, talk to your manager about changes.
      </p>
    </section>

    <!-- Extended FAB: above the bottom nav bar on phones -->
    <button
      type="button"
      class="state-layer fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] md:right-6 md:bottom-6 z-app-bar inline-flex items-center gap-3 h-14 pl-4 pr-5 rounded-shape-lg bg-primary-container text-on-primary-container shadow-elevation-3 hover:shadow-elevation-4 text-label-l font-body cursor-pointer print:hidden"
      @click="openForm"
    >
      <IconAdd
        class="w-6 h-6"
        aria-hidden="true"
      />
      Request time off
    </button>

    <!-- Request form -->
    <AppDialog
      v-model:open="formOpen"
      title="Request time off"
      persistent
      fullscreen-on-mobile
      confirm-label="Send"
      :confirm-disabled="!canSubmit"
      :confirm-loading="saving"
      @confirm="submit"
    >
      <form
        id="time-off-form"
        class="space-y-4 pt-1"
        @submit.prevent="submit"
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            v-model="form.startDate"
            type="date"
            label="First day off"
            :min="today"
            float-label
            required
            data-autofocus
          />
          <TextField
            v-model="form.endDate"
            type="date"
            label="Last day off"
            :min="form.startDate || today"
            float-label
            required
            :helper="requestDays ? `${requestDays} day${requestDays === 1 ? '' : 's'}` : ''"
          />
        </div>
        <SelectField
          v-model="form.type"
          label="Type"
          required
          :options="typeOptions"
        />
        <TextArea
          v-model="form.reason"
          label="Reason (optional)"
          :rows="3"
          :maxlength="500"
          counter
          auto-grow
          helper="Anything your manager should know"
        />
        <ErrorBanner
          v-if="formError"
          :message="formError"
        />
      </form>
      <template #actions="{ close }">
        <AppButton
          variant="text"
          @click="close"
        >
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          form="time-off-form"
          :icon="IconSend"
          :disabled="!canSubmit"
          :loading="saving"
        >
          Send request
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { localDate, formatLocalDate, daysBetween, isValidYmd } from '@/lib/timeclock'
import { shortTime } from '@/lib/schedule'
import { TIME_OFF_LABELS } from '@/components/schedule/scheduleDisplay'
import { formatRange } from '@/components/schedule/timeOffDisplay'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import SelectField from '@/components/ui/SelectField.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextArea from '@/components/ui/TextArea.vue'
import TextField from '@/components/ui/TextField.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'
import IconCancel from '~icons/material-symbols/cancel-rounded'
import IconSend from '~icons/material-symbols/send-rounded'

const confirm  = useConfirm()
const snackbar = useSnackbar()

const today     = localDate()
const requests  = ref([])
const loading   = ref(false)
const error     = ref(null)
const saving    = ref(false)
const formOpen  = ref(false)
const formError = ref(null)
const submitted = ref(null)
const form      = ref({ startDate: '', endDate: '', type: 'VACATION', reason: '' })

const typeOptions = Object.entries(TIME_OFF_LABELS).map(([value, label]) => ({ value, label }))

const requestDays = computed(() => {
  const { startDate, endDate } = form.value
  if (!isValidYmd(startDate) || !isValidYmd(endDate) || endDate < startDate) return 0
  return daysBetween(startDate, endDate) + 1
})
const canSubmit = computed(() => !saving.value && !!form.value.startDate && !!form.value.endDate)

// Default the last day to the first day, and keep it from falling before it
watch(() => form.value.startDate, start => {
  if (start && (!form.value.endDate || form.value.endDate < start)) form.value.endDate = start
})

function openForm() {
  formError.value = null
  formOpen.value  = true
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
  if (!canSubmit.value) return
  saving.value    = true
  formError.value = null
  submitted.value = null
  try {
    submitted.value = await apiFetch('/api/staff/time-off', { method: 'POST', body: form.value })
    form.value = { startDate: '', endDate: '', type: form.value.type, reason: '' }
    formOpen.value = false
    snackbar.show("Request sent. You'll get an email when a manager approves or denies it.")
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function cancel(r) {
  const ok = await confirm({
    title: 'Cancel this request?',
    message: `Your time off request for ${formatRange(r)} will be cancelled.`,
    confirmLabel: 'Cancel request',
    cancelLabel: 'Keep it',
    destructive: true,
  })
  if (!ok) return
  saving.value = true
  try {
    await apiFetch(`/api/staff/time-off/${r.id}`, { method: 'PUT', body: { action: 'cancel' } })
    snackbar.show('Request cancelled')
    await load()
  } catch (e) {
    // Keep the list on screen (e.g. it was approved meanwhile: reload to show that)
    snackbar.show({ message: e.message, tone: 'error' })
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
