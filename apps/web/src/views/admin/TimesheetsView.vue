<template>
  <div>
    <Teleport to="#admin-page-actions" defer>
      <AppButton :icon="IconMoreTime" :disabled="!sheet" class="hidden sm:inline-flex" @click="openCreate(null)">Add entry</AppButton>
      <IconButton :icon="IconMoreTime" variant="filled" label="Add entry" :disabled="!sheet" class="sm:hidden" @click="openCreate(null)" />
    </Teleport>

    <!-- Toolbar: pay period stepper + exports -->
    <div class="mb-6 flex flex-wrap items-center gap-x-2 gap-y-3">
      <DateStepper
        v-if="sheet"
        :model-value="sheet.period.start"
        :step="sheet.period.lengthDays || 14"
        :format-title="periodTitle"
        :max="currentStart || undefined"
        :disabled="loading"
        @update:model-value="load"
      />
      <Skeleton v-else-if="loading" width="16rem" height="48px" />
      <AppButton v-if="sheet && !isCurrent" variant="text" :disabled="loading" class="print:hidden" @click="load(null)">
        Current period
      </AppButton>
      <div class="flex flex-wrap gap-2 sm:ml-auto print:hidden">
        <AppButton variant="outlined" :icon="IconDownload" :disabled="!sheet || downloading" @click="downloadCsv('summary')">
          Summary CSV
        </AppButton>
        <AppButton variant="outlined" :icon="IconDownload" :disabled="!sheet || downloading" @click="downloadCsv('entries')">
          Entries CSV
        </AppButton>
      </div>
    </div>
    <ErrorBanner v-if="downloadError" class="mb-4" :message="downloadError" @dismiss="downloadError = null" />

    <ErrorBanner v-if="error && !sheet" :message="error" @retry="load()" />

    <template v-else>
      <ErrorBanner v-if="error" class="mb-4" :message="error" @retry="load()" />

      <!-- Totals -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total hours" :value="sheet ? formatHours(sheet.totals.workedMinutes) : ''" :icon="IconClock" :loading="!sheet" />
        <StatCard label="Overtime" :icon="IconTimer" :loading="!sheet">
          <template #value>
            <span :class="sheet?.totals.overtime > 0 ? 'text-tertiary' : ''">{{ sheet ? formatHours(sheet.totals.overtime) : '' }}</span>
          </template>
        </StatCard>
        <StatCard label="On the clock" :value="sheet ? String(sheet.totals.openEntries) : ''" :icon="IconPerson" :loading="!sheet" />
        <StatCard label="Missed clock-outs" :icon="IconWarning" :loading="!sheet">
          <template #value>
            <span :class="sheet?.totals.longOpenEntries > 0 ? 'text-error' : ''">{{ sheet?.totals.longOpenEntries ?? '' }}</span>
          </template>
          <p class="text-body-s text-on-surface-variant">Open 14+ hours</p>
        </StatCard>
      </div>

      <ErrorBanner v-if="actionError" class="mb-4" :message="actionError" @dismiss="actionError = null" />

      <!-- Employees: a row opens that employee's entries below the table -->
      <DataTable
        :columns="columns"
        :rows="sheet?.employees ?? []"
        :loading="!sheet"
        caption="Hours per employee"
        :row-label="emp => `${selectedId === emp.id ? 'Hide' : 'Show'} time entries for ${emp.firstName} ${emp.lastName}`"
        @row-click="toggle"
      >
        <template #cell-name="{ row }">
          {{ row.lastName }}, {{ row.firstName }}
          <span v-if="!row.active" class="ml-1 text-body-s font-normal text-on-surface-variant">(inactive)</span>
        </template>
        <template #cell-overtime="{ row }">
          <span :class="row.overtime > 0 ? 'text-tertiary font-bold' : 'text-on-surface-variant'">{{ formatHours(row.overtime) }}</span>
        </template>
        <template #cell-workedMinutes="{ row }">
          <span class="font-bold">{{ formatHours(row.workedMinutes) }}</span>
        </template>
        <template #cell-state="{ row }">
          <span class="inline-flex items-center gap-2">
            <StatusChip v-if="row.longOpenEntries" label="Missed clock-out" tone="error" icon="warning" size="sm" />
            <StatusChip v-else-if="row.openEntries" label="On the clock" tone="primary" icon="pending" size="sm" />
            <span v-else class="text-on-surface-variant">—</span>
            <component
              :is="selectedId === row.id ? IconExpandLess : IconExpandMore"
              class="hidden md:block w-6 h-6 ml-auto text-on-surface-variant print:hidden"
              aria-hidden="true"
            />
          </span>
        </template>
        <template #empty>
          <EmptyState compact :icon="IconBadge" title="No employees yet" message="Add them on the Employees page." action-label="Go to Employees" to="/admin/employees" />
        </template>
      </DataTable>
      <p class="mt-3 text-body-m text-on-surface-variant">
        Hours count toward the day the employee clocked in. Overtime is time over 40 hours in a workweek.
        Estimated gross pay is in the summary CSV (overtime at 1.5×).
      </p>

      <!-- Detail -->
      <Card
        v-if="selected"
        ref="detailEl"
        variant="outlined"
        padding="lg"
        tag="section"
        class="mt-6 scroll-mt-24 break-inside-avoid-page"
        aria-labelledby="timesheet-detail-heading"
      >
        <div class="flex items-start gap-2">
          <div class="flex-1 min-w-0">
            <h2 id="timesheet-detail-heading" tabindex="-1" class="font-display text-headline-s text-on-surface focus:outline-none">
              {{ selected.firstName }} {{ selected.lastName }}
            </h2>
            <p class="mt-1 text-body-m text-on-surface-variant">
              {{ positionLabel(selected.position) }} · {{ formatHours(selected.workedMinutes) }} h
              <template v-if="selected.overtime > 0">· {{ formatHours(selected.overtime) }} h overtime</template>
            </p>
          </div>
          <IconButton :icon="IconClose" label="Close time entries" class="-mr-2 -mt-2 print:hidden" @click="selectedId = null" />
        </div>

        <div v-for="week in weeksFor(selected)" :key="week.weekStart" class="mt-6">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 mb-2">
            <h3 class="text-title-s text-on-surface">Week of {{ formatLocalDate(week.weekStart, { month: 'short', day: 'numeric' }) }}</h3>
            <p class="text-body-m text-on-surface-variant tabular-nums">
              {{ formatHours(week.workedMinutes) }} h
              <span v-if="week.overtime > 0" class="text-tertiary">· {{ formatHours(week.overtime) }} h overtime</span>
            </p>
          </div>
          <ul class="rounded-shape-md border border-outline-variant divide-y divide-outline-variant">
            <li v-for="entry in week.entries" :key="entry.id" class="flex items-start gap-3 pl-4 pr-1 py-2">
              <div class="flex-1 min-w-0 py-1.5 sm:flex sm:items-start sm:gap-4">
                <p class="sm:w-32 flex-none text-title-s text-on-surface">{{ formatLocalDate(entry.date) }}</p>
                <div class="flex-1 min-w-0">
                  <p class="text-body-m text-on-surface">
                    {{ formatClockTime(entry.clockIn) }} – {{ entry.clockOut ? formatClockTime(entry.clockOut) : 'still on the clock' }}
                    <span v-if="entry.breakMinutes" class="text-on-surface-variant">· {{ formatMinutes(entry.breakMinutes) }} break</span>
                  </p>
                  <p v-if="entry.longOpen || entry.editedAt" class="mt-1 flex flex-wrap gap-1">
                    <StatusChip v-if="entry.longOpen" label="Open 14+ h" tone="error" icon="warning" size="sm" />
                    <span v-if="entry.editedAt" title="Corrected by a manager">
                      <StatusChip label="Edited" tone="neutral" icon="info" size="sm" />
                    </span>
                  </p>
                  <p v-if="entry.note" class="mt-1 text-body-s text-on-surface-variant">{{ entry.note }}</p>
                </div>
                <p class="mt-1 sm:mt-0 sm:w-20 sm:text-right text-body-m text-on-surface tabular-nums">
                  {{ formatMinutes(entry.workedMinutes) }}
                </p>
              </div>
              <RowActionsMenu
                class="print:hidden"
                :label="`Actions for ${formatLocalDate(entry.date)}, ${formatClockTime(entry.clockIn)}`"
                :items="[
                  { label: 'Edit', icon: IconEdit, onClick: () => openEdit(selected, entry) },
                  { label: 'Delete', icon: IconDelete, danger: true, onClick: () => deleteEntry(selected, entry) },
                ]"
              />
            </li>
            <li v-if="!week.entries.length" class="px-4 py-3 text-body-m text-on-surface-variant">No time recorded.</li>
          </ul>
        </div>

        <template #footer>
          <AppButton variant="tonal" :icon="IconAdd" class="print:hidden" @click="openCreate(selected)">
            Add entry for {{ selected.firstName }}
          </AppButton>
        </template>
      </Card>
    </template>

    <!-- Add / edit entry -->
    <AppDialog
      :open="!!form"
      :title="form?.id ? 'Edit time entry' : 'Add time entry'"
      size="lg"
      persistent
      fullscreen-on-mobile
      :confirm-label="form?.id ? 'Save' : 'Add'"
      :confirm-loading="saving"
      @update:open="v => { if (!v) form = null }"
      @confirm="submitEntry"
    >
      <form v-if="form" id="time-entry-form" ref="entryFormEl" class="space-y-4 pt-2 pb-2" @submit.prevent="submitEntry">
        <SelectField
          v-if="!form.id && !form.lockEmployee"
          v-model="form.employeeId"
          label="Employee"
          required
          placeholder="Select an employee"
          :options="(sheet?.employees ?? []).map(emp => ({ value: emp.id, label: `${emp.lastName}, ${emp.firstName}` }))"
        />
        <div v-else>
          <p class="text-body-s text-on-surface-variant">Employee</p>
          <p class="text-body-l text-on-surface">{{ form.employeeName }}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextField v-model="form.date" type="date" label="Date" float-label required />
          <TextField v-model="form.clockIn" type="time" label="Clock in" float-label required />
          <TextField
            v-model="form.clockOut"
            type="time"
            label="Clock out"
            float-label
            :helper="nextDay(form.clockOut) ? 'Next day' : ''"
          />
        </div>
        <p class="text-body-s text-on-surface-variant">
          Leave Clock out empty if the employee is still on the clock. A time earlier than Clock in counts as the next day.
        </p>

        <fieldset aria-labelledby="breaks-heading">
          <div class="flex items-center justify-between gap-2">
            <h3 id="breaks-heading" class="text-title-s text-on-surface">Breaks</h3>
            <AppButton variant="text" :icon="IconAdd" @click="form.breaks.push({ start: '', end: '' })">Add break</AppButton>
          </div>
          <div v-for="(b, i) in form.breaks" :key="i" class="mt-2 flex items-start gap-2">
            <TextField v-model="b.start" type="time" :label="`Break ${i + 1} start`" float-label class="flex-1 min-w-0" />
            <TextField v-model="b.end" type="time" label="End" float-label class="flex-1 min-w-0" />
            <IconButton :icon="IconDelete" :label="`Remove break ${i + 1}`" class="mt-1" @click="form.breaks.splice(i, 1)" />
          </div>
          <p v-if="!form.breaks.length" class="mt-1 text-body-m text-on-surface-variant">No breaks.</p>
        </fieldset>

        <TextField v-model="form.note" label="Note" placeholder="e.g. Forgot to clock out, confirmed with employee" />
        <ErrorBanner v-if="formError" :message="formError" />
      </form>
      <template #actions="{ close }">
        <AppButton variant="text" :disabled="saving" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="time-entry-form" :loading="saving">{{ form?.id ? 'Save changes' : 'Add entry' }}</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { apiDownload, apiFetch } from '@/lib/api'
