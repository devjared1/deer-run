<template>
  <div>
    <!-- Toolbar -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-4">
      <div>
        <label class="label-sm">Search</label>
        <input v-model="filters.search" type="text" class="input-field" placeholder="Product name" @keyup.enter="load" />
      </div>
      <div>
        <label class="label-sm">Category</label>
        <select v-model="filters.categoryId" class="input-field" @change="load">
          <option value="">All categories</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div>
        <label class="label-sm">Status</label>
        <select v-model="filters.status" class="input-field" @change="load">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <button class="btn-pine px-4 py-2 text-sm" @click="load">Search</button>
      <div class="ml-auto flex gap-2">
        <button class="btn-outline-sm" @click="showCategories = true">Categories</button>
        <button class="btn-amber px-4 py-2 text-sm" :disabled="!categories.length" @click="openForm(null)">+ New Product</button>
      </div>
    </div>

    <div v-if="taxBps === 0" class="mb-6 bg-amber/10 border border-amber/30 rounded-xl p-4 text-sm font-body text-bark">
      <strong class="font-semibold">Sales tax is set to 0%.</strong>
      Set the course's rate in <RouterLink to="/admin/settings" class="text-lake underline">Settings → Point of Sale</RouterLink>
      before the register goes live.
    </div>
    <p v-if="notice" class="mb-4 text-sm font-body text-amber">{{ notice }}</p>

    <div v-if="loading && !products.length" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <template v-else>
      <p v-if="actionError" class="text-red-500 text-sm mb-3">{{ actionError }}</p>
      <div v-for="group in groups" :key="group.category.id" class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <h2 class="font-display font-bold text-bark text-sm">{{ group.category.name }}</h2>
          <span v-if="group.category.taxExempt" class="badge bg-lake/20 text-lake">Tax exempt</span>
          <span v-if="!group.category.active" class="badge bg-gray-100 text-gray-500">Inactive category</span>
          <span class="text-gray-400 text-xs font-body ml-auto">{{ group.products.length }} product{{ group.products.length === 1 ? '' : 's' }}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm font-body">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100 text-left">
                <th class="th">Product</th>
                <th class="th text-right">Price</th>
                <th class="th text-right">Member</th>
                <th class="th">Variants</th>
                <th class="th text-right">Stock</th>
                <th class="th" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="p in group.products" :key="p.id" :class="['hover:bg-gray-50/50', p.active ? '' : 'opacity-60']">
                <td class="td">
                  <div class="text-bark font-semibold">
                    {{ p.name }}
                    <span v-if="!p.active" class="badge bg-gray-100 text-gray-500 ml-1 font-normal">Inactive</span>
                  </div>
                  <div v-if="p.description" class="text-gray-400 text-xs">{{ p.description }}</div>
                </td>
                <td class="td text-right tabular-nums">{{ formatCents(p.priceCents) }}</td>
                <td class="td text-right tabular-nums text-gray-600">
                  {{ p.memberPriceCents === null ? '—' : formatCents(p.memberPriceCents) }}
                </td>
                <td class="td text-gray-600">{{ variantSummary(p) }}</td>
                <td class="td text-right tabular-nums">
                  <span v-if="!p.trackInventory" class="text-gray-400 text-xs">Not tracked</span>
                  <span v-else :class="stockClass(p)">{{ p.totalStock }}</span>
                </td>
                <td class="td text-right whitespace-nowrap space-x-3 text-xs">
                  <button class="text-lake hover:text-pine" @click="openForm(p)">Edit</button>
                  <button v-if="p.trackInventory" class="text-lake hover:text-pine" @click="stockProduct = p">Stock</button>
                  <button class="text-amber hover:text-clay" @click="toggleActive(p)">{{ p.active ? 'Deactivate' : 'Activate' }}</button>
                  <button class="text-red-400 hover:text-red-600" @click="deleting = p">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-if="!groups.length" class="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center text-gray-400 text-sm">
        <template v-if="!categories.length">
          No categories yet. Run <code>prisma/seed-pos.sql</code> for the starter catalog, or add categories with the Categories button.
        </template>
        <template v-else>No products found.</template>
      </div>
    </template>

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

    <!-- Delete confirm -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-2">Delete {{ deleting.name }}?</h2>
        <p class="text-gray-500 text-sm font-body mb-5">
          This permanently removes the product and its variants. Products with stock history can't be
          deleted; deactivate them instead.
        </p>
        <div class="flex justify-end gap-3">
          <button class="btn-outline-sm" @click="deleting = null">Cancel</button>
          <button :disabled="saving" class="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg font-body transition-colors" @click="deleteProduct">
            {{ saving ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
        <p v-if="deleteError" class="text-red-500 text-xs mt-2">{{ deleteError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import ProductFormModal from '@/components/admin/products/ProductFormModal.vue'
import StockModal from '@/components/admin/products/StockModal.vue'
import CategoryManagerModal from '@/components/admin/products/CategoryManagerModal.vue'

const products   = ref([])
const categories = ref([])
const taxBps     = ref(null)
const loading    = ref(false)
const error      = ref(null)
const actionError = ref(null) // a failed row action (activate/deactivate); shown above the list instead of replacing it
const notice    = ref(null)
const filters    = ref({ search: '', categoryId: '', status: 'all' })

const editing        = ref(null) // { product } — product null for a new one
const stockProduct   = ref(null)
const showCategories = ref(false)
const deleting       = ref(null)
const deleteError    = ref(null)
const saving         = ref(false)

// Products grouped under their category, in category sort order
const groups = computed(() => categories.value
  .map(category => ({ category, products: products.value.filter(p => p.categoryId === category.id) }))
  .filter(g => g.products.length))

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

function stockClass(p) {
  if (p.totalStock <= 0) return 'text-red-600 font-semibold'
  if (p.variants.some(v => v.active && v.stockQty <= 0)) return 'text-amber font-semibold'
  return 'text-bark'
}

async function loadCategories() {
  categories.value = await apiFetch('/api/admin/product-categories')
}

async function load() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams({ status: filters.value.status })
    if (filters.value.search)     params.set('search', filters.value.search)
    if (filters.value.categoryId) params.set('categoryId', filters.value.categoryId)
    products.value = await apiFetch(`/api/admin/products?${params}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openForm(product) {
  notice.value  = null
  editing.value = { product }
}

function onSaved(saved) {
  editing.value = null
  notice.value  = saved.warnings?.length ? saved.warnings.join(' ') : null
  load()
}

async function toggleActive(p) {
  actionError.value = null
  if (p.active && !window.confirm(`Deactivate "${p.name}"? It won't show on the register until it's activated again.`)) return
  try {
    await apiFetch(`/api/admin/products/${p.id}`, { method: 'PUT', body: { active: !p.active } })
    await load()
  } catch (e) {
    actionError.value = e.message
  }
}

async function deleteProduct() {
  saving.value      = true
  deleteError.value = null
  try {
    await apiFetch(`/api/admin/products/${deleting.value.id}`, { method: 'DELETE' })
    deleting.value = null
    await load()
  } catch (e) {
    deleteError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await loadCategories()
    taxBps.value = (await apiFetch('/api/admin/settings')).salesTaxBps ?? null
  } catch (e) {
    error.value = e.message
  }
  await load()
})
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.th             { @apply px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold; }
.td             { @apply px-5 py-3; }
.badge          { @apply text-xs px-2 py-0.5 rounded-full font-body; }
.btn-pine       { @apply bg-pine text-parch rounded-lg font-body font-semibold hover:bg-pine/90 transition-colors; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
