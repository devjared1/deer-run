<template>
  <div class="page-enter">
    <PageHero
      label="The Course"
      title-html="Deer Run <em>Scorecard</em>"
      subtitle="18 holes · Par 72 · Earl Stone Design · Moulton, Alabama"
      bg-image="/images/course-3.jpg"
    />

    <section class="topo py-12">
      <div class="max-w-5xl mx-auto px-5 space-y-6">
        <TeeSetSelector :tee-sets="teeSets" v-model="activeTeeIndex" />
        <CourseStatBar :tee-set="teeSets[activeTeeIndex]" />
        <ScorecardTable
          :holes="frontNine"
          :active-tee-index="activeTeeIndex"
          label="OUT"
        />
        <ScorecardTable
          :holes="backNine"
          :active-tee-index="activeTeeIndex"
          label="IN"
          show-grand-total
          :grand-total="grandTotal"
        />

        <!-- Legend -->
        <div class="card rounded-lg p-5">
          <div style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(61,43,26,.4);margin-bottom:10px;">Course Features</div>
          <div class="flex flex-wrap gap-5 text-sm" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.55);">
            <span class="flex items-center gap-1.5">🌊 Water hazard</span>
            <span class="flex items-center gap-1.5">⛱ Bunker(s)</span>
            <span class="flex items-center gap-1.5">⛰ Elevated terrain</span>
            <span class="flex items-center gap-1.5">⭐ Signature hole</span>
            <span class="flex items-center gap-1.5" style="color:#4A6670;font-weight:700;">Par 3</span>
            <span class="flex items-center gap-1.5" style="color:#8C4A2F;font-weight:700;">Par 5</span>
          </div>
        </div>

        <!-- Book CTA -->
        <div class="text-center py-6">
          <RouterLink to="/book" class="btn-amber">Book a Tee Time →</RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed }    from 'vue'
import PageHero             from '@/components/layout/PageHero.vue'
import TeeSetSelector       from '@/components/scorecard/TeeSetSelector.vue'
import CourseStatBar        from '@/components/scorecard/CourseStatBar.vue'
import ScorecardTable       from '@/components/scorecard/ScorecardTable.vue'
import { holes, frontNine, backNine } from '@/data/holes'
import { teeSets, defaultTeeIndex }   from '@/data/teeSets'

const activeTeeIndex = ref(defaultTeeIndex)

const grandTotal = computed(() =>
  holes.reduce((sum, h) => sum + h.yards[activeTeeIndex.value], 0)
)
</script>
