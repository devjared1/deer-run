<template>
  <div class="space-y-4">
    <!-- Primary action in the admin top bar -->
    <Teleport
      to="#admin-page-actions"
      defer
    >
      <AppButton
        :icon="IconAdd"
        class="hidden sm:inline-flex"
        :disabled="!data"
        @click="openCreate({ employeeId: null, date: defaultDate })"
      >
        Add shift
      </AppButton>
      <IconButton
        :icon="IconAdd"
        label="Add shift"
        variant="filled"
        class="sm:hidden"
        :disabled="!data"
        @click="openCreate({ employeeId: null, date: defaultDate })"
      />
    </Teleport>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3 print:hidden">
      <DateStepper
        :model-value="stepperDate"
        :step="STEPS[view]"
        :format-title="stepperTitle"
        today
        class="max-w-full"
        @update:model-value="onStep"
      />
      <SegmentedButton
        :model-value="view"
        label="View"
        :options="viewOptions"
        @update:model-value="setView"
      />
      <SelectField
        v-model="department"
        label="Department"
        placeholder="All departments"
        :options="departmentOptions"
        class="w-full sm:w-60 order-last md:order-none"
      />
      <div class="ml-auto flex items-center gap-2">
        <div class="hidden md:flex flex-wrap items-center gap-2">
          <AppButton
            v-if="view !== 'month'"
            variant="outlined"
            :icon="IconCopy"
            :disabled="!data || saving"
            :title="`Copy the previous ${copyUnit} of shifts into this period`"
            @click="openCopy"
          >
            Copy previous {{ copyUnitShort }}
          </AppButton>
          <AppButton
            variant="outlined"
            :icon="IconMail"
            :disabled="!data || saving"
            title="Email each employee their own shifts for this period"
            @click="openEmail"
          >
            Email schedule
          </AppButton>
          <AppButton
            variant="outlined"
            :icon="IconPrint"
            :disabled="!data"
            @click="printLandscape"
          >
            Print
          </AppButton>
        </div>
        <RowActionsMenu
          class="md:hidden"
          label="More schedule actions"
          :items="menuItems"
        />
      </div>
    </div>

    <!-- Printed title (the date stepper shows the period on screen) -->
    <div
      v-if="data"
      class="sr-only print:not-sr-only print:flex print:items-baseline print:gap-4 print:mb-2"
    >
      <h2 class="font-display text-headline-s text-on-surface">
        Deer Run Schedule · {{ periodLabel }}
      </h2>
      <span
        v-if="department"
        class="text-body-m text-on-surface-variant"
      >{{ department }}</span>
      <span class="hidden print:inline text-body-s text-on-surface-variant ml-auto">Printed {{ printedAt }}</span>
    </div>

    <Skeleton
      v-if="loading && !data"
      variant="rect"
      height="360px"
      label="Loading schedule"
    />
    <ErrorBanner
      v-else-if="error"
      :message="error"
      :retrying="loading"
      @retry="load"
    />

    <template v-else-if="data">
      <!-- Warnings: icon + text, each shift listed -->
      <div
        v-if="warningShifts.length"
        class="rounded-shape-md bg-error-container text-on-error-container print:hidden"
      >
        <button
          type="button"
          class="state-layer flex items-center gap-3 w-full min-h-12 px-4 rounded-shape-md text-left"
          :aria-expanded="String(showWarnings)"
          aria-controls="schedule-warnings"
          @click="showWarnings = !showWarnings"
        >
          <IconWarning
            class="w-5 h-5 flex-none"
            aria-hidden="true"
          />
          <span class="flex-1 text-label-l">
            {{ warningShifts.length }} shift{{ warningShifts.length === 1 ? '' : 's' }} with warnings
          </span>
          <IconExpand
            :class="['w-6 h-6 flex-none transition-transform duration-short-4', showWarnings ? 'rotate-180' : '']"
            aria-hidden="true"
          />
        </button>
        <ul
          v-show="showWarnings"
          id="schedule-warnings"
          class="px-4 pb-3 space-y-1 text-body-m"
        >
          <li
            v-for="s in warningShifts"
            :key="s.id"
          >
            <button
              type="button"
              class="text-left underline-offset-2 hover:underline py-1"
              @click="openEdit(s)"
            >
              <span class="text-label-l">{{ employeeName(s.employeeId) }}, {{ shiftWhen(s) }}:</span>
              {{ warnings[s.id].join('; ') }}
            </button>
          </li>
        </ul>
      </div>

      <ScheduleMonth
        v-if="view === 'month'"
        :dates="dates"
        :month="data.period.start.slice(0, 7)"
        :employees="visibleEmployees"
        :shifts="data.shifts"
        :time-off="data.timeOff"
        :warnings="warnings"
        editable
        @add="openCreate"
        @edit="openEdit"
      />
      <ScheduleGrid
        v-else
        :dates="dates"
        :employees="visibleEmployees"
        :shifts="data.shifts"
        :time-off="data.timeOff"
        :warnings="warnings"
        :caption="`Schedule, ${periodLabel}`"
        editable
        @add="openCreate"
        @edit="openEdit"
      />

      <ScheduleLegend />
      <p class="text-body-s text-on-surface-variant print:hidden">
        Select an empty spot to add a shift, or a shift to edit it. An end time earlier than the start runs past midnight.
      </p>
    </template>

    <!-- Add / edit shift -->
    <AppDialog
      v-model:open="formOpen"
      :title="form?.id ? 'Edit shift' : 'Add shift'"
      persistent
    >
      <form
        v-if="form"
        id="shift-form"
        class="space-y-4 pt-2"
        novalidate
        @submit.prevent="saveShift"
      >
        <SelectField
          v-model="form.employeeId"
          label="Employee"
          required
          placeholder="Select an employee"
          :options="employeeOptions"
          :error="employeeMissing ? 'Choose an employee' : ''"
        />
        <TextField
          v-model="form.date"
          type="date"
          label="Date"
          required
        />
        <div>
          <div class="grid grid-cols-2 gap-3">
            <TextField
              v-model="form.startTime"
              type="time"
              step="900"
              label="Start"
              required
            />
            <TextField
              v-model="form.endTime"
              type="time"
              step="900"
              label="End"
              required
            />
          </div>
          <p
            v-if="formHours"
            class="px-4 pt-1 text-body-s text-on-surface-variant"
          >
            {{ formHours }}
          </p>
        </div>
        <SelectField
          v-model="form.position"
          label="Working as"
          :placeholder="usualPositionLabel"
        >
          <optgroup
            v-for="dept in departments"
            :key="dept"
            :label="dept"
          >
            <option
              v-for="p in positionsIn(dept)"
              :key="p.value"
              :value="p.value"
            >
              {{ p.label }}
            </option>
          </optgroup>
        </SelectField>
        <TextField
          v-model="form.notes"
          label="Notes"
          maxlength="500"
          placeholder="e.g. Opening, beverage cart"
        />
        <ul
          v-if="formWarnings.length"
          class="rounded-shape-sm bg-error-container text-on-error-container px-3 py-2 text-body-s space-y-1"
        >
          <li
            v-for="w in formWarnings"
            :key="w"
            class="flex items-start gap-2"
          >
            <IconWarning
              class="w-4 h-4 mt-0.5 flex-none"
              aria-hidden="true"
            />
            <span><span class="sr-only">Warning: </span>{{ w }}</span>
          </li>
        </ul>
        <ErrorBanner
          v-if="formError"
          :message="formError"
        />
      </form>
      <template #actions="{ close }">
        <AppButton
          v-if="form?.id"
          variant="text"
          :icon="IconDelete"
          class="mr-auto !text-error"
          :disabled="saving"
          @click="deleteShift"
        >
          Delete
        </AppButton>
        <AppButton
          variant="text"
          :disabled="saving"
          @click="close"
        >
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          form="shift-form"
          :loading="saving"
        >
          {{ form?.id ? 'Save' : 'Add shift' }}
        </AppButton>
      </template>
    </AppDialog>

    <!-- Copy previous period -->
    <AppDialog
      v-model:open="copying"
      :title="`Copy previous ${copyUnit}?`"
      :persistent="saving"
    >
      <p v-if="data">
        Shifts from {{ formatRange(copySource.from, copySource.to) }} will be added to
        {{ formatRange(data.period.start, data.period.end) }} on the same days. Shifts already in this period stay,
        exact duplicates are skipped, and inactive employees aren't copied.
      </p>
      <ErrorBanner
        v-if="formError"
        :message="formError"
        class="mt-4"
      />
      <template #actions="{ close }">
        <AppButton
          variant="text"
          :disabled="saving"
          @click="close"
        >
          Cancel
        </AppButton>
        <AppButton
          :icon="IconCopy"
          :loading="saving"
          @click="copyPrevious"
        >
          Copy shifts
        </AppButton>
      </template>
    </AppDialog>

    <!-- Email the schedule -->
    <AppDialog
      v-model:open="emailing"
      :title="emailResult ? 'Some emails failed' : 'Email the schedule?'"
      :persistent="saving"
    >
      <template v-if="data && !emailResult">
        <p v-if="emailRecipients">
          Each of the {{ emailRecipients }} active employee{{ emailRecipients === 1 ? '' : 's' }} with shifts during
          {{ formatRange(data.period.start, data.period.end) }} will get an email with their own shifts and approved
          time off for that period (all departments). Employees without an email address are skipped.
        </p>
        <p v-else>
          No active employees have shifts during {{ formatRange(data.period.start, data.period.end) }}.
        </p>
      </template>
      <template v-else-if="emailResult">
        <p class="text-on-surface">
          {{ emailSummary(emailResult) }}
        </p>
        <div class="mt-3 rounded-shape-sm bg-error-container text-on-error-container px-3 py-2 text-body-s">
          Failed for {{ emailResult.failed.length }}:
          <ul class="list-disc ml-5 mt-1">
            <li
              v-for="f in emailResult.failed"
              :key="f.employeeId"
            >
              {{ f.name }}: {{ f.error }}
            </li>
          </ul>
        </div>
      </template>
      <ErrorBanner
        v-if="formError"
        :message="formError"
        class="mt-4"
      />
      <template #actions="{ close }">
        <template v-if="!emailResult">
          <AppButton
            variant="text"
            :disabled="saving"
            @click="close"
          >
            Cancel
          </AppButton>
          <AppButton
            :icon="IconMail"
            :loading="saving"
            :disabled="!emailRecipients"
            @click="emailSchedule"
          >
            Send emails
          </AppButton>
        </template>
        <AppButton
          v-else
          @click="close"
        >
          Done
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { printLandscape } from '@/lib/print'
import { localDate, addDays, formatLocalDate, isValidYmd, isValidHhmm } from '@/lib/timeclock'
import { SCHEDULE_VIEWS, scheduleWarnings, datesBetween, shiftMinutes, longTime } from '@/lib/schedule'
import { employeePositions, departments, positionLabel } from '@/data/employeePositions'
import { departmentOf } from '@/components/schedule/scheduleDisplay'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import ScheduleGrid from '@/components/schedule/ScheduleGrid.vue'
import ScheduleMonth from '@/components/schedule/ScheduleMonth.vue'
import ScheduleLegend from '@/components/schedule/ScheduleLegend.vue'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import DateStepper from '@/components/ui/DateStepper.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconCopy from '~icons/material-symbols/content-copy-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'
import IconExpand from '~icons/material-symbols/expand-more-rounded'

