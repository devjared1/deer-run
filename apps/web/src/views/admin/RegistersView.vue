<template>
  <div class="max-w-4xl font-body text-on-surface">
    <Teleport to="#admin-page-actions" defer>
      <!-- Phones: icon only, so the page title keeps its room -->
      <AppButton variant="gold" :icon="IconAdd" class="hidden sm:inline-flex" @click="openForm(null)">New register</AppButton>
      <IconButton variant="filled" :icon="IconAdd" label="New register" class="sm:hidden" @click="openForm(null)" />
    </Teleport>

    <p class="mb-4 text-body-m text-on-surface-variant">
      Each register is a checkout station. A PC chooses which register it is the first time it opens the register screen.
    </p>

    <ErrorBanner v-if="actionError" :message="actionError" class="mb-4" @dismiss="actionError = null" />
    <ErrorBanner v-if="error" :message="error" :retrying="loading" @retry="load" />

    <DataTable
      v-else
      :columns="columns"
      :rows="registers"
      :loading="loading && !registers.length"
      :loading-rows="2"
      caption="Registers"
      actions-label="Register actions"
    >
      <template #cell-reader="{ row }">
        <template v-if="row.stripeReaderId">
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="readerFor(row)">
              <span>{{ readerFor(row).label }}</span>
              <StatusChip
                :label="readerFor(row).status === 'online' ? 'Online' : 'Offline'"
                :tone="readerFor(row).status === 'online' ? 'success' : 'error'"
                :icon="readerFor(row).status === 'online' ? IconWifi : IconWifiOff"
                size="sm"
              />
              <StatusChip v-if="readerFor(row).simulated" label="Simulated" tone="info" :icon="false" size="sm" />
            </template>
            <StatusChip v-else-if="readers" label="Not found in Stripe" tone="warning" icon="warning" size="sm" />
            <span v-else class="text-on-surface-variant">Checking…</span>
          </div>
          <code class="block mt-0.5 text-body-s text-on-surface-variant break-all">{{ row.stripeReaderId }}</code>
        </template>
        <AppButton v-else-if="readers?.configured" variant="text" :icon="IconAddLink" class="-ml-3" @click="openPair(row)">
          Pair a reader
        </AppButton>
        <span v-else class="text-on-surface-variant">Not assigned</span>
      </template>
      <template #cell-active="{ row }">
        <StatusChip
          :label="row.active ? 'Active' : 'Inactive'"
          :tone="row.active ? 'success' : 'neutral'"
          :icon="row.active ? 'check' : 'block'"
          size="sm"
        />
      </template>
      <template #empty>
        <EmptyState
          :icon="IconPointOfSale"
          title="No registers yet"
          message="Add one for each checkout station."
          action-label="New register"
          :action-icon="IconAdd"
          compact
          @action="openForm(null)"
        />
      </template>
      <template #actions="{ row }">
        <RowActionsMenu :label="`Actions for ${row.name}`" :items="rowActions(row)" />
      </template>
    </DataTable>

    <div class="mt-3 flex flex-wrap items-center gap-x-2 text-body-s text-on-surface-variant">
      <template v-if="readers && !readers.configured">
        Card readers need Stripe (STRIPE_SECRET_KEY) set in the Pages project.
      </template>
      <template v-else-if="readers">
        <span>
          Reader status comes from Stripe<template v-if="readers.testMode"> (test mode: pair code <code>simulated-wpe</code> makes a simulated reader)</template>.
        </span>
        <AppButton variant="text" :icon="IconRefresh" :loading="readersLoading" @click="loadReaders">Refresh</AppButton>
      </template>
    </div>
    <ErrorBanner v-if="readersError" :message="readersError" class="mt-2" :retrying="readersLoading" @retry="loadReaders" />

    <!-- Pair a reader -->
    <AppDialog v-model:open="pairOpen" title="Pair a card reader" size="sm" persistent>
      <template v-if="pairing">
        <p class="text-body-m text-on-surface-variant mb-4">
          For {{ pairing.register.name }}. On the reader, open <strong class="text-on-surface">Settings › Generate pairing code</strong>
          (it needs Wi-Fi or Ethernet) and enter the code here.
        </p>
        <form id="pair-form" novalidate class="space-y-1" @submit.prevent="pair">
          <TextField
            v-model="pairing.code"
            label="Pairing code"
            required
            autocomplete="off"
            autocapitalize="off"
            :placeholder="readers?.testMode ? 'simulated-wpe' : 'e.g. sepia-cerulean-aardvark'"
            data-autofocus
          />
          <TextField v-model="pairing.label" label="Reader name" required maxlength="100" autocomplete="off" />
          <ErrorBanner v-if="pairing.error" :message="pairing.error" />
        </form>
      </template>
      <template #actions="{ close }">
        <AppButton variant="text" :disabled="pairing?.busy" @click="close">Cancel</AppButton>
        <AppButton
          type="submit"
          form="pair-form"
          :icon="IconAddLink"
          :loading="pairing?.busy"
          :disabled="!pairing?.code.trim() || !pairing?.label.trim()"
        >
          {{ pairing?.busy ? 'Pairing…' : 'Pair reader' }}
        </AppButton>
      </template>
    </AppDialog>

    <!-- New / edit -->
    <AppDialog v-model:open="formOpen" :title="form?.id ? 'Edit register' : 'New register'" size="sm" persistent>
      <form v-if="form" id="register-form" novalidate class="space-y-1 pt-2" @submit.prevent="save">
        <TextField v-model="form.name" label="Name" required placeholder="Pro Shop" autocomplete="off" data-autofocus />
        <TextField
          v-model="form.stripeReaderId"
          label="Stripe card reader ID"
          placeholder="tmr_…"
          autocomplete="off"
          helper="Set automatically by Pair a reader. Clear it to unassign the reader."
        />
        <Switch v-model="form.active" label="Active" />
        <ErrorBanner v-if="formError" :message="formError" />
      </form>
      <template #actions="{ close }">
        <AppButton variant="text" :disabled="saving" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="register-form" :loading="saving">{{ saving ? 'Saving…' : 'Save' }}</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import Switch from '@/components/ui/Switch.vue'
