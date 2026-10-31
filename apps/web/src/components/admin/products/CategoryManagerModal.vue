<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-box max-w-2xl overflow-y-auto max-h-[92vh]">
      <h2 class="font-display font-bold text-bark mb-1">Categories</h2>
      <p class="text-gray-400 text-xs font-body mb-4">
        Tax-exempt categories are never charged sales tax. Lower sort numbers show first on the register.
      </p>

      <table class="w-full text-sm font-body">
        <thead>
          <tr class="text-left text-xs text-gray-500 uppercase tracking-wider">
            <th class="py-1 pr-2">Name</th>
            <th class="py-1 pr-2 w-20">Sort</th>
            <th class="py-1 pr-2 text-center">Tax Exempt</th>
            <th class="py-1 pr-2 text-center">Active</th>
            <th class="py-1 pr-2 text-right">Products</th>
            <th class="py-1 w-28" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="row in rows" :key="row.key">
            <td class="py-1.5 pr-2"><input v-model="row.name" type="text" class="input-field w-full" placeholder="New category" /></td>
            <td class="py-1.5 pr-2"><input v-model="row.sortOrder" type="number" step="1" class="input-field w-20" /></td>
            <td class="py-1.5 pr-2 text-center"><input v-model="row.taxExempt" type="checkbox" class="rounded" /></td>
            <td class="py-1.5 pr-2 text-center"><input v-model="row.active" type="checkbox" class="rounded" /></td>
            <td class="py-1.5 pr-2 text-right text-gray-500 tabular-nums">{{ row.id ? row.productCount : '—' }}</td>
            <td class="py-1.5 text-right space-x-2 whitespace-nowrap">
              <button
                v-if="isDirty(row)"
                :disabled="row.saving"
                class="text-xs text-pine font-semibold hover:underline disabled:opacity-50"
                @click="saveRow(row)"
              >
                {{ row.id ? 'Save' : 'Add' }}
              </button>
              <button
                v-if="!row.id || row.productCount === 0"
                class="text-xs text-red-400 hover:text-red-600"
                @click="removeRow(row)"
              >
                {{ row.id ? 'Delete' : 'Cancel' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <button class="text-xs text-lake hover:text-pine font-body mt-3" @click="addRow">+ Add category</button>
      <p v-if="error" class="text-red-500 text-xs mt-2">{{ error }}</p>

      <div class="flex justify-end mt-5">
        <button class="btn-outline-sm" @click="$emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { apiFetch } from '@/lib/api'

const props = defineProps({
  categories: { type: Array, required: true },
})
const emit = defineEmits(['close', 'changed'])

const FIELDS = ['name', 'sortOrder', 'taxExempt', 'active']
let keySeq = 0

const toRow = (c) => ({
  key: `k${keySeq++}`,
  id: c.id ?? null,
  name: c.name ?? '',
  sortOrder: c.sortOrder ?? 0,
  taxExempt: c.taxExempt ?? false,
  active: c.active ?? true,
  productCount: c.productCount ?? 0,
  original: c.id ? { ...c } : null,
  saving: false,
})

const rows  = ref(props.categories.map(toRow))
const error = ref(null)

function isDirty(row) {
  if (!row.id) return !!row.name.trim()
  return FIELDS.some(f => String(row[f]) !== String(row.original[f]))
}

function addRow() {
  const nextSort = Math.max(0, ...rows.value.map(r => Number(r.sortOrder) || 0)) + 10
  rows.value.push(toRow({ sortOrder: nextSort }))
}

async function saveRow(row) {
  row.saving  = true
  error.value = null
  try {
    const body = { name: row.name, sortOrder: Number(row.sortOrder), taxExempt: row.taxExempt, active: row.active }
    const saved = await apiFetch(row.id ? `/api/admin/product-categories/${row.id}` : '/api/admin/product-categories', {
      method: row.id ? 'PUT' : 'POST',
      body,
    })
    Object.assign(row, { id: saved.id, original: { ...saved } })
    emit('changed')
  } catch (e) {
    error.value = e.message
  } finally {
    row.saving = false
  }
}

async function removeRow(row) {
  error.value = null
  if (row.id) {
    try {
      await apiFetch(`/api/admin/product-categories/${row.id}`, { method: 'DELETE' })
      emit('changed')
    } catch (e) {
      error.value = e.message
      return
    }
  }
  rows.value = rows.value.filter(r => r !== row)
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
