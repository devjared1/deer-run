<template>
  <Card variant="outlined" tag="section" aria-labelledby="usage-title">
    <template #header>
      <div class="flex-1 min-w-0">
        <h3 id="usage-title" class="text-title-l text-on-surface">When the tee sheet fills</h3>
        <p class="text-body-m text-on-surface-variant">
          <template v-if="data">
            Paid players as a share of tee time capacity, last {{ data.weeks }} weeks ({{ range }}).
            Overall {{ pct(data.overall.share) }}.
          </template>
          <template v-else>Booked share by day and hour</template>
        </p>
      </div>
      <SegmentedButton :model-value="weeks" label="Period" :options="WEEK_OPTIONS" @update:model-value="setWeeks" />
    </template>

    <ErrorBanner v-if="error" :message="error" @retry="load" />
    <Skeleton v-else-if="!data" variant="rect" height="220px" label="Loading tee time usage" />
    <EmptyState v-else-if="!data.cells.length" compact :icon="IconGrid" title="No tee times in this period" />
    <template v-else>
      <div class="overflow-x-auto -mx-1 px-1">
        <table class="w-full border-separate border-spacing-1 text-label-m">
          <caption class="sr-only">Booked share of tee time capacity by weekday (rows) and hour (columns)</caption>
          <thead>
            <tr>
              <th scope="col" class="w-12"><span class="sr-only">Day</span></th>
              <th v-for="h in hours" :key="h" scope="col" class="px-1 pb-1 font-normal text-on-surface-variant whitespace-nowrap">
                {{ hourLabel(h) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in WEEKDAYS" :key="d.n">
              <th scope="row" class="pr-2 text-left font-normal text-on-surface-variant whitespace-nowrap">
                <abbr :title="d.long" class="no-underline">{{ d.short }}</abbr>
              </th>
              <td
                v-for="h in hours"
                :key="h"
                :class="['h-10 min-w-[2.75rem] rounded-shape-xs text-center tabular-nums', cellClass(cellAt(d.n, h))]"
              >
                <template v-if="cellAt(d.n, h)">{{ pct(cellAt(d.n, h).share) }}</template>
                <span v-else class="sr-only">No tee times</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-body-s text-on-surface-variant" aria-hidden="true">
        <span>Less full</span>
        <span v-for="b in BUCKETS" :key="b.min" :class="['inline-block w-6 h-4 rounded-shape-xs', b.cls]" />
        <span>Fuller</span>
        <span class="ml-3">Busiest: {{ busiest }}. Quietest: {{ quietest }}.</span>
      </div>
      <p class="sr-only">Busiest: {{ busiest }}. Quietest: {{ quietest }}.</p>
    </template>
  </Card>
</template>

<script setup>
// Dashboard: tee time usage heatmap (GET /api/admin/reports/teetime-usage): weekday × hour, booked share of capacity
// over the last 4 / 8 / 12 weeks. Each cell shows its percentage (not color alone), plus the busiest and quietest hour.
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatLocalDate } from '@/lib/timeclock'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import IconGrid from '~icons/material-symbols/grid-view-rounded'

// Monday first: the golf week reads better ending on the weekend
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map(n => {
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n]
  return { n, long, short: long.slice(0, 3) }
})
const WEEK_OPTIONS = [4, 8, 12].map(w => ({ value: w, label: `${w} wk` }))
// Literal class names (Tailwind only generates what it can see)
const BUCKETS = [
  { min: 0,   cls: 'bg-surface-container-high text-on-surface' },
  { min: 0.2, cls: 'bg-primary/20 text-on-surface' },
  { min: 0.4, cls: 'bg-primary/40 text-on-surface' },
  { min: 0.6, cls: 'bg-primary/70 text-on-primary' },
  { min: 0.8, cls: 'bg-primary text-on-primary' },
]

const data  = ref(null)
const error = ref(null)
const weeks = ref(8)

const byKey = computed(() => Object.fromEntries((data.value?.cells ?? []).map(c => [`${c.weekday}|${c.hour}`, c])))
const hours = computed(() => {
  const hs = (data.value?.cells ?? []).map(c => c.hour)
  if (!hs.length) return []
  const out = []
  for (let h = Math.min(...hs); h <= Math.max(...hs); h++) out.push(h)
  return out
})
const cellAt = (weekday, hour) => byKey.value[`${weekday}|${hour}`] ?? null
const pct = share => `${Math.round(share * 100)}%`
const hourLabel = h => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`
const cellClass = c => (c ? [...BUCKETS].reverse().find(b => c.share >= b.min).cls : 'bg-transparent')
const range = computed(() => {
  const f = d => formatLocalDate(d, { month: 'short', day: 'numeric' })
  return `${f(data.value.from)} – ${f(data.value.to)}`
})
const describe = c => `${WEEKDAYS.find(d => d.n === c.weekday).long} ${hourLabel(c.hour)} (${pct(c.share)})`
const ranked = computed(() => [...(data.value?.cells ?? [])].filter(c => c.capacity).sort((a, b) => b.share - a.share))
const busiest = computed(() => (ranked.value.length ? describe(ranked.value[0]) : ''))
const quietest = computed(() => (ranked.value.length ? describe(ranked.value[ranked.value.length - 1]) : ''))

async function load() {
  error.value = null
  try {
    data.value = await apiFetch(`/api/admin/reports/teetime-usage?weeks=${weeks.value}`)
  } catch (e) {
    error.value = e.message
  }
}

function setWeeks(w) {
  weeks.value = w
  data.value = null
  load()
}

onMounted(load)
defineExpose({ load })
</script>