import TextField from '@/components/ui/TextField.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconAddLink from '~icons/material-symbols/add-link-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'
import IconRefresh from '~icons/material-symbols/refresh-rounded'
import IconWifi from '~icons/material-symbols/wifi-rounded'
import IconWifiOff from '~icons/material-symbols/wifi-off-rounded'
import IconPointOfSale from '~icons/material-symbols/point-of-sale-rounded'

const confirm  = useConfirm()
const snackbar = useSnackbar()

const columns = [
  { key: 'name', label: 'Name', primary: true },
  { key: 'reader', label: 'Card reader' },
  { key: 'active', label: 'Status' },
]

const registers   = ref([])
const loading     = ref(false)
const error       = ref(null)
const actionError = ref(null) // a failed row action (delete); shown above the table instead of replacing it
const form        = ref(null)
const formOpen    = ref(false)
const saving      = ref(false)
const formError   = ref(null)

// Stripe Terminal readers: { configured, testMode, readers: [{ id, label, status, simulated }] }
const readers        = ref(null)
const readersError   = ref(null)
const readersLoading = ref(false)
const pairing        = ref(null)
const pairOpen       = ref(false)

function readerFor(r) {
  return readers.value?.readers.find(x => x.id === r.stripeReaderId) ?? null
}

function rowActions(r) {
  return [
    { label: 'Edit', icon: IconEdit, onClick: () => openForm(r) },
    { label: 'Pair a reader', icon: IconAddLink, disabled: !readers.value?.configured || !!r.stripeReaderId, onClick: () => openPair(r) },
    { label: 'Delete', icon: IconDelete, danger: true, onClick: () => remove(r) },
  ]
}

async function loadReaders() {
  readersError.value = null
  readersLoading.value = true
  try {
    readers.value = await apiFetch('/api/admin/registers/readers')
  } catch (e) {
    readersError.value = `Couldn't load card readers from Stripe: ${e.message}`
  } finally {
    readersLoading.value = false
  }
}

function openPair(register) {
  pairing.value = { register, code: readers.value?.testMode ? 'simulated-wpe' : '', label: register.name, busy: false, error: null }
  pairOpen.value = true
}

async function pair() {
  const p = pairing.value
  if (!p || p.busy || !p.code.trim() || !p.label.trim()) return
  p.busy  = true
  p.error = null
  try {
    await apiFetch('/api/admin/registers/readers', {
      method: 'POST',
      body: { registrationCode: p.code.trim(), label: p.label.trim(), registerId: p.register.id },
    })
    pairOpen.value = false
    snackbar.show(`Reader paired with ${p.register.name}`)
    await Promise.all([load(), loadReaders()])
  } catch (e) {
    p.error = e.message
  } finally {
    p.busy = false
  }
}

async function load() {
  loading.value = true
  error.value   = null
  try {
    registers.value = await apiFetch('/api/admin/registers')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openForm(r) {
  form.value = { id: r?.id ?? null, name: r?.name ?? '', stripeReaderId: r?.stripeReaderId ?? '', active: r?.active ?? true }
  formError.value = null
  formOpen.value = true
}

async function save() {
  if (saving.value) return
  saving.value    = true
  formError.value = null
  try {
    const { id, ...body } = form.value
    await apiFetch(id ? `/api/admin/registers/${id}` : '/api/admin/registers', { method: id ? 'PUT' : 'POST', body })
    formOpen.value = false
    snackbar.show(id ? `${body.name} saved` : `${body.name} added`)
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function remove(r) {
  actionError.value = null
  const ok = await confirm({ title: `Delete ${r.name}?`, message: "This can't be undone.", confirmLabel: 'Delete', destructive: true })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/registers/${r.id}`, { method: 'DELETE' })
    snackbar.show(`${r.name} deleted`)
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

onMounted(() => {
  load()
  loadReaders()
})
</script>
