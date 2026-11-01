<template>
  <section
    class="space-y-3"
    aria-labelledby="course-map-title"
  >
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2
        id="course-map-title"
        class="font-display text-headline-s text-on-surface"
      >
        Where groups are
      </h2>
      <!-- Legend: fill = how the position is known, arrow + minutes = pace -->
      <ul
        class="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-m text-on-surface-variant"
        aria-label="Map legend"
      >
        <li class="flex items-center gap-2">
          <span
            class="inline-block w-8 h-6 rounded-shape-xs bg-primary-container"
            aria-hidden="true"
          />
          Reported in the last {{ FRESH_MINUTES }} min
        </li>
        <li class="flex items-center gap-2">
          <span
            class="estimate-hatch inline-block w-8 h-6 rounded-shape-xs border-2 border-dashed border-on-surface-variant bg-surface"
            aria-hidden="true"
          />
          Estimated
        </li>
        <li class="flex items-center gap-1.5">
          <IconBehind
            class="w-5 h-5"
            aria-hidden="true"
          />+min behind
          <IconAhead
            class="w-5 h-5 ml-2"
            aria-hidden="true"
          />−min ahead
        </li>
      </ul>
    </div>

    <div
      v-for="nine in NINES"
      :key="nine.label"
    >
      <h3 class="text-label-l text-on-surface-variant mb-1.5">
        {{ nine.label }}
      </h3>
      <div class="grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-9 gap-2">
        <template
          v-for="h in nine.holes"
          :key="h.hole"
        >
          <!-- The whole tile is the target when there's a group on it -->
          <button
            v-if="byHole.get(h.hole)?.length"
            type="button"
            class="state-layer flex flex-col items-stretch gap-1 min-h-[6rem] p-2 rounded-shape-md border-2 border-outline bg-surface-container-low text-left cursor-pointer"
            :aria-label="`Hole ${h.hole}, par ${h.par}: ${tileSummary(h.hole)}. Show groups`"
            @click="emit('select-hole', h.hole)"
          >
            <span class="flex flex-wrap items-baseline justify-between gap-x-1">
              <span class="font-display text-title-l text-on-surface leading-none">{{ h.hole }}</span>
              <span class="text-label-m text-on-surface-variant whitespace-nowrap">Par {{ h.par }}</span>
            </span>
            <span
              v-for="g in byHole.get(h.hole)"
              :key="g.booking.id"
              :class="[
                'flex flex-wrap items-center justify-between gap-x-1 min-h-[1.75rem] px-1.5 py-0.5 rounded-shape-xs border-2 text-label-l',
                isFresh(g.track) ? FRESH_FILL[tone(g)] : ['estimate-hatch border-dashed', ESTIMATE_OUTLINE[tone(g)]],
              ]"
              aria-hidden="true"
            >
              <span class="max-w-full truncate">{{ chipLabel(g.booking) }}</span>
              <span class="flex items-center ml-auto tabular-nums">
                <component
                  :is="PACE_ICONS[g.track.pace]"
                  class="w-4 h-4"
                />{{ g.track.pace === 'ON_PACE' ? '' : paceDelta(g.track.deltaMinutes) }}
              </span>
            </span>
          </button>
          <div
            v-else
            class="flex flex-col min-h-[6rem] p-2 rounded-shape-md border border-outline-variant bg-surface-container"
          >
            <span class="flex flex-wrap items-baseline justify-between gap-x-1">
              <span class="font-display text-title-l text-on-surface-variant leading-none">{{ h.hole }}</span>
              <span class="text-label-m text-on-surface-variant whitespace-nowrap">Par {{ h.par }}</span>
            </span>
            <span class="sr-only">No groups</span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup>
// The 18 holes as tiles, each group on a hole as a chip with its pace arrow and "+6" / "−4" minutes. A fresh report
// is a solid fill, an estimate is hatched with a dashed outline (see the legend). Tapping a tile with groups emits
// select-hole(hole) so the page can list them.
// groups: [{ booking, track }] on the course (track.state ON_COURSE).
import { computed } from 'vue'
import { holes } from '@/data/holes'
import { statusInfo } from '@/components/ui/statusChips'
import { ESTIMATE_OUTLINE, FRESH_FILL, FRESH_MINUTES, PACE_ICONS, chipLabel, isFresh, paceDelta, paceDisplay } from './paceDisplay'
import IconBehind from '~icons/material-symbols/trending-down-rounded'
import IconAhead from '~icons/material-symbols/trending-up-rounded'

const props = defineProps({
  groups: { type: Array, default: () => [] },
})
const emit = defineEmits(['select-hole'])

const NINES = [
  { label: 'Front nine', holes: holes.slice(0, 9) },
  { label: 'Back nine', holes: holes.slice(9) },
]

const byHole = computed(() => {
  const map = new Map()
  for (const g of props.groups) {
    if (!map.has(g.track.hole)) map.set(g.track.hole, [])
    map.get(g.track.hole).push(g)
  }
  return map
})

function tone(g) {
  return statusInfo('pace', g.track.pace).tone
}

function tileSummary(hole) {
  return byHole.value.get(hole)
    .map(g => `${g.booking.name}, ${paceDisplay(g.track.pace, g.track.deltaMinutes).long}, ${isFresh(g.track) ? 'reported' : 'estimated'}`)
    .join('; ')
}
</script>

<style scoped>
.estimate-hatch {
  background-image: repeating-linear-gradient(135deg, rgb(var(--md-sys-color-outline-variant) / .35) 0 2px, transparent 2px 8px);
}
/* High contrast darkens outline-variant: keep the hatch light so the text stays readable */
[data-contrast="high"] .estimate-hatch {
  background-image: repeating-linear-gradient(135deg, rgb(var(--md-sys-color-outline-variant) / .2) 0 2px, transparent 2px 8px);
}
</style>
