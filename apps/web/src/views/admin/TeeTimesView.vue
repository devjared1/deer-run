<template>
  <div class="space-y-6">
    <Teleport to="#admin-page-actions" defer>
      <AppButton :icon="IconCalendarAdd" @click="openGenerate">
        <span class="hidden sm:inline">Add tee times</span>
        <span class="sm:hidden">Add</span>
      </AppButton>
    </Teleport>

    <!-- Range + secondary actions (the list reloads whenever the range changes) -->
    <Card variant="outlined">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end">
        <DateRangeField
          v-model="range"
          label="Showing"
          :presets="['today', 'thisWeek', 'thisMonth']"
          class="flex-1 min-w-0"
        />
        <div class="flex flex-wrap gap-2">
          <AppButton variant="outlined" :icon="IconAdd" @click="openCreate">Single slot</AppButton>
          <AppButton variant="outlined" :icon="IconEventBusy" @click="openBulk">Close or restrict</AppButton>
        </div>
      </div>
    </Card>

    <ErrorBanner v-if="error" :message="error" @retry="load" />

    <div v-else-if="loading" class="space-y-6">
      <Skeleton variant="text" :lines="1" width="240px" label="Loading tee times" />
      <DataTable :columns="columns" :rows="[]" loading :loading-rows="6" dense caption="Loading tee times" />
    </div>

    <Card v-else-if="!days.length" variant="outlined">
      <EmptyState
        :icon="IconSchedule"
        title="No tee times in this range"
        message="Generate a block of tee times for these dates, or pick other dates."
        action-label="Add tee times"
        :action-icon="IconCalendarAdd"
        @action="openGenerate"
      />
    </Card>

    <template v-else>
      <p class="text-body-m text-on-surface-variant">
        {{ slots.length.toLocaleString('en-US') }} tee time{{ slots.length === 1 ? '' : 's' }} on {{ days.length }}
        day{{ days.length === 1 ? '' : 's' }} · {{ totalBooked.toLocaleString('en-US') }} player{{ totalBooked === 1 ? '' : 's' }} booked
      </p>

      <section v-for="day in days" :key="day.date" class="space-y-2" :aria-labelledby="`day-${day.date}`">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 :id="`day-${day.date}`" class="text-title-l text-on-surface">
            {{ formatLocalDate(day.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }}
            <span v-if="day.date === today" class="ml-1 text-title-s text-on-surface-variant">(today)</span>
          </h2>
          <p class="text-body-m text-on-surface-variant">
            {{ day.slots.length }} slot{{ day.slots.length === 1 ? '' : 's' }} · {{ day.booked }} booked · {{ day.full }} full
          </p>
        </div>
        <DataTable
          :columns="columns"
          :rows="day.slots"
          dense
          :caption="`Tee times on ${formatLocalDate(day.date)}`"
          :row-label="slot => `${teeTime(slot.startTime)}, ${slot.bookedPlayers} of ${slot.maxPlayers} booked`"
        >
          <template #cell-startTime="{ row }">{{ teeTime(row.startTime) }}</template>
          <template #cell-players="{ row }">
            <span class="tabular-nums">{{ row.bookedPlayers }} / {{ row.maxPlayers }}</span>
          </template>
          <template #cell-status="{ row }">
            <span class="inline-flex flex-wrap gap-1">
              <StatusChip v-if="row.available === 0" size="sm" label="Full" tone="warning" icon="block" />
              <StatusChip v-else-if="row.bookedPlayers" size="sm" :label="`${row.available} open`" tone="success" icon="check" />
              <StatusChip v-else size="sm" label="Open" tone="neutral" :icon="false" />
              <StatusChip v-if="row.memberOnly" size="sm" label="Members only" tone="primary" icon="member" />
            </span>
          </template>
          <template #actions="{ row }">
            <RowActionsMenu
              size="sm"
              :label="`Actions for ${teeTime(row.startTime)}`"
              :items="[
                { label: 'Edit', icon: IconEdit, onClick: () => startEdit(row) },
                { label: 'Delete', icon: IconDelete, danger: true, disabled: row.bookedPlayers > 0, onClick: () => deleteSlot(row) },
              ]"
            />
          </template>
        </DataTable>
      </section>
    </template>

    <!-- Single slot -->
    <AppDialog v-model:open="createOpen" title="New tee time" persistent>
      <form id="create-slot-form" class="space-y-4 pt-1" @submit.prevent="createSlot">
        <TextField v-model="form.date" type="date" label="Date" required data-autofocus />
        <TextField v-model="form.startTime" type="time" label="Tee time" required />
        <TextField v-model.number="form.maxPlayers" type="number" label="Max players" :min="1" :max="8" inputmode="numeric" required />
        <Switch v-model="form.memberOnly" label="Members only" />
      </form>
      <ErrorBanner v-if="formError" class="mt-4" :message="formError" />
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="create-slot-form" :loading="saving">Create</AppButton>
      </template>
    </AppDialog>

    <!-- Edit slot -->
    <AppDialog :open="!!editing" :title="editing ? `Edit ${teeTime(editing.startTime)}` : ''" persistent @update:open="v => { if (!v) editing = null }">
      <p v-if="editing" class="mb-4 text-body-m text-on-surface-variant">
        {{ formatLocalDate(editing.date, { weekday: 'long', month: 'long', day: 'numeric' }) }} ·
        {{ editing.bookedPlayers }} player{{ editing.bookedPlayers === 1 ? '' : 's' }} booked
      </p>
      <form id="edit-slot-form" class="space-y-4" @submit.prevent="saveEdit">
        <TextField
          v-model.number="editForm.maxPlayers"
          type="number"
          label="Max players"
          :min="Math.max(1, editing?.bookedPlayers || 0)"
          :max="8"
          inputmode="numeric"
          required
          data-autofocus
        />
        <Switch v-model="editForm.memberOnly" label="Members only" helper="Only members can book it online" />
      </form>
      <ErrorBanner v-if="formError" class="mt-4" :message="formError" />
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="edit-slot-form" :loading="saving">Save</AppButton>
      </template>
    </AppDialog>

    <!-- Bulk generate -->
    <AppDialog v-model:open="generateOpen" title="Add tee times" persistent fullscreen-on-mobile confirm-label="Add" :confirm-loading="saving" @confirm="generate">
      <form id="generate-form" class="space-y-5 pt-1" @submit.prevent="generate">
        <DateRangeField v-model="gen.range" label="Dates" :presets="['thisWeek', 'thisMonth']" required />
        <div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <TextField v-model="gen.firstTeeTime" type="time" label="First tee time" required />
          <TextField v-model="gen.lastTeeTime" type="time" label="Last tee time" required />
          <TextField v-model.number="gen.intervalMinutes" type="number" label="Every" suffix="min" :min="5" :max="120" inputmode="numeric" required />
          <TextField v-model.number="gen.maxPlayers" type="number" label="Max players" :min="1" :max="8" inputmode="numeric" required />
        </div>
        <Switch v-model="gen.memberOnly" label="Members only" />
        <p class="text-body-m text-on-surface-variant" aria-live="polite">
          <template v-if="genPreview">
            Up to {{ genPreview.total.toLocaleString('en-US') }} tee times ({{ genPreview.perDay }} a day from
            {{ teeTime(gen.firstTeeTime) }} to {{ genPreview.lastTime }}, {{ genPreview.days }} day{{ genPreview.days === 1 ? '' : 's' }}).
            Times that already exist are skipped.
          </template>
          <template v-else>Pick the dates and times to see how many tee times this adds.</template>
        </p>
      </form>
      <ErrorBanner v-if="formError" class="mt-4" :message="formError" />
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="generate-form" :loading="saving" :disabled="!genPreview">Add tee times</AppButton>
      </template>
    </AppDialog>

    <!-- Bulk close / members only -->
    <AppDialog v-model:open="bulkOpen" title="Close or restrict tee times" persistent fullscreen-on-mobile confirm-label="Apply" :confirm-loading="saving" @confirm="applyBulk">
      <form id="bulk-form" class="space-y-5 pt-1" @submit.prevent="applyBulk">
        <div class="space-y-2">
          <p class="text-label-l text-on-surface-variant">Change</p>
          <SegmentedButton v-model="bulk.action" label="Change" block :options="BULK_ACTIONS" />
          <p class="text-body-m text-on-surface-variant">{{ BULK_HELP[bulk.action] }}</p>
        </div>
        <DateRangeField v-model="bulk.range" label="Dates" :presets="['today', 'thisWeek', 'thisMonth']" required />
        <Switch v-model="bulk.allDay" label="All day" />
        <div v-if="!bulk.allDay" class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <TextField v-model="bulk.startTime" type="time" label="From" required />
          <TextField v-model="bulk.endTime" type="time" label="Through" required />
        </div>
      </form>
      <ErrorBanner v-if="formError" class="mt-4" :message="formError" />
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="bulk-form" :variant="bulk.action === 'close' ? 'danger' : 'filled'" :loading="saving">
          {{ bulk.action === 'close' ? 'Delete open slots' : 'Apply' }}
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { addDays, daysBetween, formatLocalDate, isValidHhmm, isValidYmd, localDate } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DateRangeField from '@/components/ui/DateRangeField.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import Switch from '@/components/ui/Switch.vue'
import TextField from '@/components/ui/TextField.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconCalendarAdd from '~icons/material-symbols/calendar-add-on-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'