import { positionLabel } from '@/data/employeePositions'
import {
  localDate, localTime, weekStart, addDays, formatMinutes, formatClockTime, formatLocalDate,
} from '@/lib/timeclock'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DateStepper from '@/components/ui/DateStepper.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField from '@/components/ui/SelectField.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IconMoreTime from '~icons/material-symbols/more-time-rounded'
import IconDownload from '~icons/material-symbols/download-rounded'
import IconClock from '~icons/material-symbols/schedule-rounded'
import IconTimer from '~icons/material-symbols/timer-rounded'
import IconPerson from '~icons/material-symbols/punch-clock-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconBadge from '~icons/material-symbols/badge-rounded'
import IconExpandMore from '~icons/material-symbols/expand-more-rounded'
import IconExpandLess from '~icons/material-symbols/expand-less-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'
import IconAdd from '~icons/material-symbols/add-rounded'

const confirm   = useConfirm()
const snackbar  = useSnackbar()

const sheet     = ref(null)
const loading   = ref(false)
const error     = ref(null)
const actionError = ref(null)
const selectedId  = ref(null)
const detailEl  = ref(null)
const form      = ref(null)
const saving    = ref(false)
const formError = ref(null)
const entryFormEl = ref(null)
const downloading   = ref(false)
const downloadError = ref(null)
// Start of the pay period containing today: the stepper can't go past it
const currentStart  = ref(null)

