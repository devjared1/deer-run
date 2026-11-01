<template>
  <div class="font-body text-on-surface">
    <Teleport to="#admin-page-actions" defer>
      <!-- Phones: icon only, so the page title keeps its room -->
      <AppButton variant="gold" :icon="IconAdd" :disabled="!categories.length" class="hidden sm:inline-flex" @click="openForm(null)">
        New product
      </AppButton>
      <IconButton variant="filled" :icon="IconAdd" label="New product" :disabled="!categories.length" class="sm:hidden" @click="openForm(null)" />
    </Teleport>

    <!-- Filters: reload on change, search debounced -->
    <section aria-label="Filters" class="mb-4 space-y-3">
      <div class="flex flex-wrap items-start gap-3">
        <TextField
          v-model="filters.search"
          label="Search products"
          type="search"
          autocomplete="off"
          :leading-icon="IconSearch"
          class="w-full sm:w-72"
        />
        <SegmentedButton
          v-model="filters.status"
          label="Status"
          :options="STATUS_OPTIONS"
          class="sm:mt-2"
        />
        <AppButton variant="outlined" :icon="IconCategory" class="sm:mt-2 sm:ml-auto" @click="showCategories = true">
          Categories
        </AppButton>
      </div>
      <ChipGroup
        v-if="categories.length"
        v-model="filters.categoryId"
        type="choice"
        scroll
        label="Category"
        :options="categoryOptions"
      />
    </section>

    <div
      v-if="taxBps === 0"
      class="mb-4 flex items-start gap-3 rounded-shape-md bg-warning-container text-on-warning-container p-4 text-body-m"
    >
      <IconWarning class="w-6 h-6 flex-none" aria-hidden="true" />
      <p>
        <strong class="font-bold">Sales tax is set to 0%.</strong>
        Set the course's rate in
        <RouterLink to="/admin/settings" class="underline underline-offset-2">Settings › Point of Sale</RouterLink>
        before the register goes live.
      </p>
    </div>

    <ErrorBanner v-if="notice" :message="notice" title="Saved with warnings" :icon="IconWarning" class="mb-4" @dismiss="notice = null" />
    <ErrorBanner v-if="actionError" :message="actionError" class="mb-4" @dismiss="actionError = null" />

    <ErrorBanner v-if="error" :message="error" :retrying="loading" @retry="reload" />

    <EmptyState
      v-else-if="!loading && !categories.length"
      :icon="IconCategory"
      title="No categories yet"
      action-label="Add categories"
      :action-icon="IconCategory"
      @action="showCategories = true"
    >
      Run <code>prisma/seed-pos.sql</code> for the starter catalog, or add categories first.
    </EmptyState>

    <DataTable
      v-else
      v-model:sort="sort"
      :columns="columns"
      :rows="rows"
      :loading="loading && !products.length"
      caption="Products"
      empty-text="No products match these filters."
      :row-label="p => p.name"
      actions-label="Product actions"
    >
      <template #cell-name="{ row }">
        <span :class="row.active ? '' : 'text-on-surface-variant'">{{ row.name }}</span>
        <span v-if="row.description" class="block text-body-s font-normal text-on-surface-variant">{{ row.description }}</span>
      </template>
      <template #cell-category="{ row }">
        {{ row.category?.name ?? '—' }}
        <StatusChip v-if="row.category?.taxExempt" label="Tax exempt" tone="info" :icon="false" size="sm" class="ml-1" />
      </template>
      <template #cell-price="{ row }">
        <span class="tabular-nums">{{ money(row.priceCents) }}</span>
        <span v-if="row.memberPriceCents !== null" class="block text-body-s text-on-surface-variant tabular-nums">
          Member {{ money(row.memberPriceCents) }}
        </span>
      </template>
      <template #cell-variants="{ row }">
        <span class="text-on-surface-variant">{{ variantSummary(row) }}</span>
      </template>
      <template #cell-stock="{ row }">
        <span v-if="!row.trackInventory" class="text-on-surface-variant">Not tracked</span>
        <StatusChip
          v-else-if="row.totalStock <= 0"
          :label="`${row.totalStock} · Out`"
          tone="error"
          icon="warning"
          size="sm"
        />
        <StatusChip
          v-else-if="row.variants.some(v => v.active && v.stockQty <= 0)"
          :label="`${row.totalStock} · Some out`"
          tone="warning"
          icon="warning"
          size="sm"
        />
        <span v-else class="tabular-nums">{{ row.totalStock }}</span>
      </template>
      <template #cell-active="{ row }">
        <StatusChip
          :label="row.active ? 'Active' : 'Inactive'"
          :tone="row.active ? 'success' : 'neutral'"
          :icon="row.active ? 'check' : 'block'"
          size="sm"
        />
      </template>
      <template #actions="{ row }">
        <RowActionsMenu :label="`Actions for ${row.name}`" :items="rowActions(row)" />
      </template>
    </DataTable>

    <ProductFormModal
      v-if="editing"
      :product="editing.product"
      :categories="categories"
      :default-category-id="filters.categoryId"
      @close="editing = null"
      @saved="onSaved"
    />
    <StockModal v-if="stockProduct" :product="stockProduct" @close="stockProduct = null" @changed="load" />
    <CategoryManagerModal
      v-if="showCategories"
      :categories="categories"
      @close="showCategories = false"
      @changed="loadCategories(); load()"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import ProductFormModal from '@/components/admin/products/ProductFormModal.vue'
import StockModal from '@/components/admin/products/StockModal.vue'
import CategoryManagerModal from '@/components/admin/products/CategoryManagerModal.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconCategory from '~icons/material-symbols/category-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconInventory from '~icons/material-symbols/inventory-rounded'
import IconToggleOff from '~icons/material-symbols/toggle-off-rounded'
import IconToggleOn from '~icons/material-symbols/toggle-on-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const confirm  = useConfirm()
const snackbar = useSnackbar()

