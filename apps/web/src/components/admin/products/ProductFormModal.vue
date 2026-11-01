<template>
  <AppDialog
    v-model:open="open"
    :title="product ? 'Edit product' : 'New product'"
    size="lg"
    persistent
    fullscreen-on-mobile
    :confirm-label="product ? 'Save' : 'Create'"
    :confirm-loading="saving"
    @confirm="save"
    @after-leave="$emit('close')"
  >
    <form id="product-form" novalidate class="space-y-4 pt-2 pb-2 text-on-surface" @submit.prevent="save">
      <div class="grid sm:grid-cols-2 gap-x-3 gap-y-1">
        <TextField v-model="form.name" label="Name" required placeholder="Deer Run Polo" autocomplete="off" data-autofocus />
        <SelectField
          v-model="form.categoryId"
          label="Category"
          required
          placeholder="Select a category"
          :options="categories.map(c => ({ value: c.id, label: c.name }))"
        />
      </div>
      <TextField v-model="form.description" label="Description" autocomplete="off" />

      <div class="grid sm:grid-cols-2 gap-x-3 gap-y-1">
        <MoneyField v-model="form.priceCents" label="Price" required :min="0" />
        <MoneyField v-model="form.memberPriceCents" label="Member price" :min="0" helper="Leave empty for the same price" />
      </div>
      <div class="flex flex-wrap gap-x-6">
        <Checkbox v-model="form.trackInventory" label="Track stock" />
        <Checkbox v-model="form.active" label="Active (shows on the register)" />
      </div>

      <!-- Membership -->
      <div class="rounded-shape-md border border-outline-variant p-3">
        <Checkbox
          v-model="form.isMembership"
          label="Selling this makes the customer a member"
          helper="The register asks for the customer's account and adds the months to their membership (renewals extend it)."
        />
        <div v-if="form.isMembership" class="grid sm:grid-cols-2 gap-x-3 gap-y-1 mt-3">
          <TextField
            v-model="form.membershipMonths"
            label="Membership length (months)"
            type="number"
            inputmode="numeric"
            min="1"
            max="60"
            step="1"
            required
            placeholder="12"
          />
          <SelectField
            v-model="form.membershipTier"
            label="Tier"
            placeholder="No tier"
            :options="membershipTiers.map(t => ({ value: t.name, label: t.name }))"
          />
        </div>
      </div>

      <!-- Variants -->
      <div class="border-t border-outline-variant pt-4">
        <Checkbox v-model="form.hasOptions" label="This product comes in sizes and/or colors" />

        <!-- Single (default) variant -->
        <div v-if="!form.hasOptions" class="grid sm:grid-cols-3 gap-x-3 gap-y-1 mt-3">
          <TextField v-model="form.single.sku" label="SKU" autocomplete="off" />
          <TextField v-model="form.single.barcode" label="Barcode" autocomplete="off" placeholder="Scan or type" />
          <TextField
            v-if="form.trackInventory && !form.single.id"
            v-model="form.single.initialStock"
            label="Starting stock"
            type="number"
            inputmode="numeric"
            min="0"
            step="1"
          />
        </div>

        <!-- Sizes / colors -->
        <template v-else>
          <div class="mt-3 rounded-shape-md bg-surface-container p-3 grid sm:grid-cols-[1fr_1fr_auto] gap-x-3 gap-y-1 items-start">
            <TextField v-model="sizesInput" label="Sizes (comma separated)" placeholder="S, M, L, XL, XXL" autocomplete="off" />
            <TextField v-model="colorsInput" label="Colors (comma separated)" placeholder="Navy, White" autocomplete="off" />
            <AppButton variant="tonal" :icon="IconAdd" class="sm:mt-2" @click="generateVariants">Add combinations</AppButton>
          </div>

          <ul v-if="form.variants.length" class="mt-3 space-y-2" aria-label="Variants">
            <li
              v-for="(v, i) in form.variants"
              :key="v.key"
              class="rounded-shape-md border border-outline-variant p-3"
            >
              <div class="flex items-center gap-2 mb-2">
                <span class="flex-1 min-w-0 truncate text-title-s text-on-surface">{{ variantName(v) }}</span>
                <span v-if="v.id && form.trackInventory" class="text-body-s text-on-surface-variant tabular-nums">{{ v.stockQty }} in stock</span>
                <IconButton :icon="IconDelete" :label="`Remove ${variantName(v)}`" size="sm" @click="form.variants.splice(i, 1)" />
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                <TextField v-model="v.size" label="Size" autocomplete="off" />
                <TextField v-model="v.color" label="Color" autocomplete="off" />
                <MoneyField v-model="v.priceCents" label="Price" :min="0" :helper="form.priceCents !== null ? `Empty: ${money(form.priceCents)}` : 'Empty: product price'" />
                <TextField v-model="v.sku" label="SKU" autocomplete="off" />
                <TextField v-model="v.barcode" label="Barcode" autocomplete="off" />
                <TextField
                  v-if="form.trackInventory && !v.id"
                  v-model="v.initialStock"
                  label="Starting stock"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  step="1"
                />
              </div>
              <Checkbox v-model="v.active" label="Active" />
            </li>
          </ul>
          <p v-else class="mt-3 text-body-s text-on-surface-variant">
            Enter sizes and/or colors above and choose Add combinations.
          </p>
          <p class="mt-2 text-body-s text-on-surface-variant">
            Leave a variant's price empty to use the product price. Stock for existing variants is changed
            from Stock in the product's menu, not here. Removing a variant with stock history deactivates it instead.
          </p>
        </template>
        <p v-if="switchingToOptions" class="mt-2 flex items-start gap-2 text-body-s text-on-warning-container">
          <IconWarning class="w-5 h-5 flex-none" aria-hidden="true" />
          The current single variant will be removed (or deactivated if it has stock history) when you save.
        </p>
      </div>

      <ErrorBanner v-if="error" :message="error" />
    </form>

    <template #actions="{ close }">
      <AppButton variant="text" :disabled="saving" @click="close">Cancel</AppButton>
      <AppButton type="submit" form="product-form" :loading="saving">
        {{ saving ? 'Saving…' : (product ? 'Save changes' : 'Create product') }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { apiFetch } from '@/lib/api'
import { membershipTiers } from '@/data/membershipTiers'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'

// Mount with v-if; the dialog closes itself (Cancel, or after a save) and emits `close` once its exit animation ends.
// `saved` (with the API's product, incl. `warnings`) fires as soon as the save succeeds.
const props = defineProps({
  product: { type: Object, default: null },
  categories: { type: Array, required: true },
  defaultCategoryId: { type: String, default: '' },
})
const emit = defineEmits(['close', 'saved'])

const open = ref(true)

let keySeq = 0
const nextKey = () => `k${keySeq++}`

const money = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const toRow = (v) => ({
  key: nextKey(),
  id: v.id ?? null,
  size: v.size ?? '',
  color: v.color ?? '',
  sku: v.sku ?? '',
  barcode: v.barcode ?? '',
  priceCents: v.priceCents ?? null,
  memberPriceCents: v.memberPriceCents ?? null,
  active: v.active ?? true,
  stockQty: v.stockQty ?? 0,
  initialStock: '',
})

function initialForm(p) {
  const variants = p?.variants ?? []
  const isDefaultOnly = variants.length <= 1 && !variants[0]?.size && !variants[0]?.color
  return {
    categoryId: p?.categoryId ?? (props.defaultCategoryId || null),
    name: p?.name ?? '',
    description: p?.description ?? '',
    priceCents: p?.priceCents ?? null,
    memberPriceCents: p?.memberPriceCents ?? null,
    trackInventory: p?.trackInventory ?? false,
    active: p?.active ?? true,
    isMembership: !!p?.membershipMonths,
    membershipMonths: p?.membershipMonths ?? '',
    membershipTier: p?.membershipTier ?? null,
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

const variantName = (v) => [v.size, v.color].filter(Boolean).join(' / ') || 'New variant'

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
    priceCents: v.priceCents ?? null,
    memberPriceCents: v.memberPriceCents ?? null,
    active: v.active,
    initialStock: v.id ? undefined : (v.initialStock === '' ? undefined : Number(v.initialStock)),
  }
}

async function save() {
  if (saving.value) return
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
      priceCents: f.priceCents,
      memberPriceCents: f.memberPriceCents,
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
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>
