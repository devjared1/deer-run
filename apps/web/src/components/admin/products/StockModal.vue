<template>
  <AppDialog
    v-model:open="open"
    :title="`Stock · ${product.name}`"
    size="lg"
    persistent
    fullscreen-on-mobile
    @after-leave="$emit('close')"
  >
    <p class="text-body-m text-on-surface-variant mb-3">Every change is logged with who made it and why.</p>

    <ChipGroup
      v-if="variants.length > 1"
      :model-value="selectedId"
      type="choice"
      label="Variant"
      :options="variantOptions"
      class="mb-2"
      @update:model-value="select"
    />
    <p class="text-body-l text-on-surface mb-1">
      <span class="text-on-surface-variant">{{ variants.length > 1 ? variantLabel(selected) : 'On hand' }}: </span>
      <strong class="font-bold tabular-nums">{{ selected?.stockQty ?? 0 }}</strong> in stock
      <StatusChip v-if="selected && !selected.active" label="Inactive" tone="neutral" icon="block" size="sm" class="ml-1" />
    </p>

    <AppTabs v-model="tab" :tabs="TABS" label="Stock" variant="secondary">
      <!-- Adjust -->
      <template #adjust>
        <form novalidate class="space-y-3 text-on-surface" @submit.prevent="submit">
          <SegmentedButton :model-value="adj.mode" label="Kind of change" :options="modes" block @update:model-value="setMode" />
          <div class="grid sm:grid-cols-3 gap-x-3 gap-y-1">
            <TextField
              v-model="adj.quantity"
              :label="adj.mode === 'count' ? 'Counted on hand' : 'Quantity'"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              required
              :helper="preview !== null ? `${selected.stockQty} → ${preview}` : ''"
            />
            <SelectField
              v-model="adj.reason"
              label="Reason"
              required
              :options="reasonsFor(adj.mode).map(r => ({ value: r, label: reasonLabels[r] }))"
            />
            <TextField v-model="adj.note" label="Note" placeholder="Invoice #, etc." autocomplete="off" />
          </div>
          <ErrorBanner v-if="error" :message="error" />
          <div class="flex justify-end">
            <AppButton type="submit" :loading="saving" :disabled="adj.quantity === '' || !selected">
              {{ saving ? 'Saving…' : 'Save' }}
            </AppButton>
          </div>
        </form>
      </template>

      <!-- History -->
      <template #history>
        <Skeleton v-if="loadingHistory" variant="text" :lines="4" label="Loading stock history" />
        <ErrorBanner v-else-if="historyError" :message="historyError" @retry="loadHistory" />
        <EmptyState v-else-if="!history.length" :icon="IconHistory" title="No stock changes yet" compact />
        <ul v-else class="divide-y divide-outline-variant border-y border-outline-variant">
          <li v-for="h in history" :key="h.id" class="py-2 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-body-m">
            <span :class="['w-12 tabular-nums font-bold', h.quantityChange >= 0 ? 'text-primary' : 'text-tertiary']">
              {{ h.quantityChange > 0 ? '+' : h.quantityChange < 0 ? '−' : '' }}{{ Math.abs(h.quantityChange) }}
            </span>
            <span class="w-16 tabular-nums text-on-surface-variant">→ {{ h.stockAfter }}</span>
            <span class="text-on-surface">
              {{ reasonLabels[h.reason] ?? h.reason }}<span v-if="h.note" class="text-on-surface-variant"> · {{ h.note }}</span>
            </span>
            <span class="ml-auto text-body-s text-on-surface-variant">{{ formatWhen(h.createdAt) }}<template v-if="h.by"> · {{ h.by }}</template></span>
          </li>
        </ul>
      </template>
    </AppTabs>

    <template #actions="{ close }">
      <AppButton variant="text" @click="close">Done</AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { COURSE_TZ } from '@/lib/timeclock'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import SelectField from '@/components/ui/SelectField.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import IconTune from '~icons/material-symbols/tune-rounded'
import IconHistory from '~icons/material-symbols/history-rounded'

// Mount with v-if; Done closes it and `close` fires after the exit animation. `changed` after each saved adjustment.
const props = defineProps({
  product: { type: Object, required: true },
})
const emit = defineEmits(['close', 'changed'])

const snackbar = useSnackbar()
const open = ref(true)
const tab  = ref('adjust')

const TABS = [
  { key: 'adjust', label: 'Adjust', icon: IconTune },
  { key: 'history', label: 'History', icon: IconHistory },
]
const modes = [
  { value: 'add',    label: 'Receive' },
  { value: 'remove', label: 'Remove' },
  { value: 'count',  label: 'Set count' },
]
const reasonLabels = {
  INITIAL: 'Starting stock',
  RECEIVED: 'Received',
  COUNT_CORRECTION: 'Count correction',
  DAMAGED: 'Damaged / lost',
  RETURNED_TO_VENDOR: 'Returned to vendor',
  SALE: 'Sale',
  RETURN: 'Return',
  OTHER: 'Other',
}
const reasonsFor = (mode) => ({
  add: ['RECEIVED', 'OTHER'],
  remove: ['DAMAGED', 'RETURNED_TO_VENDOR', 'OTHER'],
  count: ['COUNT_CORRECTION'],
}[mode])

const variants = ref(props.product.variants.map(v => ({ ...v })))
const selectedId = ref(variants.value.find(v => v.active)?.id ?? variants.value[0]?.id)
const selected = computed(() => variants.value.find(v => v.id === selectedId.value))
const adj = ref({ mode: 'add', quantity: '', reason: 'RECEIVED', note: '' })
const history = ref([])
const loadingHistory = ref(false)
const historyError = ref(null)
const saving = ref(false)
const error  = ref(null)

const variantOptions = computed(() => variants.value.map(v => ({
  value: v.id,
  label: `${variantLabel(v)} · ${v.stockQty}${v.active ? '' : ' (inactive)'}`,
})))

const preview = computed(() => {
  if (adj.value.quantity === '' || !selected.value) return null
  const q = Number(adj.value.quantity)
  if (!Number.isInteger(q)) return null
  return { add: selected.value.stockQty + q, remove: selected.value.stockQty - q, count: q }[adj.value.mode]
})

function variantLabel(v) {
  return [v?.size, v?.color].filter(Boolean).join(' / ') || 'Stock'
}

function formatWhen(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}

function setMode(mode) {
  adj.value = { ...adj.value, mode, reason: reasonsFor(mode)[0] }
}

async function loadHistory() {
  if (!selectedId.value) return
  loadingHistory.value = true
  historyError.value = null
  try {
    history.value = (await apiFetch(`/api/admin/inventory/${selectedId.value}`)).history
  } catch (e) {
    historyError.value = e.message
  } finally {
    loadingHistory.value = false
  }
}

function select(id) {
  if (id == null) return
  selectedId.value = id
  error.value = null
  loadHistory()
}

async function submit() {
  if (saving.value || adj.value.quantity === '' || !selected.value) return
  saving.value = true
  error.value  = null
  try {
    const before = selected.value.stockQty
    const { stockQty } = await apiFetch(`/api/admin/inventory/${selectedId.value}`, {
      method: 'POST',
      body: { ...adj.value, quantity: Number(adj.value.quantity) },
    })
    selected.value.stockQty = stockQty
    adj.value = { ...adj.value, quantity: '', note: '' }
    snackbar.show(`Stock updated: ${before} → ${stockQty}`)
    emit('changed')
    await loadHistory()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(loadHistory)
</script>
