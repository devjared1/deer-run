<template>
  <nav v-if="count > 1" :aria-label="label" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-body">
    <p v-if="rangeText" class="text-body-m text-on-surface-variant">{{ rangeText }}</p>
    <div class="flex items-center gap-1 ml-auto">
      <IconButton :icon="IconPrev" label="Previous page" :disabled="page <= 1" @click="go(page - 1)" />

      <p class="md:hidden px-2 text-label-l text-on-surface whitespace-nowrap" aria-live="polite">Page {{ page }} of {{ count }}</p>

      <ul class="hidden md:flex items-center gap-1">
        <li v-for="(item, i) in items" :key="`${item}-${i}`">
          <span v-if="item === '…'" class="inline-flex w-8 justify-center text-on-surface-variant" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            :aria-label="`Page ${item}`"
            :aria-current="item === page ? 'page' : undefined"
            :class="[
              'state-layer touch-target inline-flex items-center justify-center min-w-[40px] h-10 px-2 rounded-full text-label-l',
              item === page ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant',
            ]"
            @click="go(item)"
          >
            {{ item }}
          </button>
        </li>
      </ul>

      <IconButton :icon="IconNext" label="Next page" :disabled="page >= count" @click="go(page + 1)" />
    </div>
  </nav>
</template>

<script setup>
// Pagination: 48dp previous/next buttons and "Page 3 of 12"; page number buttons (with … gaps) from md up.
//   <AppPagination v-model:page="page" :page-count="12" />
//   <AppPagination v-model:page="page" :total="312" :page-size="50" />   (also shows "51–100 of 312")
// Renders nothing with a single page. `label` is the nav landmark's aria-label (default "Pagination").
import { computed } from 'vue'
import IconButton from './IconButton.vue'
import IconPrev from '~icons/material-symbols/chevron-left-rounded'
import IconNext from '~icons/material-symbols/chevron-right-rounded'

const props = defineProps({
  page:      { type: Number, default: 1 },
  pageCount: { type: Number, default: null },
  total:     { type: Number, default: null },
  pageSize:  { type: Number, default: 25 },
  label:     { type: String, default: 'Pagination' },
})
const emit = defineEmits(['update:page'])

const count = computed(() => props.pageCount ?? Math.max(1, Math.ceil((props.total || 0) / props.pageSize)))

const rangeText = computed(() => {
  if (props.total == null) return ''
  const first = (props.page - 1) * props.pageSize + 1
  const last = Math.min(props.total, props.page * props.pageSize)
  return `${first.toLocaleString()}–${last.toLocaleString()} of ${props.total.toLocaleString()}`
})

// 1 … 4 5 6 … 12: the first and last page, two around the current one, gaps as "…"
const items = computed(() => {
  const n = count.value
  const p = props.page
  const pages = [...new Set([1, n, p - 1, p, p + 1].filter(x => x >= 1 && x <= n))].sort((a, b) => a - b)
  const out = []
  pages.forEach((x, i) => {
    if (i && x - pages[i - 1] === 2) out.push(x - 1) // a gap of one page: show it rather than "…"
    else if (i && x - pages[i - 1] > 2) out.push('…')
    out.push(x)
  })
  return out
})

function go(p) {
  const next = Math.min(count.value, Math.max(1, p))
  if (next !== props.page) emit('update:page', next)
}
</script>
