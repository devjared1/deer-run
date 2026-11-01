<template>
  <div class="space-y-6">
    <Teleport to="#admin-page-actions" defer>
      <AppButton :icon="IconAdd" @click="openCreate">
        <span class="hidden sm:inline">New event</span>
        <span class="sm:hidden">New</span>
      </AppButton>
    </Teleport>

    <SegmentedButton v-model="activeTab" label="Show" :options="TABS" class="max-w-md" />

    <ErrorBanner v-if="error" :message="error" @retry="load" />

    <DataTable
      v-else
      :columns="columns"
      :rows="events"
      :loading="loading"
      caption="Tournaments"
      :row-label="ev => `${ev.name}, ${dateLabel(ev)}`"
      @row-click="openEdit"
    >
      <template #cell-name="{ row }">
        <span class="block">{{ row.name }}</span>
        <span v-if="row.featured || row.memberOnly || row.past" class="mt-1 flex flex-wrap gap-1 font-normal">
          <StatusChip v-if="row.featured" size="sm" label="Featured" tone="warning" icon="flag" />
          <StatusChip v-if="row.memberOnly" size="sm" label="Members only" tone="primary" icon="member" />
          <StatusChip v-if="row.past" size="sm" label="Past" tone="neutral" icon="block" />
        </span>
      </template>
      <template #cell-date="{ row }"><span class="whitespace-nowrap">{{ dateLabel(row) }}</span></template>
      <template #cell-entry="{ row }"><span class="tabular-nums">{{ row.entry != null ? money(row.entry) : '—' }}</span></template>
      <template #cell-spotsTotal="{ row }"><span class="tabular-nums">{{ row.spotsTotal ?? '—' }}</span></template>
      <template #actions="{ row }">
        <RowActionsMenu
          :label="`Actions for ${row.name}`"
          :items="[
            { label: 'Edit', icon: IconEdit, onClick: () => openEdit(row) },
            { label: 'Delete', icon: IconDelete, danger: true, onClick: () => deleteEvent(row) },
          ]"
        />
      </template>
      <template #empty>
        <EmptyState
          compact
          :icon="IconTrophy"
          :title="activeTab === 'past' ? 'No past events' : activeTab === 'upcoming' ? 'No upcoming events' : 'No events yet'"
          message="Events you add are listed on the public Tournaments page."
          action-label="New event"
          :action-icon="IconAdd"
          @action="openCreate"
        />
      </template>
    </DataTable>

    <!-- Create / edit -->
    <AppDialog
      v-model:open="formOpen"
      :title="formData.id ? 'Edit event' : 'New event'"
      size="lg"
      persistent
      fullscreen-on-mobile
      :confirm-label="formData.id ? 'Save' : 'Create'"
      :confirm-loading="saving"
      @confirm="saveEvent"
    >
      <form id="event-form" class="space-y-4 pt-1" @submit.prevent="saveEvent">
        <TextField v-model="formData.name" label="Name" placeholder="Spring Scramble" required data-autofocus />
        <TextArea v-model="formData.description" label="Description" :rows="4" auto-grow required />
        <div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <TextField v-model="formData.eventDate" type="date" label="Date" required />
          <TextField v-model="formData.startTime" type="time" label="Start time" required />
        </div>
        <TextField v-model="formData.format" label="Format" placeholder="18-hole scramble" required />
        <div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <MoneyField v-model="formData.entry" label="Entry fee" :min="0" helper="Leave empty if there's none" />
          <TextField v-model="formData.spotsTotal" type="number" label="Total spots" :min="0" inputmode="numeric" helper="Leave empty for no limit" />
        </div>
        <div class="flex flex-col">
          <Checkbox v-model="formData.featured" label="Featured" helper="Highlighted on the Tournaments page" />
          <Checkbox v-model="formData.memberOnly" label="Members only" />
          <Checkbox v-model="formData.past" label="Mark as past" />
        </div>
      </form>
      <ErrorBanner v-if="formError" class="mt-4" :message="formError" />
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="event-form" :loading="saving">{{ formData.id ? 'Save' : 'Create event' }}</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatLocalDate } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextArea from '@/components/ui/TextArea.vue'
import TextField from '@/components/ui/TextField.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'
// emoji_events has no rounded variant in the icon set; trophy-rounded is the same glyph
import IconTrophy from '~icons/material-symbols/trophy-rounded'

