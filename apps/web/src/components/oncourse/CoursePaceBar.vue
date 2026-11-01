<template>
  <section
    class="sticky top-16 z-[5] -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 px-4 md:px-6 lg:px-8 py-2 bg-surface border-b border-outline-variant"
    aria-label="Course pace"
  >
    <div class="flex items-center gap-x-4 gap-y-1 overflow-x-auto whitespace-nowrap min-h-12">
      <span class="flex items-center gap-2">
        <span class="text-label-l text-on-surface-variant">Course</span>
        <PaceBadge
          v-if="deltaMinutes != null"
          :pace="pace"
          :delta-minutes="deltaMinutes"
        />
        <span
          v-else
          class="text-body-m text-on-surface-variant"
        >No recent reports</span>
      </span>
      <span class="flex items-center gap-1.5 text-body-l text-on-surface">
        <IconGroups
          class="w-5 h-5 text-on-surface-variant"
          aria-hidden="true"
        />
        <span><b>{{ groupsOut }}</b> out<span class="hidden min-[440px]:inline"> · {{ golfersOut }} golfers</span></span>
      </span>
      <span class="flex items-center gap-1.5 text-body-l text-on-surface">
        <IconCart
          class="w-5 h-5 text-on-surface-variant"
          aria-hidden="true"
        />
        <span><b>{{ cartsOut }}</b> cart{{ cartsOut === 1 ? '' : 's' }}</span>
      </span>
      <span
        v-if="firstTeeLate != null"
        class="hidden sm:flex items-center gap-1.5 text-body-l text-on-surface"
      >
        <IconTee
          class="w-5 h-5 text-on-surface-variant"
          aria-hidden="true"
        />
        <span>First tee <b>{{ firstTeeText }}</b></span>
      </span>
    </div>
  </section>
</template>

<script setup>
// Compact course-pace bar, sticky under the top app bar: the course's pace (average of recent reports, arrow +
// minutes), groups and golfers out, carts in use, and (sm+) how late the first tee is running. Bleeds to the edges
// of StaffLayout's padded <main>.
import { computed } from 'vue'
import PaceBadge from './PaceBadge.vue'
import { formatMinutes, paceOf } from '@/lib/pace'
import IconGroups from '~icons/material-symbols/groups-rounded'
import IconTee from '~icons/material-symbols/sports-golf-rounded'
import IconCart from '~icons/deer/golf-cart'

const props = defineProps({
  deltaMinutes: { type: Number, default: null },
  groupsOut:    { type: Number, default: 0 },
  golfersOut:   { type: Number, default: 0 },
  cartsOut:     { type: Number, default: 0 },
  firstTeeLate: { type: Number, default: null },
})

const pace = computed(() => (props.deltaMinutes == null ? 'ON_PACE' : paceOf(props.deltaMinutes)))
const firstTeeText = computed(() => {
  const late = props.firstTeeLate
  if (late <= 2) return 'on time'
  return `${formatMinutes(late)} late`
})
</script>
