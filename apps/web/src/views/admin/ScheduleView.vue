<template>
  <div class="schedule-page">
    <!-- Toolbar -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-3 print:hidden">
      <div>
        <label class="label-sm">View</label>
        <div class="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            v-for="(v, key) in SCHEDULE_VIEWS"
            :key="key"
            type="button"
            :class="['px-3 py-2 text-sm font-body transition-colors', view === key ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
            @click="setView(key)"
          >
            {{ v.label }}
          </button>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn-outline-sm" :disabled="!data" @click="go(data.period.prevStart)">
          ← Previous
        </button>
        <button class="btn-outline-sm" @click="go(null)">
          Today
        </button>
        <button class="btn-outline-sm" :disabled="!data" @click="go(data.period.nextStart)">
          Next →
        </button>
      </div>
      <div>
        <label class="label-sm">Department</label>
        <select v-model="department" class="input-field">
          <option value="">
            All departments
          </option>
          <option v-for="d in departments" :key="d" :value="d">
            {{ d }}
          </option>
        </select>
      </div>
      <div class="ml-auto flex gap-2">
        <button
          v-if="view !== 'month'"
          class="btn-outline-sm"
          :disabled="!data || saving"
          :title="`Copy the previous ${view === 'week' ? 'week' : 'two weeks'} of shifts into this period`"
          @click="copying = true; copyResult = null; formError = null"
        >
          Copy previous {{ view === 'week' ? 'week' : '2 weeks' }}
        </button>
        <button class="btn-outline-sm" :disabled="!data" @click="printLandscape">
          🖨 Print
        </button>
        <button
          class="btn-outline-sm"
          :disabled="!data || saving"
          title="Email each employee their own shifts for this period"
          @click="emailing = true; emailResult = null; formError = null"
        >
          ✉ Email schedule
        </button>
        <button class="btn-amber px-4 py-2 text-sm" :disabled="!data" @click="openCreate({ employeeId: null, date: defaultDate })">
          + Add Shift
        </button>
      </div>
    </div>

    <!-- Period heading (also the printed title) -->
    <div v-if="data" class="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
      <h2 class="font-display font-bold text-bark text-xl">
        <span class="hidden print:inline">Deer Run Schedule · </span>{{ periodLabel }}
      </h2>
      <span v-if="department" class="text-sm text-gray-500 font-body">{{ department }}</span>
      <span v-if="warningCount" class="text-sm text-red-600 font-body print:hidden">
        ⚠ {{ warningCount }} shift{{ warningCount === 1 ? '' : 's' }} with warnings
      </span>
      <span class="hidden print:inline text-xs text-gray-500 font-body ml-auto">Printed {{ printedAt }}</span>
    </div>

    <div v-if="loading && !data" class="text-gray-400 text-sm">
      Loading…
    </div>
    <div v-else-if="error" class="text-red-500 text-sm">
      {{ error }}
    </div>

    <template v-else-if="data">
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
        editable
        @add="openCreate"
        @edit="openEdit"
      />
      <p class="text-gray-400 text-xs font-body mt-3 print:hidden">
        Click an empty spot to add a shift, or a shift to edit it. An end time earlier than the start runs past midnight.
        Dashed boxes are time off (amber = request still pending).
      </p>
    </template>

    <!-- Add / edit shift -->
    <div v-if="form" class="modal-overlay print:hidden" @click.self="form = null">
      <div class="modal-box max-w-md">
        <h2 class="font-display font-bold text-bark mb-4">
          {{ form.id ? 'Edit Shift' : 'Add Shift' }}
        </h2>
        <div class="space-y-3">
          <div>
            <label class="label-sm">Employee *</label>
            <select v-model="form.employeeId" class="input-field w-full">
              <option :value="null" disabled>
                Select an employee
              </option>
              <option v-for="e in formEmployees" :key="e.id" :value="e.id">
                {{ e.lastName }}, {{ e.firstName }} — {{ positionLabel(e.position) }}{{ e.active ? '' : ' (inactive)' }}
              </option>
            </select>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="label-sm">Date *</label>
              <input v-model="form.date" type="date" class="input-field w-full">
            </div>
            <div>
              <label class="label-sm">Start *</label>
              <input v-model="form.startTime" type="time" step="900" class="input-field w-full">
            </div>
            <div>
              <label class="label-sm">End *</label>
              <input v-model="form.endTime" type="time" step="900" class="input-field w-full">
            </div>
          </div>
          <p v-if="formHours" class="text-xs text-gray-500 font-body -mt-1">
            {{ formHours }}
          </p>
          <div>
            <label class="label-sm">Working as</label>
            <select v-model="form.position" class="input-field w-full">
              <option value="">
                Their usual position{{ formEmployee ? ` (${positionLabel(formEmployee.position)})` : '' }}
              </option>
              <optgroup v-for="dept in departments" :key="dept" :label="dept">
                <option v-for="p in positionsIn(dept)" :key="p.value" :value="p.value">
                  {{ p.label }}
                </option>
              </optgroup>
            </select>
          </div>
          <div>
            <label class="label-sm">Notes</label>
            <input v-model="form.notes" type="text" maxlength="500" class="input-field w-full" placeholder="e.g. Opening, beverage cart">
          </div>
          <ul v-if="formWarnings.length" class="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-body space-y-0.5">
            <li v-for="w in formWarnings" :key="w">
              ⚠ {{ w }}
            </li>
          </ul>
        </div>
        <div class="flex items-center gap-3 mt-5">
          <button
            v-if="form.id"
            class="text-sm text-red-500 hover:text-red-700 font-body"
            :disabled="saving"
            @click="deleteShift"
          >
            Delete
          </button>
          <button class="btn-outline-sm ml-auto" @click="form = null">
            Cancel
          </button>
          <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="saving" @click="saveShift">
            {{ saving ? 'Saving…' : form.id ? 'Save' : 'Add Shift' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">
          {{ formError }}
        </p>
      </div>
    </div>

    <!-- Copy previous period -->
    <div v-if="copying" class="modal-overlay print:hidden" @click.self="copying = false">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">
          Copy previous {{ view === 'week' ? 'week' : 'two weeks' }}?
        </h2>
        <template v-if="!copyResult">
          <p class="text-gray-500 text-sm font-body mb-5">
            Shifts from {{ formatRange(copySource.from, copySource.to) }} will be added to
            {{ formatRange(data.period.start, data.period.end) }} on the same days. Shifts already in this period stay,
            exact duplicates are skipped, and inactive employees aren't copied.
          </p>
          <div class="flex justify-end gap-3">
            <button class="btn-outline-sm" @click="copying = false">
              Cancel
            </button>
            <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="saving" @click="copyPrevious">
              {{ saving ? 'Copying…' : 'Copy Shifts' }}
            </button>
          </div>
        </template>
        <template v-else>
          <p class="text-bark text-sm font-body mb-1">
            Copied {{ copyResult.created }} shift{{ copyResult.created === 1 ? '' : 's' }}.
          </p>
          <p v-if="copyResult.skippedExisting || copyResult.skippedInactive" class="text-gray-500 text-xs font-body mb-4">
            Skipped {{ copyResult.skippedExisting }} already scheduled and {{ copyResult.skippedInactive }} for inactive employees.
          </p>
          <div class="flex justify-end">
            <button class="btn-amber px-4 py-2 text-sm" @click="copying = false">
              Done
            </button>
          </div>
        </template>
        <p v-if="formError" class="text-red-500 text-xs mt-2">
          {{ formError }}
        </p>
      </div>
    </div>

    <!-- Email the schedule -->
    <div v-if="emailing" class="modal-overlay print:hidden" @click.self="!saving && (emailing = false)">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">
          Email the schedule?
        </h2>
        <template v-if="!emailResult">
          <p class="text-gray-500 text-sm font-body mb-5">
            <template v-if="emailRecipients">
              Each of the {{ emailRecipients }} active employee{{ emailRecipients === 1 ? '' : 's' }} with shifts during
              {{ formatRange(data.period.start, data.period.end) }} will get an email with their own shifts and approved
              time off for that period (all departments). Employees without an email address are skipped.
            </template>
            <template v-else>
              No active employees have shifts during {{ formatRange(data.period.start, data.period.end) }}.
            </template>
          </p>
          <div class="flex justify-end gap-3">
            <button class="btn-outline-sm" :disabled="saving" @click="emailing = false">
              Cancel
            </button>
            <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="saving || !emailRecipients" @click="emailSchedule">
              {{ saving ? 'Sending…' : 'Send Emails' }}
            </button>
          </div>
        </template>
        <template v-else>
          <p class="text-bark text-sm font-body mb-1">
            Sent {{ emailResult.sent }} email{{ emailResult.sent === 1 ? '' : 's' }}.
          </p>
          <p v-if="emailResult.skippedNoEmail || emailResult.skippedInactive" class="text-gray-500 text-xs font-body mb-1">
            Skipped {{ emailResult.skippedNoEmail }} without an email address and {{ emailResult.skippedInactive }} inactive.
          </p>
          <div v-if="emailResult.failed.length" class="text-red-600 text-xs font-body mb-1">
            Failed for {{ emailResult.failed.length }}:
            <ul class="list-disc ml-4">
              <li v-for="f in emailResult.failed" :key="f.employeeId">
                {{ f.name }}: {{ f.error }}
              </li>
            </ul>
          </div>
          <div class="flex justify-end mt-4">
            <button class="btn-amber px-4 py-2 text-sm" @click="emailing = false">
              Done
            </button>
          </div>
        </template>
        <p v-if="formError" class="text-red-500 text-xs mt-2">
          {{ formError }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { printLandscape } from '@/lib/print'
import { localDate, addDays, formatLocalDate, isValidYmd, isValidHhmm } from '@/lib/timeclock'
import { SCHEDULE_VIEWS, scheduleWarnings, datesBetween, shiftMinutes } from '@/lib/schedule'
import { employeePositions, departments, positionLabel } from '@/data/employeePositions'
import { departmentOf } from '@/components/schedule/scheduleDisplay'
import ScheduleGrid from '@/components/schedule/ScheduleGrid.vue'
import ScheduleMonth from '@/components/schedule/ScheduleMonth.vue'

const route  = useRoute()
const router = useRouter()

const data       = ref(null)
const loading    = ref(false)
const error      = ref(null)
const saving     = ref(false)
const formError  = ref(null)
const form       = ref(null)
const copying    = ref(false)
const copyResult = ref(null)
const emailing    = ref(false)
const emailResult = ref(null)
const department = ref('')
const printedAt  = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' })

const view = computed(() => (SCHEDULE_VIEWS[route.query.view] ? route.query.view : 'week'))
const date = computed(() => (isValidYmd(route.query.date) ? route.query.date : null))

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

const warningCount = computed(() => {
  const shown = new Set(visibleEmployees.value.map(e => e.id))
  const inView = new Set(dates.value)
  return (data.value?.shifts ?? []).filter(s => warnings.value[s.id] && shown.has(s.employeeId) && inView.has(s.date)).length
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

const formHours = computed(() => {
  const f = form.value
  if (!f || !isValidHhmm(f.startTime) || !isValidHhmm(f.endTime) || f.startTime === f.endTime) return ''
  const minutes = shiftMinutes(f)
  const h = (minutes / 60).toFixed(2).replace(/\.?0+$/, '')
  return `${h} hours${f.endTime < f.startTime ? ' (ends the next day)' : ''}`
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
    position: '',
    notes: '',
  }
  formError.value = null
}

function openEdit(shift) {
  form.value = { ...shift, position: shift.position ?? '', notes: shift.notes ?? '' }
  formError.value = null
}

async function saveShift() {
  const f = form.value
  if (!f.employeeId) { formError.value = 'Choose an employee'; return }
  saving.value    = true
  formError.value = null
  try {
    const body = {
      employeeId: f.employeeId, date: f.date, startTime: f.startTime, endTime: f.endTime,
      position: f.position || null, notes: f.notes || null,
    }
    const saved = await apiFetch(f.id ? `/api/admin/shifts/${f.id}` : '/api/admin/shifts', {
      method: f.id ? 'PUT' : 'POST',
      body,
    })
    const shifts = data.value.shifts.filter(s => s.id !== saved.id)
    data.value.shifts = [...shifts, saved].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    form.value = null
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function deleteShift() {
  const who = formEmployee.value ? `${formEmployee.value.firstName} ${formEmployee.value.lastName}'s` : 'this'
  const day = formatLocalDate(form.value.date, { weekday: 'short', month: 'short', day: 'numeric' })
  if (!window.confirm(`Delete ${who} shift on ${day} (${form.value.startTime}–${form.value.endTime})? This can't be undone.`)) return
  saving.value    = true
  formError.value = null
  try {
    await apiFetch(`/api/admin/shifts/${form.value.id}`, { method: 'DELETE' })
    data.value.shifts = data.value.shifts.filter(s => s.id !== form.value.id)
    form.value = null
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// Active employees with shifts in the period itself (a month's padding days aren't emailed)
const emailRecipients = computed(() => {
  if (!data.value) return 0
  const { start, end } = data.value.period
  const active = new Set(data.value.employees.filter(e => e.active).map(e => e.id))
  return new Set(data.value.shifts.filter(s => s.date >= start && s.date <= end && active.has(s.employeeId)).map(s => s.employeeId)).size
})

async function emailSchedule() {
  saving.value    = true
  formError.value = null
  try {
    const { start, end } = data.value.period
    emailResult.value = await apiFetch('/api/admin/shifts/email', { method: 'POST', body: { from: start, to: end } })
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
    copyResult.value = await apiFetch('/api/admin/shifts/copy', {
      method: 'POST',
      body: { from, to: data.value.period.start, days },
    })
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent; }
</style>
