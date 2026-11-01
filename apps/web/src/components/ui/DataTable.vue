<template>
  <div :aria-busy="loading ? 'true' : undefined">
    <!-- md and up: a real table, scrolling sideways inside this box when too wide (never the page) -->
    <div
      class="hidden md:block overflow-auto rounded-shape-md border border-outline-variant bg-surface"
      :style="maxHeight ? { maxHeight } : undefined"
    >
      <table class="w-full border-collapse text-left font-body text-body-m text-on-surface">
        <caption :class="captionVisible ? 'px-4 py-3 text-left text-title-m text-on-surface' : 'sr-only'">{{ caption }}</caption>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :aria-sort="col.sortable ? ariaSort(col) : undefined"
              :class="[
                'sticky top-0 z-[1] bg-surface-container border-b border-outline-variant text-label-l text-on-surface-variant whitespace-nowrap',
                ALIGN[col.align || 'left'],
                col.sortable ? 'p-0' : (dense ? 'px-3 py-2' : 'px-4 py-3'),
                col.class,
              ]"
            >
              <button
                v-if="col.sortable"
                type="button"
                :class="[
                  'state-layer group w-full inline-flex items-center gap-1 [outline-offset:-3px]',
                  dense ? 'px-3 min-h-[40px]' : 'px-4 min-h-touch',
                  col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start',
                  current.key === col.key ? 'text-on-surface' : '',
                ]"
                @click="toggleSort(col)"
              >
                <span>{{ col.label }}</span>
                <IconArrow
                  v-if="current.key === col.key"
                  :class="['w-[18px] h-[18px] transition-transform duration-short-4', current.dir === 'desc' ? 'rotate-180' : '']"
                  aria-hidden="true"
                />
                <IconUnsorted v-else class="w-[18px] h-[18px] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
              </button>
              <template v-else>{{ col.label }}</template>
            </th>
            <th
              v-if="$slots.actions"
              scope="col"
              :class="['sticky top-0 z-[1] bg-surface-container border-b border-outline-variant w-px', dense ? 'px-1' : 'px-2']"
            >
              <span class="sr-only">{{ actionsLabel }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <slot name="loading">
              <tr v-for="n in loadingRows" :key="`sk-${n}`" class="border-b border-outline-variant last:border-b-0" aria-hidden="true">
                <td v-for="col in allCols" :key="col.key" :class="dense ? 'px-3 py-3' : 'px-4 py-4'">
                  <div class="h-4 rounded-full bg-surface-container-highest animate-pulse" :class="n % 2 ? 'w-3/4' : 'w-1/2'" />
                </td>
              </tr>
            </slot>
          </template>
          <tr v-else-if="!rows.length">
            <td :colspan="allCols.length" class="px-4 py-10 text-center text-body-m text-on-surface-variant">
              <slot name="empty">{{ emptyText }}</slot>
            </td>
          </tr>
          <template v-else>
            <tr
              v-for="(row, i) in sortedRows"
              :key="keyOf(row, i)"
              :tabindex="interactive ? 0 : undefined"
              :aria-label="interactive ? labelOf(row) : undefined"
              :class="[
                'border-b border-outline-variant last:border-b-0',
                interactive ? 'cursor-pointer hover:bg-on-surface/[.08] focus-visible:bg-on-surface/[.10] [outline-offset:-3px]' : '',
              ]"
              @click="activate(row, $event)"
              @keydown.enter.space.self.prevent="activate(row, $event)"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                :class="[dense ? 'px-3 py-2' : 'px-4 py-3', ALIGN[col.align || 'left'], col === primaryCol ? 'font-bold' : '', col.class]"
              >
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :column="col">{{ display(row, col) }}</slot>
              </td>
              <td v-if="$slots.actions" :class="['text-right whitespace-nowrap', dense ? 'px-1 py-0' : 'px-2 py-1']" @click.stop @keydown.stop>
                <slot name="actions" :row="row" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Below md: a stacked list of cards (primary column as the headline, the rest as label/value pairs) -->
    <div class="md:hidden">
      <p v-if="captionVisible && caption" class="mb-2 text-title-m text-on-surface">{{ caption }}</p>
      <ul v-if="loading" class="space-y-2" aria-hidden="true">
        <li v-for="n in loadingRows" :key="`skc-${n}`" class="rounded-shape-md border border-outline-variant bg-surface p-4 space-y-3">
          <div class="h-5 w-1/2 rounded-full bg-surface-container-highest animate-pulse" />
          <div class="h-4 w-3/4 rounded-full bg-surface-container-highest animate-pulse" />
        </li>
      </ul>
      <div v-else-if="!rows.length" class="rounded-shape-md border border-outline-variant bg-surface px-4 py-10 text-center text-body-m text-on-surface-variant">
        <slot name="empty">{{ emptyText }}</slot>
      </div>
      <ul v-else class="space-y-2" :aria-label="caption || undefined">
        <li v-for="(row, i) in sortedRows" :key="keyOf(row, i)" class="relative rounded-shape-md border border-outline-variant bg-surface">
          <div
            :role="interactive ? (rowTo ? 'link' : 'button') : undefined"
            :tabindex="interactive ? 0 : undefined"
            :aria-label="interactive ? labelOf(row) : undefined"
            :class="[
              'rounded-shape-md p-4',
              $slots.actions ? 'pr-14' : '',
              interactive ? 'state-layer cursor-pointer' : '',
            ]"
            @click="activate(row, $event)"
            @keydown.enter.space.self.prevent="activate(row, $event)"
          >
            <div class="text-title-m text-on-surface break-words">
              <slot :name="`cell-${primaryCol.key}`" :row="row" :value="row[primaryCol.key]" :column="primaryCol">{{ display(row, primaryCol) }}</slot>
            </div>
            <dl v-if="cardCols.length" class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-m">
              <template v-for="col in cardCols" :key="col.key">
                <dt class="text-on-surface-variant">{{ col.label }}</dt>
                <dd class="min-w-0 break-words text-on-surface">
                  <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :column="col">{{ display(row, col) }}</slot>
                </dd>
              </template>
            </dl>
          </div>
          <div v-if="$slots.actions" class="absolute top-1 right-1">
            <slot name="actions" :row="row" />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
