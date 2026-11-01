<template>
  <div>
    <!-- Toolbar -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3">
      <button class="btn-outline-sm" :disabled="!sheet" @click="load(sheet.period.prevStart)">← Previous</button>
      <button class="btn-outline-sm" :disabled="!sheet || isCurrent" @click="load(null)">Current Period</button>
      <button class="btn-outline-sm" :disabled="!sheet || isCurrent" @click="load(sheet.period.nextStart)">Next →</button>
      <div v-if="sheet" class="font-display font-bold text-bark">{{ periodLabel }}</div>
      <div class="ml-auto flex flex-wrap gap-2">
        <button class="btn-outline-sm" :disabled="!sheet || downloading" @click="downloadCsv('summary')">Export Summary CSV</button>
        <button class="btn-outline-sm" :disabled="!sheet || downloading" @click="downloadCsv('entries')">Export Entries CSV</button>
        <button class="btn-amber px-4 py-2 text-sm" :disabled="!sheet" @click="openCreate(null)">+ Add Entry</button>
      </div>
    </div>
    <p v-if="downloadError" class="text-red-500 text-sm mb-4">{{ downloadError }}</p>

    <div v-if="loading && !sheet" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <template v-else-if="sheet">
      <!-- Totals -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="stat-card">
          <div class="stat-label">Total Hours</div>
          <div class="stat-value">{{ formatHours(sheet.totals.workedMinutes) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Overtime</div>
          <div class="stat-value" :class="sheet.totals.overtime > 0 ? 'text-clay' : ''">{{ formatHours(sheet.totals.overtime) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">On the Clock</div>
          <div class="stat-value">{{ sheet.totals.openEntries }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Missed Clock-Outs</div>
          <div class="stat-value" :class="sheet.totals.longOpenEntries > 0 ? 'text-red-600' : ''">{{ sheet.totals.longOpenEntries }}</div>
          <div class="text-gray-400 text-xs mt-1">open 14+ hours</div>
        </div>
      </div>

      <!-- Employees -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm font-body">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100 text-left">
                <th class="th">Employee</th>
                <th class="th">Position</th>
                <th class="th text-right">Regular</th>
                <th class="th text-right">Overtime</th>
                <th class="th text-right">Total</th>
                <th class="th" />
                <th class="th" />
              </tr>
            </thead>
            <tbody>
              <template v-for="emp in sheet.employees" :key="emp.id">
                <tr class="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" @click="toggle(emp.id)">
                  <td class="td text-bark font-semibold whitespace-nowrap">
                    {{ emp.lastName }}, {{ emp.firstName }}
                    <span v-if="!emp.active" class="ml-1 text-xs font-normal text-gray-400">(inactive)</span>
                  </td>
                  <td class="td text-gray-600">{{ positionLabel(emp.position) }}</td>
                  <td class="td text-right tabular-nums">{{ formatHours(emp.regular) }}</td>
                  <td class="td text-right tabular-nums" :class="emp.overtime > 0 ? 'text-clay font-semibold' : 'text-gray-400'">
                    {{ formatHours(emp.overtime) }}
                  </td>
                  <td class="td text-right tabular-nums text-bark font-semibold">{{ formatHours(emp.workedMinutes) }}</td>
                  <td class="td whitespace-nowrap">
                    <span v-if="emp.longOpenEntries" class="badge bg-red-100 text-red-700">Missed clock-out</span>
                    <span v-else-if="emp.openEntries" class="badge bg-pine/15 text-pine">On the clock</span>
                  </td>
                  <td class="td text-gray-400 text-right">{{ expanded[emp.id] ? '▾' : '▸' }}</td>
                </tr>

                <!-- Detail -->
                <tr v-if="expanded[emp.id]" class="bg-gray-50/60 border-b border-gray-100">
                  <td colspan="7" class="px-5 py-4">
                    <div v-for="week in weeksFor(emp)" :key="week.weekStart" class="mb-4 last:mb-0">
                      <div class="flex items-center justify-between text-xs text-gray-500 uppercase tracking-wider mb-1">
                        <span>Week of {{ formatLocalDate(week.weekStart, { month: 'short', day: 'numeric' }) }}</span>
                        <span>
                          {{ formatHours(week.workedMinutes) }} h
                          <span v-if="week.overtime > 0" class="text-clay normal-case">· {{ formatHours(week.overtime) }} h overtime</span>
                        </span>
                      </div>
                      <div class="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
                        <div v-for="entry in week.entries" :key="entry.id" class="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <div class="w-28 text-bark font-semibold">{{ formatLocalDate(entry.date) }}</div>
                          <div class="flex-1 min-w-[12rem]">
                            <span class="text-bark">
                              {{ formatClockTime(entry.clockIn) }} – {{ entry.clockOut ? formatClockTime(entry.clockOut) : 'still on the clock' }}
                            </span>
                            <span v-if="entry.breakMinutes" class="text-gray-400 text-xs ml-2">
                              {{ formatMinutes(entry.breakMinutes) }} break
                            </span>
                            <span v-if="entry.longOpen" class="badge bg-red-100 text-red-700 ml-2">Open 14+ h</span>
                            <span v-if="entry.editedAt" class="badge bg-gray-100 text-gray-500 ml-2" title="Corrected by a manager">Edited</span>
                            <div v-if="entry.note" class="text-gray-400 text-xs mt-0.5">{{ entry.note }}</div>
                          </div>
                          <div class="w-20 text-right tabular-nums text-bark">{{ formatMinutes(entry.workedMinutes) }}</div>
                          <div class="space-x-3 text-xs">
                            <button class="text-lake hover:text-pine" @click="openEdit(emp, entry)">Edit</button>
                            <button class="text-red-400 hover:text-red-600" @click="confirmDelete(emp, entry)">Delete</button>
                          </div>
                        </div>
                        <div v-if="!week.entries.length" class="px-4 py-3 text-gray-400 text-xs">No time recorded.</div>
                      </div>
                    </div>
                    <button class="text-xs text-lake hover:text-pine font-body" @click="openCreate(emp)">
                      + Add entry for {{ emp.firstName }}
                    </button>
                  </td>
                </tr>
              </template>
              <tr v-if="!sheet.employees.length">
                <td colspan="7" class="px-5 py-8 text-center text-gray-400">
                  No employees yet. Add them on the Employees page.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="text-gray-400 text-xs font-body mt-3">
        Hours count toward the day the employee clocked in. Overtime is time over 40 hours in a workweek.
        Estimated gross pay is in the summary CSV (overtime at 1.5×).
      </p>
    </template>

    <!-- Add / edit entry -->
    <div v-if="form" class="modal-overlay" @click.self="form = null">
      <div class="modal-box max-w-lg overflow-y-auto max-h-[90vh]">
        <h2 class="font-display font-bold text-bark mb-4">{{ form.id ? 'Edit Time Entry' : 'Add Time Entry' }}</h2>
        <div class="space-y-3">
          <div>
            <label class="label-sm">Employee</label>
            <select v-if="!form.id && !form.lockEmployee" v-model="form.employeeId" class="input-field w-full">
              <option value="" disabled>Select an employee</option>
              <option v-for="emp in sheet.employees" :key="emp.id" :value="emp.id">
                {{ emp.lastName }}, {{ emp.firstName }}
              </option>
            </select>
            <div v-else class="text-bark font-body text-sm py-2">{{ form.employeeName }}</div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="label-sm">Date</label>
              <input v-model="form.date" type="date" class="input-field w-full" />
            </div>
            <div>
              <label class="label-sm">Clock In</label>
              <input v-model="form.clockIn" type="time" class="input-field w-full" />
            </div>
            <div>
              <label class="label-sm">
                Clock Out
                <span v-if="nextDay(form.clockOut)" class="text-gold">(next day)</span>
              </label>
              <input v-model="form.clockOut" type="time" class="input-field w-full" />
            </div>
          </div>
          <p class="text-gray-400 text-xs font-body">
            Leave Clock Out empty if the employee is still on the clock. A time earlier than Clock In counts as the next day.
          </p>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="label-sm mb-0">Breaks</label>
              <button class="text-xs text-lake hover:text-pine font-body" @click="form.breaks.push({ start: '', end: '' })">+ Add break</button>
            </div>
            <div v-for="(b, i) in form.breaks" :key="i" class="flex items-center gap-2 mb-2">
              <input v-model="b.start" type="time" class="input-field flex-1" />
              <span class="text-gray-400 text-sm">to</span>
              <input v-model="b.end" type="time" class="input-field flex-1" />
              <button class="text-red-400 hover:text-red-600 text-xs px-2" aria-label="Remove break" @click="form.breaks.splice(i, 1)">✕</button>
            </div>
            <p v-if="!form.breaks.length" class="text-gray-400 text-xs font-body">No breaks.</p>
          </div>

          <div>
            <label class="label-sm">Note</label>
            <input v-model="form.note" type="text" class="input-field w-full" placeholder="e.g. Forgot to clock out — confirmed with employee" />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="form = null">Cancel</button>
          <button :disabled="saving" class="btn-amber px-4 py-2 text-sm disabled:opacity-50" @click="saveEntry">
            {{ saving ? 'Saving…' : (form.id ? 'Save Changes' : 'Add Entry') }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">Delete Time Entry?</h2>
        <p class="text-gray-500 text-sm font-body mb-5">
          {{ deleting.employeeName }} · {{ formatLocalDate(deleting.entry.date) }},
          {{ formatClockTime(deleting.entry.clockIn) }} –
          {{ deleting.entry.clockOut ? formatClockTime(deleting.entry.clockOut) : 'still on the clock' }}.
          This removes the entry and its breaks permanently.
        </p>
        <div class="flex justify-end gap-3">
          <button class="btn-outline-sm" @click="deleting = null">Cancel</button>
          <button :disabled="saving" class="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg font-body transition-colors" @click="deleteEntry">
            {{ saving ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { positionLabel } from '@/data/employeePositions'
import {
  localDate, localTime, weekStart, formatMinutes, formatClockTime, formatLocalDate,
} from '@/lib/timeclock'

const authStore = useAuthStore()
const sheet     = ref(null)
const loading   = ref(false)
const error     = ref(null)
const expanded  = ref({})
const form      = ref(null)
const deleting  = ref(null)
const saving    = ref(false)
const formError = ref(null)
const downloading   = ref(false)
const downloadError = ref(null)

const isCurrent = computed(() => {
  if (!sheet.value) return true
  const today = localDate()
  return sheet.value.period.start <= today && today <= sheet.value.period.end
})

const periodLabel = computed(() => {
  const { start, end } = sheet.value.period
  return `${formatLocalDate(start, { month: 'short', day: 'numeric' })} – ${formatLocalDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`
})

function formatHours(minutes) {
  return (minutes / 60).toFixed(2)
}

function weeksFor(emp) {
  const wsd = sheet.value.period.weekStartDay
  return emp.weeks.map(w => ({
    ...w,
    entries: emp.days.filter(d => weekStart(d.date, wsd) === w.weekStart).flatMap(d => d.entries),
  }))
}

function toggle(id) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] }
}

function authHeaders(extra = {}) {
  return { ...extra, Authorization: `Bearer ${authStore.getToken()}` }
}

async function load(date = sheet.value?.period.start ?? null) {
  loading.value = true
  error.value   = null
  try {
    const params = date ? `?${new URLSearchParams({ date })}` : ''
    const res = await fetch(`/api/admin/timesheets${params}`, { headers: authHeaders() })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    sheet.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function downloadCsv(detail) {
  downloading.value   = true
  downloadError.value = null
  try {
    const params = new URLSearchParams({ date: sheet.value.period.start, format: 'csv', detail })
    const res = await fetch(`/api/admin/timesheets?${params}`, { headers: authHeaders() })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'timesheet.csv'
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    downloadError.value = e.message
  } finally {
    downloading.value = false
  }
}

// ─── Add / edit ─────────────────────────────────────────────────────────────

function nextDay(clockOut) {
  return form.value?.clockIn && clockOut && clockOut <= form.value.clockIn
}

function openCreate(emp) {
  const today = localDate()
  const { start, end } = sheet.value.period
  form.value = {
    id: null,
    employeeId: emp?.id ?? '',
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : '',
    lockEmployee: !!emp,
    date: today >= start && today <= end ? today : start,
    clockIn: '',
    clockOut: '',
    breaks: [],
    note: '',
  }
  formError.value = null
}

function openEdit(emp, entry) {
  form.value = {
    id: entry.id,
    employeeId: emp.id,
    employeeName: `${emp.firstName} ${emp.lastName}`,
    lockEmployee: true,
    date: entry.date,
    clockIn: localTime(entry.clockIn),
    clockOut: entry.clockOut ? localTime(entry.clockOut) : '',
    breaks: entry.breaks.map(b => ({ start: localTime(b.startedAt), end: b.endedAt ? localTime(b.endedAt) : '' })),
    note: entry.note ?? '',
  }
  formError.value = null
}

async function saveEntry() {
  const f = form.value
  if (!f.employeeId) {
    formError.value = 'Select an employee'
    return
  }
  saving.value    = true
  formError.value = null
  try {
    const body = {
      employeeId: f.employeeId,
      date: f.date,
      clockIn: f.clockIn,
      clockOut: f.clockOut || null,
      breaks: f.breaks.map(b => ({ start: b.start, end: b.end || null })),
      note: f.note,
    }
    const res = await fetch(f.id ? `/api/admin/time-entries/${f.id}` : '/api/admin/time-entries', {
      method: f.id ? 'PUT' : 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    expanded.value = { ...expanded.value, [f.employeeId]: true }
    form.value = null
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ─── Delete ─────────────────────────────────────────────────────────────────

function confirmDelete(emp, entry) {
  deleting.value  = { entry, employeeName: `${emp.firstName} ${emp.lastName}` }
  formError.value = null
}

async function deleteEntry() {
  saving.value    = true
  formError.value = null
  try {
    const res = await fetch(`/api/admin/time-entries/${deleting.value.entry.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
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

onMounted(() => load(null))
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.th             { @apply px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold; }
.td             { @apply px-5 py-3; }
.badge          { @apply text-xs px-2 py-0.5 rounded-full font-body; }
.stat-card      { @apply bg-white rounded-xl border border-gray-200 p-5; }
.stat-label     { @apply text-gray-400 text-xs font-body uppercase tracking-wider mb-1; }
.stat-value     { @apply text-3xl font-display font-bold text-bark tabular-nums; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent; }
</style>
