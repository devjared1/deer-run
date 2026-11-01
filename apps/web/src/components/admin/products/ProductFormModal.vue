<template>
  <div class="modal-overlay">
    <div class="modal-box max-w-3xl overflow-y-auto max-h-[92vh]">
      <h2 class="font-display font-bold text-bark mb-4">{{ product ? 'Edit Product' : 'New Product' }}</h2>

      <div class="space-y-3">
        <div class="grid sm:grid-cols-2 gap-3">
          <div>
            <label class="label-sm">Name *</label>
            <input v-model="form.name" type="text" class="input-field w-full" placeholder="Deer Run Polo" />
          </div>
          <div>
            <label class="label-sm">Category *</label>
            <select v-model="form.categoryId" class="input-field w-full">
              <option value="" disabled>Select a category</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="label-sm">Description</label>
          <input v-model="form.description" type="text" class="input-field w-full" />
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label class="label-sm">Price ($) *</label>
            <input v-model="form.price" type="number" min="0" step="0.01" class="input-field w-full" />
          </div>
          <div>
            <label class="label-sm">Member Price ($)</label>
            <input v-model="form.memberPrice" type="number" min="0" step="0.01" class="input-field w-full" placeholder="Same" />
          </div>
          <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer sm:mt-5">
            <input v-model="form.trackInventory" type="checkbox" class="rounded" /> Track stock
          </label>
          <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer sm:mt-5">
            <input v-model="form.active" type="checkbox" class="rounded" /> Active
          </label>
        </div>

        <!-- Membership -->
        <div class="grid sm:grid-cols-[auto,1fr,1fr] gap-3 items-end">
          <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer pb-2">
            <input v-model="form.isMembership" type="checkbox" class="rounded" /> Selling this makes the customer a member
          </label>
          <div v-if="form.isMembership">
            <label class="label-sm">Membership length (months) *</label>
            <input v-model="form.membershipMonths" type="number" min="1" max="60" step="1" class="input-field w-full" placeholder="12" />
          </div>
          <div v-if="form.isMembership">
            <label class="label-sm">Tier</label>
            <select v-model="form.membershipTier" class="input-field w-full">
              <option value="">—</option>
              <option v-for="t in membershipTiers" :key="t.name" :value="t.name">{{ t.name }}</option>
            </select>
          </div>
          <p v-if="form.isMembership" class="sm:col-span-3 text-xs text-gray-400 font-body -mt-1">
            The register asks for the customer's account and adds the months to their membership (renewals extend it).
          </p>
        </div>

        <!-- Variants -->
        <div class="border-t border-gray-100 pt-4">
          <label class="flex items-center gap-2 font-body text-sm text-bark cursor-pointer mb-3">
            <input v-model="form.hasOptions" type="checkbox" class="rounded" />
            This product comes in sizes and/or colors
          </label>

          <!-- Single (default) variant -->
          <div v-if="!form.hasOptions" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label class="label-sm">SKU</label>
              <input v-model="form.single.sku" type="text" class="input-field w-full" />
            </div>
            <div>
              <label class="label-sm">Barcode</label>
              <input v-model="form.single.barcode" type="text" class="input-field w-full" placeholder="Scan or type" />
            </div>
            <div v-if="form.trackInventory && !form.single.id">
              <label class="label-sm">Starting Stock</label>
              <input v-model="form.single.initialStock" type="number" min="0" step="1" class="input-field w-full" />
            </div>
          </div>

          <!-- Sizes / colors -->
          <template v-else>
            <div class="bg-gray-50 rounded-lg p-3 mb-3 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label class="label-sm">Sizes (comma separated)</label>
                <input v-model="sizesInput" type="text" class="input-field w-full" placeholder="S, M, L, XL, XXL" />
              </div>
              <div>
                <label class="label-sm">Colors (comma separated)</label>
                <input v-model="colorsInput" type="text" class="input-field w-full" placeholder="Navy, White" />
              </div>
              <button class="btn-outline-sm" @click="generateVariants">Add Combinations</button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm font-body">
                <thead>
                  <tr class="text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th class="py-1 pr-2">Size</th>
                    <th class="py-1 pr-2">Color</th>
                    <th class="py-1 pr-2">SKU</th>
                    <th class="py-1 pr-2">Barcode</th>
                    <th class="py-1 pr-2">Price ($)</th>
                    <th v-if="form.trackInventory" class="py-1 pr-2">Stock</th>
                    <th class="py-1 pr-2">Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(v, i) in form.variants" :key="v.key">
                    <td class="py-1 pr-2"><input v-model="v.size" type="text" class="input-field w-20" /></td>
                    <td class="py-1 pr-2"><input v-model="v.color" type="text" class="input-field w-24" /></td>
                    <td class="py-1 pr-2"><input v-model="v.sku" type="text" class="input-field w-28" /></td>
                    <td class="py-1 pr-2"><input v-model="v.barcode" type="text" class="input-field w-32" /></td>
                    <td class="py-1 pr-2">
                      <input v-model="v.price" type="number" min="0" step="0.01" class="input-field w-24" :placeholder="form.price || '—'" />
                    </td>
                    <td v-if="form.trackInventory" class="py-1 pr-2">
                      <input
                        v-if="!v.id"
                        v-model="v.initialStock"
                        type="number"
                        min="0"
                        step="1"
                        class="input-field w-20"
                        title="Starting stock"
                      />
                      <span v-else class="text-gray-600 tabular-nums">{{ v.stockQty }}</span>
                    </td>
                    <td class="py-1 pr-2 text-center"><input v-model="v.active" type="checkbox" class="rounded" /></td>
                    <td class="py-1">
                      <button class="text-red-400 hover:text-red-600 text-xs px-1" aria-label="Remove variant" @click="form.variants.splice(i, 1)">✕</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="!form.variants.length" class="text-gray-400 text-xs font-body">
              Enter sizes and/or colors above and click Add Combinations.
            </p>
            <p class="text-gray-400 text-xs font-body mt-2">
              Leave a variant's price empty to use the product price. Stock for existing variants is changed
              from the Stock button, not here. Removing a variant with stock history deactivates it instead.
            </p>
          </template>
          <p v-if="switchingToOptions" class="text-gold text-xs font-body mt-2">
            The current single variant will be removed (or deactivated if it has stock history) when you save.
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-5">
        <button class="btn-outline-sm" @click="$emit('close')">Cancel</button>
        <button :disabled="saving" class="btn-amber px-4 py-2 text-sm disabled:opacity-50" @click="save">
          {{ saving ? 'Saving…' : (product ? 'Save Changes' : 'Create Product') }}
        </button>
      </div>
      <p v-if="error" class="text-red-500 text-xs mt-2">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { apiFetch } from '@/lib/api'