const route    = useRoute()
const router   = useRouter()
const confirm  = useConfirm()
const snackbar = useSnackbar()

// DateStepper step per view (two weeks = 14 days)
const STEPS = { week: 'week', biweek: 14, month: 'month' }
const viewOptions = Object.entries(SCHEDULE_VIEWS).map(([value, v]) => ({ value, label: v.label }))
const departmentOptions = departments.map(d => ({ value: d, label: d }))

const data         = ref(null)
const loading      = ref(false)
const error        = ref(null)
const saving       = ref(false)
const formError    = ref(null)
const form         = ref(null)
const formOpen     = ref(false)
const triedSave    = ref(false)
const copying      = ref(false)
const emailing     = ref(false)
const emailResult  = ref(null)
const showWarnings = ref(false)
const department   = ref(null)
const printedAt    = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' })

const view = computed(() => (SCHEDULE_VIEWS[route.query.view] ? route.query.view : 'week'))
const date = computed(() => (isValidYmd(route.query.date) ? route.query.date : null))

const copyUnit      = computed(() => (view.value === 'week' ? 'week' : 'two weeks'))
const copyUnitShort = computed(() => (view.value === 'week' ? 'week' : '2 weeks'))

function positionsIn(dept) {
  return employeePositions.filter(p => p.department === dept)
}