// Data table: sticky header, client-side sort, keyboard-reachable clickable rows, cards below md.
//   <DataTable :columns="cols" :rows="rows" row-key="id" v-model:sort="sort" caption="Bookings"
//              :row-to="row => `/admin/bookings/${row.id}`" @row-click="open">
//     <template #cell-status="{ row }"><StatusChip kind="booking" :status="row.status" size="sm" /></template>
//     <template #actions="{ row }"><RowActionsMenu … /></template>
//   </DataTable>
// columns: [{ key, label, align?: left|right|center, sortable?, class?, primary?, hideOnMobile?,
//             format?: (value, row) => text, sortValue?: row => value }]. The primary column (default: the first)
//   is the card headline below md and gives clickable rows their accessible name (or pass `rowLabel(row)`).
// Rows are clickable only with @row-click or `rowTo` (a function row → route): tabindex 0, Enter/Space, and
//   Ctrl/⌘-click opens a `rowTo` route in a new tab. Clicks in the actions cell never trigger the row.
// sort: { key, dir: 'asc'|'desc' } (v-model:sort optional). `manualSort` leaves the rows in order (server sort).
// maxHeight (e.g. '70vh') makes the table scroll inside itself so the sticky header stays visible.
// Slots: cell-<key> { row, value, column }, actions { row }, empty, loading (table rows). Props: dense, loading,
//   loadingRows, caption (sr-only unless captionVisible), emptyText, actionsLabel.
import { computed, ref, useSlots, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconArrow from '~icons/material-symbols/arrow-upward-rounded'
import IconUnsorted from '~icons/material-symbols/unfold-more-rounded'

const props = defineProps({
  columns:        { type: Array, required: true },
  rows:           { type: Array, default: () => [] },
  rowKey:         { type: [String, Function], default: 'id' },
  sort:           { type: Object, default: null },
  manualSort:     { type: Boolean, default: false },
  rowTo:          { type: Function, default: null },
  rowLabel:       { type: Function, default: null },
  // Declared as a prop so the table knows whether anyone listens to @row-click
  onRowClick:     { type: Function, default: null },
  loading:        { type: Boolean, default: false },
  loadingRows:    { type: Number, default: 5 },
  dense:          { type: Boolean, default: false },
  caption:        { type: String, default: '' },
  captionVisible: { type: Boolean, default: false },
  emptyText:      { type: String, default: 'Nothing to show' },
  actionsLabel:   { type: String, default: 'Actions' },
  maxHeight:      { type: String, default: null },
})
const emit = defineEmits(['update:sort'])
const router = useRouter()
const slots = useSlots()

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' }

const primaryCol = computed(() => props.columns.find(c => c.primary) || props.columns[0])
const cardCols = computed(() => props.columns.filter(c => c !== primaryCol.value && !c.hideOnMobile))
// Columns plus the actions column, for skeleton cells and the empty row's colspan
const allCols = computed(() => (slots.actions ? [...props.columns, { key: '__actions' }] : props.columns))
const interactive = computed(() => !!(props.onRowClick || props.rowTo))

const keyOf = (row, i) => (typeof props.rowKey === 'function' ? props.rowKey(row) : row[props.rowKey]) ?? i

function display(row, col) {
  const value = row[col.key]
  return col.format ? col.format(value, row) : value ?? ''
}
const labelOf = row => (props.rowLabel ? props.rowLabel(row) : String(display(row, primaryCol.value)))

// ── Sorting ──
const current = ref({ key: null, dir: 'asc', ...props.sort })
watch(() => props.sort, s => { current.value = { key: null, dir: 'asc', ...s } })

function toggleSort(col) {
  const dir = current.value.key === col.key && current.value.dir === 'asc' ? 'desc' : 'asc'
  current.value = { key: col.key, dir }
  emit('update:sort', { ...current.value })
}
function ariaSort(col) {
  if (current.value.key !== col.key) return 'none'
  return current.value.dir === 'desc' ? 'descending' : 'ascending'
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const sortedRows = computed(() => {
  const { key, dir } = current.value
  const col = props.columns.find(c => c.key === key)
  if (props.manualSort || !col) return props.rows
  const valueOf = col.sortValue || (row => row[key])
  const sign = dir === 'desc' ? -1 : 1
  return [...props.rows].sort((a, b) => {
    const x = valueOf(a)
    const y = valueOf(b)
    if (x == null || x === '') return y == null || y === '' ? 0 : 1 // empty values last either way
    if (y == null || y === '') return -1
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y))
    return cmp * sign
  })
})

// ── Row activation ──
function activate(row, event) {
  if (!interactive.value) return
  if (props.rowTo) {
    const to = props.rowTo(row)
    if (event?.ctrlKey || event?.metaKey) window.open(router.resolve(to).href, '_blank', 'noopener')
    else router.push(to)
  }
  props.onRowClick?.(row, event)
}
</script>