import { centsToDollars, dollarsToCents } from '@/lib/money'
import { membershipTiers } from '@/data/membershipTiers'

const props = defineProps({
  product: { type: Object, default: null },
  categories: { type: Array, required: true },
  defaultCategoryId: { type: String, default: '' },
})
const emit = defineEmits(['close', 'saved'])

let keySeq = 0
const nextKey = () => `k${keySeq++}`

const toRow = (v) => ({
  key: nextKey(),
  id: v.id ?? null,
  size: v.size ?? '',
  color: v.color ?? '',
  sku: v.sku ?? '',
  barcode: v.barcode ?? '',
  price: centsToDollars(v.priceCents ?? null),
  memberPrice: centsToDollars(v.memberPriceCents ?? null),
  active: v.active ?? true,
  stockQty: v.stockQty ?? 0,
  initialStock: '',
})

function initialForm(p) {
  const variants = p?.variants ?? []
  const isDefaultOnly = variants.length <= 1 && !variants[0]?.size && !variants[0]?.color
  return {
    categoryId: p?.categoryId ?? props.defaultCategoryId ?? '',
    name: p?.name ?? '',
    description: p?.description ?? '',
    price: centsToDollars(p?.priceCents ?? null),
    memberPrice: centsToDollars(p?.memberPriceCents ?? null),
    trackInventory: p?.trackInventory ?? false,
    active: p?.active ?? true,
    isMembership: !!p?.membershipMonths,
    membershipMonths: p?.membershipMonths ?? '',
    membershipTier: p?.membershipTier ?? '',
    hasOptions: !isDefaultOnly,
    single: isDefaultOnly && variants[0] ? toRow(variants[0]) : toRow({}),
    variants: isDefaultOnly ? [] : variants.map(toRow),
  }
}

const form        = ref(initialForm(props.product))
const sizesInput  = ref('')
const colorsInput = ref('')
const saving      = ref(false)
const error       = ref(null)

const switchingToOptions = computed(() => form.value.hasOptions && !!form.value.single.id)

const splitList = (s) => s.split(',').map(x => x.trim()).filter(Boolean)

function generateVariants() {
  const sizes  = splitList(sizesInput.value)
  const colors = splitList(colorsInput.value)
  if (!sizes.length && !colors.length) return
  const existing = new Set(form.value.variants.map(v => `${v.size}|${v.color}`.toLowerCase()))
  for (const color of colors.length ? colors : ['']) {
    for (const size of sizes.length ? sizes : ['']) {
      if (existing.has(`${size}|${color}`.toLowerCase())) continue
      form.value.variants.push(toRow({ size, color }))
    }
  }
}

function variantPayload(v) {
  return {
    id: v.id ?? undefined,
    size: v.size,
    color: v.color,
    sku: v.sku,
    barcode: v.barcode,
    priceCents: dollarsToCents(v.price),
    memberPriceCents: dollarsToCents(v.memberPrice),
    active: v.active,
    initialStock: v.id ? undefined : (v.initialStock === '' ? undefined : Number(v.initialStock)),
  }
}

async function save() {
  const f = form.value
  if (f.hasOptions && !f.variants.length) {
    error.value = 'Add at least one size or color, or uncheck "comes in sizes and/or colors"'
    return
  }
  if (f.isMembership && !(Number(f.membershipMonths) >= 1)) {
    error.value = 'Enter how many months the membership lasts'
    return
  }
  saving.value = true
  error.value  = null
  try {
    const body = {
      categoryId: f.categoryId,
      name: f.name,
      description: f.description,
      priceCents: dollarsToCents(f.price),
      memberPriceCents: dollarsToCents(f.memberPrice),
      trackInventory: f.trackInventory,
      active: f.active,
      membershipMonths: f.isMembership ? Number(f.membershipMonths) || null : null,
      membershipTier: f.isMembership ? f.membershipTier || null : null,
      variants: f.hasOptions
        ? f.variants.map(variantPayload)
        : [variantPayload({ ...f.single, size: '', color: '', active: true })],
    }
    const saved = await apiFetch(props.product ? `/api/admin/products/${props.product.id}` : '/api/admin/products', {
      method: props.product ? 'PUT' : 'POST',
      body,
    })
    emit('saved', saved)
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
