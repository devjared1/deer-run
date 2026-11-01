<template>
  <article
    v-if="hole"
    class="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-10 md:pt-6 touch-pan-y"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="swipe = null"
  >
    <AppButton variant="text" :icon="IconArrowBack" to="/scorecard" class="-ml-3">Back to scorecard</AppButton>

    <!-- Header: number, name, par, handicap; previous / next -->
    <header class="mt-3 flex items-start gap-3">
      <span
        class="flex-none flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary text-on-primary font-display text-headline-s md:text-headline-m tabular-nums"
        aria-hidden="true"
      >{{ hole.hole }}</span>
      <div class="flex-1 min-w-0">
        <p class="text-label-l uppercase tracking-[.15em] text-gold-text">Hole {{ hole.hole }} of {{ holes.length }}</p>
        <h1 class="font-display text-headline-m md:text-display-s text-on-surface break-words">
          <span class="sr-only">Hole {{ hole.hole }}: </span>{{ hole.name }}
        </h1>
      </div>
      <nav class="flex-none hidden sm:flex items-center gap-1" aria-label="Holes">
        <IconButton :icon="IconChevronLeft" variant="outlined" :label="prev ? `Previous: hole ${prev.hole}` : 'No previous hole'" :disabled="!prev" @click="go(prev)" />
        <IconButton :icon="IconChevronRight" variant="outlined" :label="next ? `Next: hole ${next.hole}` : 'No next hole'" :disabled="!next" @click="go(next)" />
      </nav>
    </header>

    <dl class="mt-4 grid grid-cols-3 max-w-md rounded-shape-md bg-surface-container-low shadow-elevation-1 divide-x divide-outline-variant">
      <div v-for="s in facts" :key="s.label" class="flex flex-col-reverse items-center py-3 px-1 text-center">
        <dt class="text-label-m uppercase tracking-wider text-on-surface-variant">{{ s.label }}</dt>
        <dd class="font-display text-headline-s text-on-surface tabular-nums">{{ s.value }}</dd>
      </div>
    </dl>

    <p v-if="hole.description" class="mt-4 max-w-prose text-body-l text-on-surface">{{ hole.description }}</p>

    <div v-if="hole.photo" class="mt-5 overflow-hidden rounded-shape-md">
      <ResponsivePicture :name="hole.photo" sizes="(min-width: 1024px) 960px, 100vw" img-class="w-full h-auto" />
    </div>

    <div class="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem] lg:grid-cols-[minmax(0,1fr)_16rem] md:items-start">
      <div class="space-y-6 min-w-0">
        <!-- Yardage per tee -->
        <section aria-labelledby="yardage-heading">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 id="yardage-heading" class="text-title-l text-on-surface">Yardage</h2>
            <TeeSetSelector v-model="teeIndex" :tee-sets="teeSets" label="Highlight tees" />
          </div>
          <ul class="grid grid-cols-2 sm:grid-cols-4 gap-2" role="list">
            <!-- Highlighted tee: gold-text border (the brand gold is under 3:1 on light surfaces) -->
            <li
              v-for="(tee, i) in teeSets"
              :key="tee.name"
              :class="[
                'flex flex-col rounded-shape-md px-3 py-2 border',
                i === teeIndex ? 'bg-gold-container text-on-gold-container border-gold-text' : 'bg-surface-container-lowest text-on-surface border-outline-variant',
              ]"
            >
              <span class="flex items-center gap-2 text-label-l">
                <TeeSwatch :tee="tee" class="w-3 h-3" />{{ tee.name }}
                <span v-if="i === teeIndex" class="sr-only">(highlighted)</span>
              </span>
              <span class="font-display text-headline-s tabular-nums">{{ hole.yards[i] }}<span class="ml-1 font-body text-body-m">yds</span></span>
            </li>
          </ul>
        </section>

        <!-- Hazards and features -->
        <section aria-labelledby="features-heading">
          <h2 id="features-heading" class="text-title-l text-on-surface mb-3">On this hole</h2>
          <ul v-if="features.length" class="flex flex-wrap gap-2" role="list">
            <li
              v-for="f in features"
              :key="f.key"
              class="inline-flex items-center h-10 px-3 rounded-shape-sm border border-outline-variant bg-surface-container-lowest text-label-l text-on-surface"
            >
              <HoleFeatureIcon :kind="f.key" :label="f.label" show-label class="[&>svg]:w-5 [&>svg]:h-5" />
            </li>
          </ul>
          <p v-else class="text-body-m text-on-surface-variant">No water, bunkers or other features are listed for this hole.</p>
        </section>

        <!-- Pro tip (only when the course has written one) -->
        <section v-if="hole.tip" aria-labelledby="tip-heading" class="rounded-shape-md bg-secondary-container text-on-secondary-container p-4">
          <h2 id="tip-heading" class="flex items-center gap-2 text-title-m">
            <IconSportsGolf class="w-5 h-5" aria-hidden="true" />Pro tip
          </h2>
          <p class="mt-1 text-body-l">{{ hole.tip }}</p>
        </section>
      </div>

      <div class="rounded-shape-md bg-surface-container-lowest border border-outline-variant p-4">
        <HoleDiagram :hole="hole" :tee-index="teeIndex" />
      </div>
    </div>

    <!-- Previous / next -->
    <nav class="mt-8 grid grid-cols-2 gap-3" aria-label="Previous and next hole">
      <Card v-if="prev" :to="`/course/hole/${prev.hole}`" variant="outlined" padding="sm">
        <span class="flex items-center gap-2">
          <IconChevronLeft class="flex-none w-6 h-6 text-on-surface-variant" aria-hidden="true" />
          <span class="min-w-0">
            <span class="block text-label-m text-on-surface-variant">Previous · Hole {{ prev.hole }}</span>
            <span class="block text-title-m text-on-surface truncate">{{ prev.name }}</span>
          </span>
        </span>
      </Card>
      <span v-else />
      <Card :to="next ? `/course/hole/${next.hole}` : '/scorecard'" variant="outlined" padding="sm">
        <span class="flex items-center justify-end gap-2 text-right">
          <span class="min-w-0">
            <span class="block text-label-m text-on-surface-variant">{{ next ? `Next · Hole ${next.hole}` : 'Back to the' }}</span>
            <span class="block text-title-m text-on-surface truncate">{{ next ? next.name : 'Scorecard' }}</span>
          </span>
          <IconChevronRight class="flex-none w-6 h-6 text-on-surface-variant" aria-hidden="true" />
        </span>
      </Card>
    </nav>
    <p class="mt-3 text-center text-body-s text-on-surface-variant">Swipe left or right, or use the arrow keys, to change holes.</p>
  </article>