const confirm  = useConfirm()
const snackbar = useSnackbar()

const TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
]
const columns = [
  { key: 'name', label: 'Event', primary: true, sortable: true },
  { key: 'date', label: 'Date', sortable: true, sortValue: ev => `${ev.eventDate?.slice(0, 10)} ${ev.startTime}` },
  { key: 'format', label: 'Format' },
  { key: 'entry', label: 'Entry', align: 'right', sortable: true },
  { key: 'spotsTotal', label: 'Spots', align: 'right', hideOnMobile: true },
]

const events    = ref([])
const loading   = ref(true)
const error     = ref(null)
const saving    = ref(false)
const formError = ref(null)
const activeTab = ref('upcoming')

const formOpen = ref(false)
const formData = ref({})

// "$1,234.56"
const money = cents => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
// eventDate is stored as midnight UTC of the event day: read the date part, with no time zone shift
const dateLabel = ev => `${formatLocalDate(ev.eventDate.slice(0, 10), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}, ${teeTime(ev.startTime)}`

const blankForm = () => ({
  id: null, name: '', description: '', eventDate: '', startTime: '08:00',
  format: '', entry: null, spotsTotal: '', featured: false, memberOnly: false, past: false,
})

let loadSeq = 0
async function load() {
  const seq = ++loadSeq
  loading.value = true
  error.value   = null
  try {
    const past = activeTab.value === 'past' ? '?past=true' : activeTab.value === 'upcoming' ? '?past=false' : ''
    const data = await apiFetch(`/api/admin/events${past}`)
    if (seq === loadSeq) events.value = data
  } catch (e) {
    if (seq === loadSeq) error.value = e.message
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}
watch(activeTab, load)

function openCreate() {
  formData.value = blankForm()
  formError.value = null
  formOpen.value = true
}

function openEdit(ev) {
  formData.value = {
    id: ev.id,
    name: ev.name,
    description: ev.description,
    eventDate: ev.eventDate.split('T')[0],
    startTime: ev.startTime,
    format: ev.format,
    entry: ev.entry ?? null,
    spotsTotal: ev.spotsTotal ?? '',
    featured: ev.featured,
    memberOnly: ev.memberOnly,
    past: ev.past,
  }
  formError.value = null
  formOpen.value = true
}

async function saveEvent() {
  const f = formData.value
  if (!f.name?.trim() || !f.description?.trim() || !f.eventDate || !f.startTime || !f.format?.trim()) {
    formError.value = 'Name, description, date, start time and format are required.'
    return
  }
  saving.value = true
  formError.value = null
  try {
    const body = {
      name: f.name,
      description: f.description,
      eventDate: f.eventDate,
      startTime: f.startTime,
      format: f.format,
      entry: f.entry ?? null,
      spotsTotal: f.spotsTotal !== '' && f.spotsTotal !== null ? Number(f.spotsTotal) : null,
      featured: f.featured,
      memberOnly: f.memberOnly,
      past: f.past,
    }
    const url    = f.id ? `/api/admin/events/${f.id}` : '/api/admin/events'
    const method = f.id ? 'PUT' : 'POST'
    await apiFetch(url, { method, body })
    formOpen.value = false
    snackbar.show(f.id ? `Saved ${f.name}` : `Created ${f.name}`)
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function deleteEvent(ev) {
  const ok = await confirm({
    title: `Delete ${ev.name}?`,
    message: "It's removed from the Tournaments page. This can't be undone.",
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/events/${ev.id}`, { method: 'DELETE' })
    snackbar.show(`Deleted ${ev.name}`)
    await load()
  } catch (e) {
    snackbar.show({ message: `Couldn't delete ${ev.name}: ${e.message}`, tone: 'error' })
  }
}

onMounted(load)
</script>
