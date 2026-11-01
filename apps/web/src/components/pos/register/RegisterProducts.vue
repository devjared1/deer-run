<template>
  <section class="flex flex-col min-h-0" aria-label="Products">
    <!-- Scan / search, custom item, categories -->
    <div class="flex-none px-4 pt-4 pb-1">
      <div class="flex items-start gap-2">
        <TextField
          ref="field"
          :model-value="search"
          label="Scan or search products"
          :leading-icon="IconBarcode"
          class="flex-1 min-w-0"
          type="text"
          :inputmode="keyboard ? 'search' : 'none'"
          enterkeyhint="search"
          autocomplete="off"
          spellcheck="false"
          aria-describedby="register-scan-message"
          @update:model-value="onInput"
          @keydown="onKeydown"
        >
          <template #trailing>
            <IconButton v-if="search" :icon="IconClose" label="Clear search" @click="clearSearch" />
            <IconButton
              :icon="keyboard ? IconKeyboardHide : IconKeyboard"
              label="Touch keyboard"
              toggle
              :selected="keyboard"
              tooltip
              @mousedown.prevent
              @click="toggleKeyboard"
            />
          </template>
        </TextField>
        <AppButton variant="outlined" size="lg" :icon="IconEditNote" class="hidden lg:inline-flex mt-1" @click="emit('custom')">
          Custom item
        </AppButton>
        <IconButton :icon="IconEditNote" label="Custom item" variant="outlined" class="lg:hidden mt-1" tooltip @click="emit('custom')" />
      </div>

      <div id="register-scan-message" role="status">
        <p v-if="message" :class="['flex items-center gap-2 px-1 pt-1 text-body-m', message.error ? 'text-error' : 'text-on-surface-variant']">
          <component :is="message.error ? IconError : IconInfo" class="w-5 h-5 flex-none" aria-hidden="true" />
          {{ message.text }}
        </p>
      </div>

      <ChipGroup
        v-if="categories.length"
        class="mt-1"
        :model-value="search ? null : activeCategoryId"
        type="choice"
        scroll
        size="lg"
        label="Category"
        :options="categoryOptions"
        @update:model-value="pickCategory"
      />
    </div>

    <!-- Products -->
    <div class="flex-1 min-h-0 md:overflow-y-auto overscroll-contain px-4 pt-2 pb-4">
      <p v-if="search && products.length" class="px-1 pb-2 text-label-l text-on-surface-variant">
        {{ products.length }} {{ products.length === 1 ? 'product matches' : 'products match' }} “{{ search.trim() }}”
      </p>
      <div v-if="products.length" class="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
        <button
          v-for="p in products"
          :key="p.id"
          type="button"
          :class="[
            'state-layer relative flex flex-col min-h-24 p-3 rounded-shape-md border text-left cursor-pointer select-none',
            'bg-surface-container-lowest border-outline-variant hover:shadow-elevation-1 transition-shadow duration-short-4',
          ]"
          @click="emit('choose', p)"
        >
          <span class="text-title-s text-on-surface line-clamp-2">{{ p.name }}</span>
          <span class="mt-auto pt-2 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <span class="text-body-l text-on-surface tabular-nums">{{ priceLabel(p) }}</span>
            <span v-if="isOutOfStock(p)" class="text-label-m text-error">Out of stock</span>
            <span v-else-if="p.variants.length > 1" class="text-label-m text-on-surface-variant">{{ p.variants.length }} options</span>
          </span>
        </button>
      </div>
      <EmptyState
        v-else
        compact
        :icon="IconInventory"
        :title="search ? `Nothing matches “${search.trim()}”` : 'No products in this category'"
        :message="search ? 'Check the code or search by name.' : ''"
      />
    </div>
  </section>
</template>

<script setup>
// The register's product side: the scan/search field (inputmode="none" so the touch keyboard stays down, with a
// keyboard toggle), Custom item, one scrolling row of category chips and the product tiles.
// Props: search (v-model:search), categories, activeCategoryId (v-model:active-category-id), products (already
// filtered by the parent), priceLabel(product), isOutOfStock(product), message ({ text, error } under the field).
// Emits: choose(product), enter (Enter in the field), custom. Exposes focus() and select().
import { computed, nextTick, ref } from 'vue'
import TextField from '@/components/ui/TextField.vue'
import IconButton from '@/components/ui/IconButton.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IconBarcode from '~icons/material-symbols/barcode-scanner-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconKeyboard from '~icons/material-symbols/keyboard-rounded'
import IconKeyboardHide from '~icons/material-symbols/keyboard-hide-rounded'
import IconEditNote from '~icons/material-symbols/edit-note-rounded'
import IconError from '~icons/material-symbols/error-rounded'
import IconInfo from '~icons/material-symbols/info-rounded'
import IconInventory from '~icons/material-symbols/inventory-2-rounded'

const props = defineProps({
  search:           { type: String, default: '' },
  categories:       { type: Array, default: () => [] },
  activeCategoryId: { type: String, default: null },
  products:         { type: Array, default: () => [] },
  priceLabel:       { type: Function, required: true },
  isOutOfStock:     { type: Function, required: true },
  message:          { type: Object, default: null },
})
const emit = defineEmits(['update:search', 'update:activeCategoryId', 'choose', 'enter', 'custom'])

const field = ref(null)
// The touch keyboard is off by default (scanner + tiles); the toggle brings it up for typing a search
const keyboard = ref(false)

const categoryOptions = computed(() => props.categories.map(c => ({ value: c.id, label: c.name })))

function onInput(value) {
  emit('update:search', value)
}

function onKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('enter')
  } else if (e.key === 'Escape' && props.search) {
    e.preventDefault()
    clearSearch()
  }
}

function clearSearch() {
  emit('update:search', '')
  field.value?.focus()
}

function pickCategory(id) {
  if (props.search) emit('update:search', '')
  emit('update:activeCategoryId', id)
}

// inputmode only takes effect on focus, so blur and refocus to show or hide the touch keyboard
async function toggleKeyboard() {
  keyboard.value = !keyboard.value
  const input = field.value?.$el?.querySelector('input')
  input?.blur()
  await nextTick()
  input?.focus()
}

defineExpose({
  focus: () => field.value?.focus(),
  select: () => field.value?.select(),
})
</script>