</template>

<script setup>
// One hole of the course (/course/hole/:n, 1–18 checked by the router): par, handicap, yardage per tee, features,
// a schematic diagram, and the optional description / photo / pro tip from data/holes.js when the course has
// supplied them. Previous/next by buttons, swipe (pointer events) and the arrow keys.
import { useHead } from '@unhead/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HoleDiagram from '@/components/scorecard/HoleDiagram.vue'
import HoleFeatureIcon from '@/components/scorecard/HoleFeatureIcon.vue'
import TeeSetSelector from '@/components/scorecard/TeeSetSelector.vue'
import TeeSwatch from '@/components/scorecard/TeeSwatch.vue'
import { useSelectedTee } from '@/components/scorecard/useSelectedTee'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import IconButton from '@/components/ui/IconButton.vue'
import ResponsivePicture from '@/components/ui/ResponsivePicture.vue'
import { getHole, hasLadiesHandicap, holeFeatures, holes } from '@/data/holes'
import { teeSets } from '@/data/teeSets'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconChevronLeft from '~icons/material-symbols/chevron-left-rounded'
import IconChevronRight from '~icons/material-symbols/chevron-right-rounded'
import IconSportsGolf from '~icons/material-symbols/sports-golf-rounded'

const route = useRoute()
const router = useRouter()
const teeIndex = useSelectedTee()

const hole = computed(() => getHole(route.params.n))
const prev = computed(() => (hole.value ? getHole(hole.value.hole - 1) : null))
const next = computed(() => (hole.value ? getHole(hole.value.hole + 1) : null))
const features = computed(() => (hole.value ? holeFeatures(hole.value) : []))

const facts = computed(() => {
  const h = hole.value
  const list = [{ label: 'Par', value: h.par }]
  if (hasLadiesHandicap) list.push({ label: "Men's hcp", value: h.hdcp }, { label: "Ladies' hcp", value: h.hdcpLadies })
  else list.push({ label: 'Handicap', value: h.hdcp })
  list.push({ label: `${teeSets[teeIndex.value].name} yds`, value: h.yards[teeIndex.value] })
  return list
})

useHead({
  title: computed(() => (hole.value ? `Hole ${hole.value.hole} · ${hole.value.name} · Deer Run Golf Course` : undefined)),
  meta: [{
    name: 'description',
    content: computed(() => {
      const h = hole.value
      if (!h) return undefined
      return `Hole ${h.hole} at Deer Run Golf Course: par ${h.par}, ${Math.min(...h.yards)}–${Math.max(...h.yards)} yards, handicap ${h.hdcp}.`
    }),
  }],
})

function go(target) {
  if (target) router.push(`/course/hole/${target.hole}`)
}

// Swipe: a mostly horizontal touch/pen drag of 60px or more (touch-pan-y keeps vertical scrolling native)
const swipe = ref(null)
function onPointerDown(e) {
  if (e.pointerType === 'mouse' || !e.isPrimary) return
  swipe.value = { x: e.clientX, y: e.clientY, t: e.timeStamp }
}
function onPointerUp(e) {
  const s = swipe.value
  swipe.value = null
  if (!s) return
  const dx = e.clientX - s.x
  const dy = e.clientY - s.y
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || e.timeStamp - s.t > 800) return
  go(dx < 0 ? next.value : prev.value)
}

// Arrow keys, unless focus is in a field or a radio group (which uses the arrows itself)
function onKeydown(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const el = e.target
  if (el instanceof Element && el.closest('input, textarea, select, [contenteditable], [role="radiogroup"], [role="slider"], [role="tablist"]')) return
  go(e.key === 'ArrowLeft' ? prev.value : next.value)
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