function setView(v) {
  router.replace({ query: { ...route.query, view: v } })
}

function go(d) {
  const query = { ...route.query, view: view.value }
  if (d) query.date = d
  else delete query.date
  router.replace({ query })
}

// The stepper moves from the period's first day; the server snaps any date to its period
const stepperDate = computed(() => data.value?.period.start ?? date.value ?? localDate())
// Compact so it fits next to the arrows on a phone: "Nov 1 – 7", "Oct 25 – Nov 7", "Dec 27, 2026 – Jan 9, 2027"
function stepperTitle() {
  if (!data.value) return 'Loading…'
  const { start, end } = data.value.period
  if (view.value === 'month') return periodLabel.value
  const thisYear = start.slice(0, 4) === localDate().slice(0, 4) && end.slice(0, 4) === start.slice(0, 4)
  const y = thisYear ? {} : { year: 'numeric' }
  const to = start.slice(0, 7) === end.slice(0, 7) && thisYear
    ? formatLocalDate(end, { day: 'numeric' })
    : formatLocalDate(end, { month: 'short', day: 'numeric', ...y })
  return `${formatLocalDate(start, { month: 'short', day: 'numeric', ...y })} – ${to}`
}
function onStep(d) {
  go(d === localDate() ? null : d)
}

const menuItems = computed(() => [
  ...(view.value !== 'month'
    ? [{ label: `Copy previous ${copyUnitShort.value}`, icon: IconCopy, disabled: !data.value || saving.value, onClick: openCopy }]
    : []),
  { label: 'Email schedule', icon: IconMail, disabled: !data.value || saving.value, onClick: openEmail },
  { label: 'Print', icon: IconPrint, disabled: !data.value, onClick: printLandscape },
])

