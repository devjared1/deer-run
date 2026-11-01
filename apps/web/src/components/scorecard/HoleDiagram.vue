<template>
  <figure class="m-0">
    <svg
      :viewBox="`0 0 ${W} ${height}`"
      class="block mx-auto w-full h-auto max-w-[12rem] md:max-w-[14rem]"
      role="img"
      :aria-label="ariaLabel"
    >
      <!-- Rough corridor, then fairway (par 4 and 5), carry line on a par 3 -->
      <polyline :points="line(path)" fill="none" class="stroke-success/15" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" />
      <polyline
        v-if="fairway"
        :points="line(fairway)"
        fill="none"
        class="stroke-success/35"
        stroke-width="30"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <polyline
        v-else
        :points="line(path)"
        fill="none"
        class="stroke-on-surface-variant/50"
        stroke-width="1.5"
        stroke-dasharray="4 5"
      />

      <!-- Distance markers (yards to the middle of the green) -->
      <g v-for="m in markers" :key="m.yards">
        <line :x1="m.x - 18" :y1="m.y" :x2="m.x + 18" :y2="m.y" class="stroke-on-surface-variant/60" stroke-width="1" />
        <text :x="m.x + (m.side > 0 ? 24 : -24)" :y="m.y + 3.5" :text-anchor="m.side > 0 ? 'start' : 'end'" class="fill-on-surface-variant text-[10px] font-body">
          {{ m.yards }}
        </text>
      </g>

      <!-- Green, flag -->
      <circle :cx="green.x" :cy="green.y" r="20" class="fill-success/25" />
      <circle :cx="green.x" :cy="green.y" r="14" class="fill-success/60" />
      <line :x1="green.x" :y1="green.y" :x2="green.x" :y2="green.y - 26" class="stroke-on-surface" stroke-width="1.5" />
      <path :d="`M${green.x} ${green.y - 26} l12 4 l-12 4 z`" class="fill-tertiary" />

      <!-- Tee boxes, front to back; the selected tee is larger and outlined -->
      <g v-for="t in teeMarks" :key="t.name">
        <rect
          :x="t.x - (t.selected ? 9 : 6)"
          :y="t.y - (t.selected ? 5 : 3.5)"
          :width="t.selected ? 18 : 12"
          :height="t.selected ? 10 : 7"
          rx="2"
          :class="[t.fillClass, t.selected ? 'stroke-on-surface' : 'stroke-surface']"
          :stroke-width="t.selected ? 2 : 1"
        />
      </g>
    </svg>
    <figcaption class="mt-2 text-body-s text-on-surface-variant">
      Illustration, not a course map: the length is to scale from the yardages{{ hole.dogleg ? ' and the bend is approximate' : '' }}.
      Hazards aren't placed on it. Ticks show yards to the middle of the green.
    </figcaption>
  </figure>
</template>

<script setup>
// Schematic of a hole drawn from data/holes.js: tee boxes (one per tee set, at its yardage) → fairway → green,
// with the length proportional to the yardage (the same scale for every hole, so a par 3 is visibly short). A
// `dogleg` ('left' | 'right') bends the line; hazards have no positions in the data, so they aren't drawn.
import { computed } from 'vue'
import { holes } from '@/data/holes'
import { teeSets } from '@/data/teeSets'

const props = defineProps({
  hole:     { type: Object, required: true },
  teeIndex: { type: Number, default: 0 },
})

const W = 200
const TOP = 46            // green center
const BOTTOM_PAD = 24
const MAX_LEN = 470       // user units for the longest hole on the course
const LONGEST = Math.max(...holes.map(h => Math.max(...h.yards)))
const scale = MAX_LEN / LONGEST

const backYards = computed(() => Math.max(...props.hole.yards))
const length = computed(() => backYards.value * scale)
const height = computed(() => Math.round(TOP + length.value + BOTTOM_PAD))

// The centre line from the back tee to the green: [tee, (corner), green]
const path = computed(() => {
  const L = length.value
  const dir = props.hole.dogleg === 'left' ? -1 : props.hole.dogleg === 'right' ? 1 : 0
  if (!dir) return [{ x: W / 2, y: TOP + L }, { x: W / 2, y: TOP }]
  // Straight off the tee for ~60% (at most a 250-yard drive), then bend toward the green
  const a = Math.min(L * 0.6, 250 * scale)
  const b = L - a
  const off = dir * Math.min(56, b * 0.6)
  const rise = Math.sqrt(b * b - off * off)
  const teeX = W / 2 - off
  const cornerY = TOP + rise
  return [{ x: teeX, y: cornerY + a }, { x: teeX, y: cornerY }, { x: W / 2, y: TOP }]
})
const green = computed(() => path.value[path.value.length - 1])

// The point `d` units back from the green along the path, and which side has room for a label
function pointFromGreen(d) {
  const pts = [...path.value].reverse()
  let left = d
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1]
    const seg = Math.hypot(q.x - p.x, q.y - p.y)
    if (left <= seg || i === pts.length - 2) {
      const f = seg ? Math.min(left / seg, 1) : 0
      return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f }
    }
    left -= seg
  }
  return pts[pts.length - 1]
}

const teeMarks = computed(() => teeSets
  .map((tee, i) => ({ ...tee, i, yards: props.hole.yards[i], selected: i === props.teeIndex, ...pointFromGreen(props.hole.yards[i] * scale) }))
  // Draw the selected tee last so it sits on top
  .sort((a, b) => Number(a.selected) - Number(b.selected)))

// Fairway on par 4/5: from ~40% of the way out from the forward tee to just short of the green
const fairway = computed(() => {
  if (props.hole.par < 4) return null
  const front = Math.min(...props.hole.yards)
  const start = front * 0.62 * scale
  const end = 22 * scale
  const pts = [pointFromGreen(start)]
  // Keep the corner of a dogleg
  if (path.value.length === 3) {
    const cornerDist = Math.hypot(path.value[1].x - green.value.x, path.value[1].y - green.value.y)
    if (cornerDist < start) pts.push(path.value[1])
  }
  pts.push(pointFromGreen(end))
  return pts
})

// 100 / 150 / 200 / 250 yards to the green, where the hole is longer than that from the selected tee
const markers = computed(() => [100, 150, 200, 250]
  .filter(y => y < props.hole.yards[props.teeIndex] - 30)
  .map((y) => {
    const p = pointFromGreen(y * scale)
    return { yards: y, ...p, side: p.x <= W / 2 ? 1 : -1 }
  }))

const line = pts => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

const ariaLabel = computed(() => {
  const h = props.hole
  const yards = teeSets.map((t, i) => `${t.name} ${h.yards[i]}`).join(', ')
  const shape = h.dogleg ? `dogleg ${h.dogleg}` : 'drawn straight'
  return `Illustration of hole ${h.hole}, par ${h.par}, ${shape}: tee boxes at ${yards} yards from the green.`
})
</script>
