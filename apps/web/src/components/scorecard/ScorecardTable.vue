<template>
  <div class="rounded-shape-md bg-surface-container-lowest shadow-elevation-1 print:shadow-none">
    <!-- Visible title (the <caption> says the same for screen readers; a caption would scroll away with the table) -->
    <div class="px-4 pt-4 pb-3 print:px-0 print:pt-0" aria-hidden="true">
      <p class="text-title-m text-on-surface">Scorecard</p>
      <p class="text-body-s text-on-surface-variant">
        Par {{ par.total }} · yardages in yards · {{ teeSets[teeIndex].name }} tees highlighted<span class="print:hidden"> · select a hole number for its page</span>
      </p>
    </div>
    <!-- The table scrolls inside this container (never the page); the row labels stay put. `relative` keeps the
         sr-only text inside the scroll box (an absolute element would otherwise widen the page). -->
    <div
      class="relative overflow-x-auto overscroll-x-contain rounded-b-shape-md print:overflow-visible"
      tabindex="0"
      role="region"
      :aria-labelledby="captionId"
    >
      <table class="w-full border-collapse text-body-m tabular-nums text-on-surface print:text-[9pt]">
        <caption :id="captionId" class="sr-only">
          Scorecard, par {{ par.total }}, yardages in yards; {{ teeSets[teeIndex].name }} tees highlighted
        </caption>

        <thead>
          <tr class="bg-primary text-on-primary [print-color-adjust:exact]">
            <th scope="col" :class="[STICKY, 'bg-primary text-left text-label-l']">Hole</th>
            <template v-for="col in columns" :key="col.key">
              <th v-if="col.hole" scope="col" class="p-0 text-label-l">
                <RouterLink
                  :to="`/course/hole/${col.hole.hole}`"
                  class="state-layer flex items-center justify-center min-w-[2.75rem] h-11 text-on-primary no-underline print:min-w-0 print:h-7"
                >
                  <span aria-hidden="true">{{ col.hole.hole }}</span>
                  <span class="sr-only">Hole {{ col.hole.hole }}, {{ col.hole.name }}</span>
                </RouterLink>
              </th>
              <th v-else scope="col" class="px-2 min-w-[3.5rem] bg-on-primary-container text-label-l uppercase [print-color-adjust:exact] print:min-w-0">
                {{ col.label }}
              </th>
            </template>
          </tr>
        </thead>

        <tbody>
          <!-- One row per tee set -->
          <tr
            v-for="(tee, t) in teeSets"
            :key="tee.name"
            :class="['border-b border-outline-variant', t === teeIndex ? SELECTED : '']"
          >
            <th scope="row" :class="[STICKY, 'text-left font-bold', t === teeIndex ? SELECTED : 'bg-surface-container-lowest']">
              <span class="flex items-center gap-2">
                <TeeSwatch :tee="tee" class="w-3 h-3" />
                {{ tee.name }}
                <span v-if="t === teeIndex" class="sr-only">(selected)</span>
              </span>
            </th>
            <td
              v-for="col in columns"
              :key="col.key"
              :class="[CELL, col.hole ? '' : TOTAL_CELL, col.hole || t === teeIndex ? '' : 'bg-surface-container-high']"
            >
              {{ col.hole ? col.hole.yards[t] : yards(t, col.list).toLocaleString('en-US') }}
            </td>
          </tr>

          <!-- Par -->
          <tr class="border-b border-outline-variant bg-surface-container-high font-bold">
            <th scope="row" :class="[STICKY, 'bg-surface-container-high text-left']">Par</th>
            <td v-for="col in columns" :key="col.key" :class="[CELL, col.hole ? '' : TOTAL_CELL]">
              {{ col.hole ? col.hole.par : parOf(col.list) }}
            </td>
          </tr>

          <!-- Handicap (men's and ladies' when the data has both) -->
          <tr v-for="row in handicapRows" :key="row.key" class="border-b border-outline-variant">
            <th scope="row" :class="[STICKY, 'bg-surface-container-lowest text-left font-normal text-on-surface-variant']">
              {{ row.label }}
            </th>
            <td v-for="col in columns" :key="col.key" :class="[CELL, 'text-on-surface-variant', col.hole ? '' : 'bg-surface-container-high']">
              {{ col.hole ? col.hole[row.key] : '' }}
            </td>
          </tr>

          <!-- Hazards -->
          <tr>
            <th scope="row" :class="[STICKY, 'bg-surface-container-lowest text-left font-normal text-on-surface-variant']">
              Features
            </th>
            <td
              v-for="col in columns"
              :key="col.key"
              :class="['px-1 py-2 align-top text-center', col.hole ? '' : 'bg-surface-container-high']"
            >
              <span v-if="col.hole" class="inline-flex flex-col items-center gap-1 text-[18px] leading-none print:text-[11px]">
                <HoleFeatureIcon v-for="f in holeFeatures(col.hole)" :key="f.key" :kind="f.key" :label="f.label" />
                <span v-if="!holeFeatures(col.hole).length" class="sr-only">None</span>
              </span>
            </td>
          </tr>

          <!-- Printed card only: blank score rows -->
          <tr v-for="p in 4" :key="`player-${p}`" class="hidden print:table-row border-t border-outline-variant">
            <th scope="row" :class="[STICKY, 'text-left font-normal h-8']">Player {{ p }}</th>
            <td v-for="col in columns" :key="col.key" class="border-l border-outline-variant" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
let uid = 0
</script>

<script setup>
// The standard scorecard: holes 1–9, OUT, 10–18, IN, TOTAL across; a row per tee set (the selected one highlighted),
// par, handicap (men's and ladies' when data/holes.js has both) and hazard icons. Every total is computed from the
// hole data. On narrow screens the table scrolls inside its container with the row labels sticky. Prints as a
// landscape card with blank player rows.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { backNine, frontNine, hasLadiesHandicap, holeFeatures, holes, totalPar, totalYards } from '@/data/holes'
import { teeSets } from '@/data/teeSets'
import HoleFeatureIcon from './HoleFeatureIcon.vue'
import TeeSwatch from './TeeSwatch.vue'

defineProps({
  teeIndex: { type: Number, required: true },
})

const captionId = `scorecard-caption-${++uid}`

const STICKY = 'sticky left-0 z-[1] px-3 py-2 whitespace-nowrap min-w-[5.5rem] shadow-[1px_0_0_rgb(var(--md-sys-color-outline-variant))] print:static print:shadow-none print:min-w-0 print:px-1'
const CELL = 'px-1 py-2 text-center print:py-1'
const TOTAL_CELL = 'font-bold'
// AA: on-gold-container on gold-container
const SELECTED = 'bg-gold-container text-on-gold-container font-bold [print-color-adjust:exact]'

const columns = [
  ...frontNine.map(h => ({ key: h.hole, hole: h })),
  { key: 'out', label: 'Out', list: frontNine },
  ...backNine.map(h => ({ key: h.hole, hole: h })),
  { key: 'in', label: 'In', list: backNine },
  { key: 'total', label: 'Total', list: holes },
]

const par = computed(() => ({ total: totalPar() }))
const parOf = list => totalPar(list)
const yards = (t, list) => totalYards(t, list)

const handicapRows = hasLadiesHandicap
  ? [{ key: 'hdcp', label: "Men's hcp" }, { key: 'hdcpLadies', label: "Ladies' hcp" }]
  : [{ key: 'hdcp', label: 'Handicap' }]
</script>
