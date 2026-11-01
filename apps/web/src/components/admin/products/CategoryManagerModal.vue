<template>
  <AppDialog
    v-model:open="open"
    title="Categories"
    size="lg"
    persistent
    fullscreen-on-mobile
    @after-leave="$emit('close')"
  >
    <p class="text-body-m text-on-surface-variant mb-4">
      Tax-exempt categories are never charged sales tax. Lower sort numbers show first on the register.
      <template v-if="hasMemberDiscount">
        Active members get their Pro Shop discount (10% or 15% by tier) in Member Discount categories, except on products with a member price.
      </template>
    </p>

    <ul class="divide-y divide-outline-variant border-y border-outline-variant text-on-surface" aria-label="Categories">
      <li v-for="row in rows" :key="row.key" class="py-2">
        <!-- Inline edit -->
        <form v-if="row.editing" class="space-y-1 py-1" novalidate @submit.prevent="saveRow(row)">
          <div class="grid grid-cols-[1fr_6rem] gap-3">
            <TextField
              :ref="el => setNameField(row, el)"
              v-model="row.name"
              label="Name"
              required
              autocomplete="off"
              :error="row.nameError"
            />
            <TextField v-model="row.sortOrder" label="Sort" type="number" inputmode="numeric" step="1" />
          </div>
          <div class="flex flex-wrap gap-x-6">
            <Checkbox v-model="row.taxExempt" label="Tax exempt" />
            <Checkbox v-if="hasMemberDiscount" v-model="row.memberDiscount" label="Member discount" />
            <Checkbox v-model="row.active" label="Active" />
          </div>
          <ErrorBanner v-if="row.error" :message="row.error" />
          <div class="flex justify-end gap-2">
            <AppButton variant="text" :disabled="row.saving" @click="cancelRow(row)">Cancel</AppButton>
            <AppButton type="submit" variant="tonal" :loading="row.saving">{{ row.id ? 'Save' : 'Add' }}</AppButton>
          </div>
        </form>

        <!-- Read-only row -->
        <div v-else class="flex items-center gap-3 min-h-12">
          <span class="w-10 flex-none text-body-s text-on-surface-variant tabular-nums" :title="`Sort order ${row.sortOrder}`">
            <span class="sr-only">Sort </span>{{ row.sortOrder }}
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span :class="['text-body-l', row.active ? 'text-on-surface' : 'text-on-surface-variant']">{{ row.name }}</span>
              <StatusChip v-if="row.taxExempt" label="Tax exempt" tone="info" :icon="false" size="sm" />
              <StatusChip v-if="hasMemberDiscount && row.memberDiscount" label="Member discount" tone="primary" icon="member" size="sm" />
              <StatusChip v-if="!row.active" label="Inactive" tone="neutral" icon="block" size="sm" />
            </div>
            <div class="text-body-s text-on-surface-variant">
              {{ row.productCount }} product{{ row.productCount === 1 ? '' : 's' }}
            </div>
          </div>
          <IconButton :icon="IconEdit" :label="`Edit ${row.name}`" @click="editRow(row)" />
          <!-- Categories with products can't be deleted (deactivate them instead) -->
          <IconButton v-if="row.productCount === 0" :icon="IconDelete" :label="`Delete ${row.name}`" @click="removeRow(row)" />
          <span v-else class="w-12 flex-none" aria-hidden="true" />
        </div>
      </li>
      <li v-if="!rows.length" class="py-6 text-center text-body-m text-on-surface-variant">No categories yet.</li>
    </ul>

    <AppButton variant="text" :icon="IconAdd" class="mt-2" @click="addRow">Add category</AppButton>
    <ErrorBanner v-if="error" :message="error" class="mt-2" @dismiss="error = null" />

    <template #actions="{ close }">
      <AppButton @click="close">Done</AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'

// Mount with v-if; Done closes the dialog and `close` fires after its exit animation. `changed` after every save/delete.
const props = defineProps({
  categories: { type: Array, required: true },
})
const emit = defineEmits(['close', 'changed'])

const confirm  = useConfirm()
const snackbar = useSnackbar()
const open = ref(true)

// ProductCategory.memberDiscount only comes back once its migration has run; until then the column is hidden
// (and the register uses its default categories, see src/lib/pricing.js)
const hasMemberDiscount = props.categories.some(c => 'memberDiscount' in c)
const FIELDS = ['name', 'sortOrder', 'taxExempt', 'active', ...(hasMemberDiscount ? ['memberDiscount'] : [])]
let keySeq = 0

const toRow = (c) => ({
  key: `k${keySeq++}`,
  id: c.id ?? null,
  name: c.name ?? '',
  sortOrder: c.sortOrder ?? 0,
  taxExempt: c.taxExempt ?? false,
  memberDiscount: c.memberDiscount ?? false,
  active: c.active ?? true,
  productCount: c.productCount ?? 0,
  original: c.id ? { ...c } : null,
  editing: !c.id,
  saving: false,
  error: null,
  nameError: '',
})

const rows  = ref(props.categories.map(toRow))
const error = ref(null)

// Name fields of the rows being edited, so a row that switches to edit mode gets the focus
const nameFields = new Map()
function setNameField(row, el) {
  if (el) nameFields.set(row.key, el)
  else nameFields.delete(row.key)
}
function focusName(row) {
  nextTick(() => nameFields.get(row.key)?.focus())
}

function editRow(row) {
  Object.assign(row, { editing: true, error: null, nameError: '' })
  focusName(row)
}

function cancelRow(row) {
  if (!row.id) {
    rows.value = rows.value.filter(r => r !== row)
    return
  }
  // Put the saved values back
  for (const f of FIELDS) row[f] = row.original[f] ?? (f === 'memberDiscount' ? false : row[f])
  Object.assign(row, { editing: false, error: null, nameError: '' })
}

function addRow() {
  const nextSort = Math.max(0, ...rows.value.map(r => Number(r.sortOrder) || 0)) + 10
  const row = toRow({ sortOrder: nextSort })
  rows.value.push(row)
  focusName(row)
}

async function saveRow(row) {
  row.error = null
  row.nameError = row.name.trim() ? '' : 'Enter a name'
  if (row.nameError) return
  const dirty = !row.id || FIELDS.some(f => String(row[f]) !== String(row.original[f]))
  if (!dirty) {
    row.editing = false
    return
  }
  row.saving = true
  try {
    const body = { name: row.name, sortOrder: Number(row.sortOrder), taxExempt: row.taxExempt, active: row.active }
    if (hasMemberDiscount) body.memberDiscount = row.memberDiscount
    const isNew = !row.id
    const saved = await apiFetch(row.id ? `/api/admin/product-categories/${row.id}` : '/api/admin/product-categories', {
      method: row.id ? 'PUT' : 'POST',
      body,
    })
    Object.assign(row, { id: saved.id, original: { ...saved }, editing: false })
    snackbar.show(isNew ? `${saved.name ?? row.name} added` : `${saved.name ?? row.name} saved`)
    emit('changed')
  } catch (e) {
    row.error = e.message
  } finally {
    row.saving = false
  }
}

async function removeRow(row) {
  error.value = null
  const name = row.original?.name ?? row.name
  const ok = await confirm({ title: `Delete ${name}?`, message: "This can't be undone.", confirmLabel: 'Delete', destructive: true })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/product-categories/${row.id}`, { method: 'DELETE' })
    rows.value = rows.value.filter(r => r !== row)
    snackbar.show(`${name} deleted`)
    emit('changed')
  } catch (e) {
    error.value = e.message
  }
}
</script>