const confirm = useConfirm()
const snackbar = useSnackbar()

// Course-local dates (B5: toISOString() is UTC, which is already tomorrow after 7 pm Central)
const today = localDate()

const range   = ref({ from: today, to: addDays(today, 14) })
const slots   = ref([])
const loading = ref(true)
const error   = ref(null)
const saving  = ref(false)
const formError = ref(null)

const columns = [
  { key: 'startTime', label: 'Tee time', primary: true, class: 'w-40' },
  { key: 'players', label: 'Booked', align: 'right', class: 'w-28' },
  { key: 'status', label: 'Status' },
]

const days = computed(() => {
  const byDate = new Map()
  for (const s of slots.value) {
    if (!byDate.has(s.date)) byDate.set(s.date, { date: s.date, slots: [], booked: 0, full: 0 })
    const day = byDate.get(s.date)
    day.slots.push(s)
    day.booked += s.bookedPlayers
    if (s.available === 0) day.full++
  }
  return [...byDate.values()]
})
const totalBooked = computed(() => slots.value.reduce((n, s) => n + s.bookedPlayers, 0))

const validRange = r => isValidYmd(r.from) && isValidYmd(r.to) && r.from <= r.to

// The latest request wins, so quickly changing the range never shows an older answer
let loadSeq = 0
async function load() {
  if (!validRange(range.value)) return
  const seq = ++loadSeq
  loading.value = true
  error.value = null
  try {
    const data = await apiFetch(`/api/admin/teetimes?start=${range.value.from}&end=${range.value.to}`)
    if (seq === loadSeq) slots.value = data
  } catch (e) {
    if (seq === loadSeq) error.value = e.message
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}
watch(range, load, { deep: true })

// ── Single slot ──
const createOpen = ref(false)
const blankForm = () => ({ date: range.value.from || today, startTime: '08:00', maxPlayers: 4, memberOnly: false })
const form = ref(blankForm())

function openCreate() {
  form.value = blankForm()
  formError.value = null
  createOpen.value = true
}

async function createSlot() {
  saving.value = true
  formError.value = null
  try {
    await apiFetch('/api/admin/teetimes', { method: 'POST', body: form.value })
    createOpen.value = false
    snackbar.show(`Added ${teeTime(form.value.startTime)} on ${formatLocalDate(form.value.date)}`)
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ── Edit ──
const editing  = ref(null)
const editForm = ref({ maxPlayers: 4, memberOnly: false })

function startEdit(slot) {
  editing.value = slot
  editForm.value = { maxPlayers: slot.maxPlayers, memberOnly: slot.memberOnly }
  formError.value = null
}

async function saveEdit() {
  saving.value = true
  formError.value = null
  try {
    const slot = editing.value
    await apiFetch(`/api/admin/teetimes/${slot.id}`, { method: 'PUT', body: editForm.value })
    editing.value = null
    snackbar.show(`Saved ${teeTime(slot.startTime)} on ${formatLocalDate(slot.date)}`)
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ── Delete (Undo creates the same slot again) ──
async function deleteSlot(slot) {
  const label = `${teeTime(slot.startTime)} on ${formatLocalDate(slot.date)}`
  const ok = await confirm({
    title: 'Delete tee time?',
    message: `${label} will no longer be bookable.`,
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/teetimes/${slot.id}`, { method: 'DELETE' })
    snackbar.show({
      message: `Deleted ${label}`,
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          await apiFetch('/api/admin/teetimes', {
            method: 'POST',
            body: { date: slot.date, startTime: slot.startTime, maxPlayers: slot.maxPlayers, memberOnly: slot.memberOnly },
          })
          snackbar.show(`Restored ${label}`)
          await load()
        } catch (e) {
          snackbar.show({ message: `Couldn't restore it: ${e.message}`, tone: 'error' })
        }
      },
    })
    await load()
  } catch (e) {
    snackbar.show({ message: `Couldn't delete ${label}: ${e.message}`, tone: 'error' })
  }
}

// ── Bulk generate (defaults from Course Settings) ──
const generateOpen = ref(false)
const defaults = ref({ firstTeeTime: '07:30', lastTeeTime: '17:00', intervalMinutes: 10 })
const gen = ref({})

async function loadDefaults() {
  try {
    const s = await apiFetch('/api/admin/settings')
    defaults.value = {
      firstTeeTime: s.firstTeeTime || defaults.value.firstTeeTime,
      lastTeeTime: s.lastTeeTime || defaults.value.lastTeeTime,
      intervalMinutes: s.intervalMinutes || defaults.value.intervalMinutes,
    }
  } catch {
    // The built-in defaults still work; the admin can change every field
  }
}

function openGenerate() {
  formError.value = null
  gen.value = {
    range: { from: range.value.from || today, to: range.value.to || addDays(today, 14) },
    ...defaults.value,
    maxPlayers: 4,
    memberOnly: false,
  }
  generateOpen.value = true
}

const toMinutes = hhmm => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const genPreview = computed(() => {
  const g = gen.value
  if (!g.range || !validRange(g.range) || !isValidHhmm(g.firstTeeTime) || !isValidHhmm(g.lastTeeTime)) return null
  const interval = Number(g.intervalMinutes)
  if (!Number.isInteger(interval) || interval < 5 || interval > 120) return null
  const span = toMinutes(g.lastTeeTime) - toMinutes(g.firstTeeTime)
  if (span < 0) return null
  const perDay = Math.floor(span / interval) + 1
  const last = toMinutes(g.firstTeeTime) + (perDay - 1) * interval
  const lastHhmm = `${String(Math.floor(last / 60)).padStart(2, '0')}:${String(last % 60).padStart(2, '0')}`
  const nDays = daysBetween(g.range.from, g.range.to) + 1
  return { perDay, days: nDays, total: perDay * nDays, lastTime: teeTime(lastHhmm) }
})

async function generate() {
  if (!genPreview.value) {
    formError.value = 'Check the dates and times.'
    return
  }
  saving.value = true
  formError.value = null
  try {
    const g = gen.value
    const res = await apiFetch('/api/admin/teetimes', {
      method: 'POST',
      body: {
        action: 'generate',
        from: g.range.from,
        to: g.range.to,
        firstTeeTime: g.firstTeeTime,
        lastTeeTime: g.lastTeeTime,
        intervalMinutes: Number(g.intervalMinutes),
        maxPlayers: Number(g.maxPlayers),
        memberOnly: g.memberOnly,
      },
    })
    generateOpen.value = false
    snackbar.show(res.created
      ? `Added ${res.created.toLocaleString('en-US')} tee time${res.created === 1 ? '' : 's'}${res.skipped ? ` (${res.skipped.toLocaleString('en-US')} already existed)` : ''}`
      : 'Those tee times already exist; nothing was added')
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ── Bulk close / members only ──
const BULK_ACTIONS = [
  { value: 'close', label: 'Close' },
  { value: 'membersOn', label: 'Members only' },
  { value: 'membersOff', label: 'Open to all' },
]
const BULK_HELP = {
  close: 'Deletes the tee times that have no bookings. Tee times with bookings stay.',
  membersOn: 'Only members can book these tee times online.',
  membersOff: 'Anyone can book these tee times online.',
}
const bulkOpen = ref(false)
const bulk = ref({})

function openBulk() {
  formError.value = null
  bulk.value = {
    action: 'close',
    range: { from: range.value.from || today, to: range.value.from || today },
    allDay: true,
    startTime: '12:00',
    endTime: '17:00',
  }
  bulkOpen.value = true
}

function bulkBody(dryRun) {
  const b = bulk.value
  return {
    action: b.action === 'close' ? 'close' : 'members',
    ...(b.action === 'close' ? {} : { memberOnly: b.action === 'membersOn' }),
    from: b.range.from,
    to: b.range.to,
    ...(b.allDay ? {} : { startTime: b.startTime, endTime: b.endTime }),
    dryRun,
  }
}

function describeBulkRange() {
  const b = bulk.value
  const dates = b.range.from === b.range.to
    ? formatLocalDate(b.range.from)
    : `${formatLocalDate(b.range.from)} to ${formatLocalDate(b.range.to)}`
  return b.allDay ? dates : `${dates}, ${teeTime(b.startTime)} to ${teeTime(b.endTime)}`
}

async function applyBulk() {
  const b = bulk.value
  if (!validRange(b.range)) {
    formError.value = 'Pick the dates.'
    return
  }
  if (!b.allDay && !(isValidHhmm(b.startTime) && isValidHhmm(b.endTime) && b.startTime <= b.endTime)) {
    formError.value = 'Check the times: the second one can\'t be earlier than the first.'
    return
  }
  saving.value = true
  formError.value = null
  try {
    // Ask the server what would change, so the confirmation shows real numbers
    const preview = await apiFetch('/api/admin/teetimes', { method: 'POST', body: bulkBody(true) })
    const where = describeBulkRange()
    const n = preview.deleted ?? preview.updated ?? 0
    if (!n) {
      formError.value = b.action === 'close'
        ? `No open tee times to delete (${where}).${preview.kept ? ` ${preview.kept} with bookings stay.` : ''}`
        : `Nothing to change (${where}).`
      return
    }
    const plural = `${n.toLocaleString('en-US')} tee time${n === 1 ? '' : 's'}`
    const ok = b.action === 'close'
      ? await confirm({
        title: `Delete ${plural}?`,
        message: `${where}. ${preview.kept ? `${preview.kept} with bookings will stay. ` : ''}This can't be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
      : await confirm({
        title: b.action === 'membersOn' ? `Make ${plural} members only?` : `Open ${plural} to everyone?`,
        message: `${where}. Existing bookings aren't changed.`,
        confirmLabel: 'Apply',
      })
    if (!ok) return
    const res = await apiFetch('/api/admin/teetimes', { method: 'POST', body: bulkBody(false) })
    bulkOpen.value = false
    const done = res.deleted ?? res.updated ?? 0
    snackbar.show(b.action === 'close'
      ? `Deleted ${done.toLocaleString('en-US')} tee time${done === 1 ? '' : 's'}${res.kept ? ` (${res.kept} with bookings kept)` : ''}`
      : `Updated ${done.toLocaleString('en-US')} tee time${done === 1 ? '' : 's'}`)
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
  loadDefaults()
})
</script>
