<template>
  <div>
    <CourseHero :tee-index="teeIndex" class="print:hidden" />

    <!-- Printed card header (the nav, hero and footer don't print) -->
    <div class="hidden print:block mb-2">
      <p class="font-display text-title-l text-on-surface">Deer Run Golf Course</p>
      <p class="text-body-s text-on-surface-variant">Moulton, Alabama · Par {{ par }}</p>
    </div>

    <div id="scorecard" class="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-5 scroll-mt-16 print:p-0 print:max-w-none">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 print:hidden">
        <div class="min-w-0">
          <p :id="teeLabelId" class="text-label-l text-on-surface-variant mb-1">Tees</p>
          <TeeSetSelector v-model="teeIndex" :tee-sets="teeSets" :label="'Tees'" />
        </div>
        <AppButton variant="outlined" :icon="IconPrint" class="sm:ml-auto self-start sm:self-auto" @click="printLandscape">
          Print scorecard
        </AppButton>
      </div>

      <CourseStatBar :tee-index="teeIndex" class="print:hidden" />

      <ScorecardTable :tee-index="teeIndex" />

      <!-- Visible legend for the hazard icons -->
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-body-m text-on-surface-variant print:text-[9pt]">
        <span class="text-label-l text-on-surface">Features</span>
        <HoleFeatureIcon
          v-for="f in FEATURE_LEGEND"
          :key="f.kind"
          :kind="f.kind"
          :label="f.label"
          show-label
          class="text-[20px] [&>span]:text-body-m"
        />
      </div>

      <div class="flex justify-center pt-4 print:hidden">
        <AppButton variant="gold" size="lg" to="/book" :trailing-icon="IconArrowForward">Book a tee time</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import CourseHero from '@/components/scorecard/CourseHero.vue'
import CourseStatBar from '@/components/scorecard/CourseStatBar.vue'
import HoleFeatureIcon, { FEATURE_LEGEND } from '@/components/scorecard/HoleFeatureIcon.vue'
import ScorecardTable from '@/components/scorecard/ScorecardTable.vue'
import TeeSetSelector from '@/components/scorecard/TeeSetSelector.vue'
import { useSelectedTee } from '@/components/scorecard/useSelectedTee'
import AppButton from '@/components/ui/AppButton.vue'
import { totalPar } from '@/data/holes'
import { teeSets } from '@/data/teeSets'
import { printLandscape } from '@/lib/print'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'

const teeIndex = useSelectedTee()
const par = totalPar()
const teeLabelId = 'tee-select-label'
</script>