const products    = ref([])
const categories  = ref([])
const taxBps      = ref(null)
const loading     = ref(false)
const error       = ref(null)
const actionError = ref(null) // a failed row action; shown above the table instead of replacing it
const notice      = ref(null) // warnings from the last save
const filters     = ref({ search: '', categoryId: '', status: 'all' })
const sort        = ref({ key: 'category', dir: 'asc' })

const editing        = ref(null) // { product }; product null for a new one
const stockProduct   = ref(null)
const showCategories = ref(false)

const money = (cents) => (cents === null || cents === undefined
  ? '—'
  : `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

const categoryOptions = computed(() => [
  { value: '', label: 'All categories' },
  ...categories.value.map(c => ({ value: c.id, label: c.active ? c.name : `${c.name} (inactive)` })),
])

// Category sort order first (as on the register), then the API's order within a category
const categoryOrder = computed(() => new Map(categories.value.map((c, i) => [c.id, i])))
const rows = computed(() => products.value.map((p, i) => ({
  ...p,
  category: categories.value.find(c => c.id === p.categoryId) ?? null,
  _order: (categoryOrder.value.get(p.categoryId) ?? 999) * 10000 + i,
})))

const columns = [
  { key: 'name', label: 'Product', sortable: true, primary: true, sortValue: r => r.name.toLowerCase(), class: 'min-w-[12rem]' },
  { key: 'category', label: 'Category', sortable: true, sortValue: r => r._order },
  { key: 'price', label: 'Price', align: 'right', sortable: true, sortValue: r => r.priceCents, class: 'whitespace-nowrap' },
  { key: 'variants', label: 'Variants', hideOnMobile: true, class: 'min-w-[10rem]' },
  { key: 'stock', label: 'Stock', align: 'right', sortable: true, sortValue: r => (r.trackInventory ? r.totalStock : -Infinity) },
  { key: 'active', label: 'Status', sortable: true, sortValue: r => (r.active ? 0 : 1) },
]

function variantSummary(p) {
  const options = p.variants.filter(v => v.size || v.color)
  if (!options.length) return p.variants[0]?.sku ? `SKU ${p.variants[0].sku}` : '—'
  const sizes  = [...new Set(options.map(v => v.size).filter(Boolean))]
  const colors = [...new Set(options.map(v => v.color).filter(Boolean))]
  const parts = []
  if (sizes.length)  parts.push(sizes.length > 3 ? `${sizes[0]}–${sizes[sizes.length - 1]}` : sizes.join(', '))
  if (colors.length) parts.push(colors.join(', '))
  return `${options.length} variant${options.length === 1 ? '' : 's'} · ${parts.join(' · ')}`
}

function rowActions(p) {
  return [
    { label: 'Edit', icon: IconEdit, onClick: () => openForm(p) },
    { label: 'Stock', icon: IconInventory, disabled: !p.trackInventory, onClick: () => { stockProduct.value = p } },
    p.active
      ? { label: 'Deactivate', icon: IconToggleOff, onClick: () => setActive(p, false) }
      : { label: 'Activate', icon: IconToggleOn, onClick: () => setActive(p, true) },
    { label: 'Delete', icon: IconDelete, danger: true, onClick: () => deleteProduct(p) },
  ]
}

async function loadCategories() {
  categories.value = await apiFetch('/api/admin/product-categories')
}

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ status: filters.value.status })
    if (filters.value.search.trim()) params.set('search', filters.value.search.trim())
    if (filters.value.categoryId)    params.set('categoryId', filters.value.categoryId)
    products.value = await apiFetch(`/api/admin/products?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function reload() {
  error.value = null
  try {
    if (!categories.value.length) await loadCategories()
  } catch (e) {
    error.value = e.message
    return
  }
  await load()
}

// One filter rule: reload on change, debounce typing
let searchTimer = null
watch(() => filters.value.search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})
watch(() => [filters.value.categoryId, filters.value.status], () => {
  clearTimeout(searchTimer)
  load()
})

function openForm(product) {
  notice.value  = null
  editing.value = { product }
}

// The dialog closes itself (and emits close after its exit animation)
function onSaved(saved) {
  notice.value = saved.warnings?.length ? saved.warnings.join(' ') : null
  snackbar.show(`${saved.name ?? 'Product'} saved`)
  load()
}

async function putActive(p, active) {
  await apiFetch(`/api/admin/products/${p.id}`, { method: 'PUT', body: { active } })
  await load()
}

async function setActive(p, active) {
  actionError.value = null
  try {
    await putActive(p, active)
  } catch (e) {
    actionError.value = e.message
    return
  }
  if (active) {
    snackbar.show(`${p.name} activated`)
    return
  }
  snackbar.show({
    message: `${p.name} deactivated. It won't show on the register.`,
    actionLabel: 'Undo',
    onAction: async () => {
      try {
        await putActive(p, true)
        snackbar.show(`${p.name} activated again`)
      } catch (e) {
        actionError.value = e.message
      }
    },
  })
}

async function deleteProduct(p) {
  actionError.value = null
  const ok = await confirm({
    title: `Delete ${p.name}?`,
    message: "This permanently removes the product and its variants. Products with stock history can't be deleted; deactivate them instead.",
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/admin/products/${p.id}`, { method: 'DELETE' })
    snackbar.show(`${p.name} deleted`)
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

onMounted(async () => {
  // The tax reminder is optional; a failed settings call doesn't block the page
  apiFetch('/api/admin/settings').then(s => { taxBps.value = s.salesTaxBps ?? null }).catch(() => {})
  await reload()
})
</script>