const columns = [
  { key: 'name', label: 'Employee', primary: true },
  { key: 'position', label: 'Position', format: v => positionLabel(v) },
  { key: 'regular', label: 'Regular (h)', align: 'right', class: 'tabular-nums', format: v => formatHours(v) },
  { key: 'overtime', label: 'Overtime (h)', align: 'right', class: 'tabular-nums' },
  { key: 'workedMinutes', label: 'Total (h)', align: 'right', class: 'tabular-nums' },
  { key: 'state', label: 'Status', class: 'whitespace-nowrap' },
]

const isCurrent = computed(() => {
  if (!sheet.value) return true
  const today = localDate()
  return sheet.value.period.start <= today && today <= sheet.value.period.end
})

const selected = computed(() => sheet.value?.employees.find(e => e.id === selectedId.value) ?? null)

/** "Oct 25 – Nov 7, 2026" for the period starting at `start` */
function periodTitle(start) {
  const p = sheet.value?.period
  const end = p && p.start === start ? p.end : addDays(start, (p?.lengthDays || 14) - 1)
  return `${formatLocalDate(start, { month: 'short', day: 'numeric' })} – ${formatLocalDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

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

async function toggle(emp) {
  selectedId.value = selectedId.value === emp.id ? null : emp.id
  if (!selectedId.value) return
  await nextTick()
  const el = detailEl.value?.$el
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el?.querySelector('#timesheet-detail-heading')?.focus({ preventScroll: true })
}

async function load(date = sheet.value?.period.start ?? null) {
  loading.value = true
  error.value   = null
  try {
    const params = date ? `?${new URLSearchParams({ date })}` : ''
    sheet.value = await apiFetch(`/api/admin/timesheets${params}`)
    const today = localDate()
    if (sheet.value.period.start <= today && today <= sheet.value.period.end) currentStart.value = sheet.value.period.start
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// CSV comes back as a file, not JSON, so it goes through apiDownload
async function downloadCsv(detail) {
  downloading.value   = true
  downloadError.value = null
  try {
    const params = new URLSearchParams({ date: sheet.value.period.start, format: 'csv', detail })
    await apiDownload(`/api/admin/timesheets?${params}`, 'timesheet.csv')
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
    employeeId: emp?.id ?? null,
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

function submitEntry() {
  if (entryFormEl.value && !entryFormEl.value.reportValidity()) return
  saveEntry()
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
    await apiFetch(f.id ? `/api/admin/time-entries/${f.id}` : '/api/admin/time-entries', {
      method: f.id ? 'PUT' : 'POST',
      body,
    })
    selectedId.value = f.employeeId
    form.value = null
    snackbar.show(f.id ? 'Time entry saved' : 'Time entry added')
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ─── Delete ─────────────────────────────────────────────────────────────────

async function deleteEntry(emp, entry) {
  actionError.value = null
  const ok = await confirm({
    title: 'Delete time entry?',
    message: `${emp.firstName} ${emp.lastName} · ${formatLocalDate(entry.date)}, ${formatClockTime(entry.clockIn)} – ${entry.clockOut ? formatClockTime(entry.clockOut) : 'still on the clock'}. This removes the entry and its breaks permanently.`,
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/time-entries/${entry.id}`, { method: 'DELETE' })
    snackbar.show('Time entry deleted')
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

onMounted(() => load(null))
</script>