const dates = computed(() => {
  if (!data.value) return []
  const p = data.value.period
  return view.value === 'month' ? datesBetween(p.gridStart, p.gridEnd) : datesBetween(p.start, p.end)
})

function formatRange(from, to) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${formatLocalDate(from, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })} – ${
    formatLocalDate(to, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

const periodLabel = computed(() => {
  const p = data.value.period
  return view.value === 'month'
    ? formatLocalDate(p.start, { month: 'long', year: 'numeric' })
    : formatRange(p.start, p.end)
})

const employeeById = computed(() => new Map((data.value?.employees ?? []).map(e => [e.id, e])))

function employeeName(id) {
  const e = employeeById.value.get(id)
  return e ? `${e.firstName} ${e.lastName}` : 'Unknown employee'
}

function shiftWhen(s) {
  return `${formatLocalDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${longTime(s.startTime)} – ${longTime(s.endTime)}`
}

// Employees shown: by their usual position's department, or with a shift worked in that department
const visibleEmployees = computed(() => {
  const all = data.value?.employees ?? []
  if (!department.value) return all
  const inDept = new Set(
    data.value.shifts.filter(s => s.position && departmentOf(s.position) === department.value).map(s => s.employeeId),
  )
  return all.filter(e => departmentOf(e.position) === department.value || inDept.has(e.id))
})

const warnings = computed(() => (data.value ? scheduleWarnings(data.value.shifts, data.value.employees, data.value.timeOff) : {}))

// Shifts with warnings among the employees and days shown (a month counts its padding days too, as before)
const warningShifts = computed(() => {
  const shown = new Set(visibleEmployees.value.map(e => e.id))
  const inView = new Set(dates.value)
  return (data.value?.shifts ?? [])
    .filter(s => warnings.value[s.id] && shown.has(s.employeeId) && inView.has(s.date))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
})

// Today if it's in the period shown, otherwise the period's first day
const defaultDate = computed(() => {
  const p = data.value?.period
  const today = localDate()
  return p && (today < p.start || today > p.end) ? p.start : today
})

const copySource = computed(() => {
  const p = data.value.period
  const days = view.value === 'week' ? 7 : 14
  return { from: addDays(p.start, -days), to: addDays(p.start, -1), days }
})

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ view: view.value })
    if (date.value) params.set('date', date.value)
    data.value = await apiFetch(`/api/admin/shifts?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(() => [view.value, date.value], load, { immediate: true })

// ─── Shift form ─────────────────────────────────────────────────────────────

const formEmployees = computed(() => (data.value?.employees ?? []).filter(e => e.active || e.id === form.value?.employeeId))
const formEmployee  = computed(() => data.value?.employees.find(e => e.id === form.value?.employeeId) ?? null)
const employeeOptions = computed(() => formEmployees.value.map(e => ({
  value: e.id,
  label: `${e.lastName}, ${e.firstName} · ${positionLabel(e.position)}${e.active ? '' : ' (inactive)'}`,
})))
const usualPositionLabel = computed(() => `Their usual position${formEmployee.value ? ` (${positionLabel(formEmployee.value.position)})` : ''}`)
const employeeMissing = computed(() => triedSave.value && !form.value?.employeeId)

const formHours = computed(() => {
  const f = form.value
  if (!f || !isValidHhmm(f.startTime) || !isValidHhmm(f.endTime) || f.startTime === f.endTime) return ''
  const minutes = shiftMinutes(f)
  const h = (minutes / 60).toFixed(2).replace(/\.?0+$/, '')
  return `${h} hours, ${longTime(f.startTime)} – ${longTime(f.endTime)}${f.endTime < f.startTime ? ' (ends the next day)' : ''}`
})

// Warnings for the shift as it would be saved, against everything else on the schedule
const formWarnings = computed(() => {
  const f = form.value
  if (!f?.employeeId || !isValidYmd(f.date) || !isValidHhmm(f.startTime) || !isValidHhmm(f.endTime) || f.startTime === f.endTime) return []
  const candidate = { ...f, id: f.id ?? '__new__' }
  const others = data.value.shifts.filter(s => s.id !== f.id)
  return scheduleWarnings([...others, candidate], data.value.employees, data.value.timeOff)[candidate.id] ?? []
})

function openCreate({ employeeId, date: d }) {
  // Prefill times from the employee's latest shift, or a typical opening shift
  const last = employeeId ? [...data.value.shifts].reverse().find(s => s.employeeId === employeeId) : null
  form.value = {
    id: null,
    employeeId,
    date: d,
    startTime: last?.startTime ?? '07:00',
    endTime: last?.endTime ?? '15:00',
    position: null,
    notes: '',
  }
  formError.value = null
  triedSave.value = false
  formOpen.value  = true
}

function openEdit(shift) {
  form.value = { ...shift, position: shift.position ?? null, notes: shift.notes ?? '' }
  formError.value = null
  triedSave.value = false
  formOpen.value  = true
}

function shiftBody(f) {
  return {
    employeeId: f.employeeId, date: f.date, startTime: f.startTime, endTime: f.endTime,
    position: f.position || null, notes: f.notes || null,
  }
}

function putShift(saved) {
  const shifts = data.value.shifts.filter(s => s.id !== saved.id)
  data.value.shifts = [...shifts, saved].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
}

async function saveShift() {
  const f = form.value
  triedSave.value = true
  if (!f.employeeId) { formError.value = 'Choose an employee'; return }
  saving.value    = true
  formError.value = null
  try {
    const saved = await apiFetch(f.id ? `/api/admin/shifts/${f.id}` : '/api/admin/shifts', {
      method: f.id ? 'PUT' : 'POST',
      body: shiftBody(f),
    })
    putShift(saved)
    formOpen.value = false
    snackbar.show(`${f.id ? 'Shift saved' : 'Shift added'}: ${employeeName(saved.employeeId)}, ${shiftWhen(saved)}`)
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function deleteShift() {
  const f = form.value
  const who = formEmployee.value ? `${formEmployee.value.firstName} ${formEmployee.value.lastName}'s` : 'this'
  // Close the form first so only the confirmation dialog is open (reopened if the delete is cancelled)
  formOpen.value = false
  const ok = await confirm({
    title: 'Delete shift?',
    message: `Delete ${who} shift on ${shiftWhen(f)}?`,
    confirmLabel: 'Delete',
    destructive: true,
    icon: IconDelete,
  })
  if (!ok) { formOpen.value = true; return }
  saving.value    = true
  formError.value = null
  try {
    await apiFetch(`/api/admin/shifts/${f.id}`, { method: 'DELETE' })
    data.value.shifts = data.value.shifts.filter(s => s.id !== f.id)
    snackbar.show({
      message: `Shift deleted: ${employeeName(f.employeeId)}, ${shiftWhen(f)}`,
      actionLabel: 'Undo',
      onAction: () => restoreShift(f),
    })
  } catch (e) {
    formError.value = e.message
    formOpen.value  = true
  } finally {
    saving.value = false
  }
}

