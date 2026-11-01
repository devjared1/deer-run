<template>
  <div>
    <PageHero
      label="Deer Run"
      title-html="The <em>Course</em>"
      :description="`18 holes · Par ${par} · Earl Stone design · Moulton, Alabama`"
      photo="course-hero"
      height="0px"
      classes="print:hidden"
    />

    <!-- Printed card header (the nav, hero and footer don't print) -->
    <div class="hidden print:block mb-2">
      <p class="font-display text-title-l text-on-surface">Deer Run Golf Course</p>
      <p class="text-body-s text-on-surface-variant">Moulton, Alabama · Par {{ par }}</p>
    </div>

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-5 print:p-0 print:max-w-none">
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

      <!-- Hole by hole -->
      <section aria-labelledby="holes-heading" class="pt-4 print:hidden">
        <h2 id="holes-heading" class="font-display text-headline-s text-on-surface mb-3">Hole by hole</h2>
        <ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          <li v-for="h in holes" :key="h.hole">
            <Card :to="`/course/hole/${h.hole}`" variant="outlined" padding="sm" class="h-full">
              <div class="flex items-center gap-3">
                <span class="flex-none flex items-center justify-center w-10 h-10 rounded-full bg-primary text-on-primary text-title-s tabular-nums" aria-hidden="true">
                  {{ h.hole }}
                </span>
                <span class="flex-1 min-w-0">
                  <span class="block text-title-m text-on-surface truncate">
                    <span class="sr-only">Hole {{ h.hole }}: </span>{{ h.name }}
                  </span>
                  <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-m text-on-surface-variant tabular-nums">
                    <span>Par {{ h.par }} · {{ h.yards[teeIndex] }} yds · Hcp {{ h.hdcp }}</span>
                    <span class="inline-flex items-center gap-1 text-[18px]">
                      <HoleFeatureIcon v-for="f in holeFeatures(h)" :key="f.key" :kind="f.key" :label="f.label" />
                    </span>
                  </span>
                </span>
                <IconChevronRight class="flex-none w-5 h-5 text-on-surface-variant" aria-hidden="true" />
              </div>
            </Card>
          </li>
        </ol>
      </section>

      <div class="flex justify-center pt-4 print:hidden">
        <AppButton variant="gold" size="lg" to="/book" :trailing-icon="IconArrowForward">Book a tee time</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import PageHero from '@/components/layout/PageHero.vue'
import CourseStatBar from '@/components/scorecard/CourseStatBar.vue'
import HoleFeatureIcon, { FEATURE_LEGEND } from '@/components/scorecard/HoleFeatureIcon.vue'
import ScorecardTable from '@/components/scorecard/ScorecardTable.vue'
import TeeSetSelector from '@/components/scorecard/TeeSetSelector.vue'
import { useSelectedTee } from '@/components/scorecard/useSelectedTee'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import { holeFeatures, holes, totalPar } from '@/data/holes'
import { teeSets } from '@/data/teeSets'
import { printLandscape } from '@/lib/print'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconChevronRight from '~icons/material-symbols/chevron-right-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'

const teeIndex = useSelectedTee()
const par = totalPar()
const teeLabelId = 'tee-select-label'
</script>