// Undo a delete: add the same shift back (it gets a new id)
async function restoreShift(f) {
  try {
    putShift(await apiFetch('/api/admin/shifts', { method: 'POST', body: shiftBody(f) }))
    snackbar.show('Shift restored')
  } catch (e) {
    snackbar.show({ message: `Couldn't restore the shift: ${e.message}`, tone: 'error' })
  }
}

// ─── Copy / email ───────────────────────────────────────────────────────────

function openCopy() {
  formError.value = null
  copying.value   = true
}

function openEmail() {
  formError.value   = null
  emailResult.value = null
  emailing.value    = true
}

// Active employees with shifts in the period itself (a month's padding days aren't emailed)
const emailRecipients = computed(() => {
  if (!data.value) return 0
  const { start, end } = data.value.period
  const active = new Set(data.value.employees.filter(e => e.active).map(e => e.id))
  return new Set(data.value.shifts.filter(s => s.date >= start && s.date <= end && active.has(s.employeeId)).map(s => s.employeeId)).size
})

function emailSummary(r) {
  const parts = [`Sent ${r.sent} email${r.sent === 1 ? '' : 's'}.`]
  if (r.skippedNoEmail || r.skippedInactive) {
    parts.push(`Skipped ${r.skippedNoEmail} without an email address and ${r.skippedInactive} inactive.`)
  }
  return parts.join(' ')
}

async function emailSchedule() {
  saving.value    = true
  formError.value = null
  try {
    const { start, end } = data.value.period
    const result = await apiFetch('/api/admin/shifts/email', { method: 'POST', body: { from: start, to: end } })
    if (result.failed?.length) {
      emailResult.value = result     // keep the dialog open with the failures listed
    } else {
      emailing.value = false
      snackbar.show(emailSummary(result))
    }
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function copyPrevious() {
  saving.value    = true
  formError.value = null
  try {
    const { from, days } = copySource.value
    const r = await apiFetch('/api/admin/shifts/copy', {
      method: 'POST',
      body: { from, to: data.value.period.start, days },
    })
    copying.value = false
    const skipped = r.skippedExisting || r.skippedInactive
      ? ` Skipped ${r.skippedExisting} already scheduled and ${r.skippedInactive} for inactive employees.`
      : ''
    snackbar.show(`Copied ${r.created} shift${r.created === 1 ? '' : 's'}.${skipped}`)
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>
