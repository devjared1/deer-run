<template>
  <StatusChip
    kind="pace"
    :status="pace"
    :icon="d.icon"
    :size="size"
    :title="d.long"
  >
    <span
      aria-hidden="true"
      class="tabular-nums"
    >{{ d.short }}</span>
    <span class="sr-only">{{ d.long }}</span>
  </StatusChip>
</template>

<script setup>
// Pace as a status chip: tone from statusInfo('pace'), an arrow (trending down = behind, up = ahead, check = on pace)
// and "+6 min" / "−4 min" text, so it never relies on color. Screen readers hear "6 min behind".
//   <PaceBadge :pace="track.pace" :delta-minutes="track.deltaMinutes" />
import { computed } from 'vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import { paceDisplay } from './paceDisplay'

const props = defineProps({
  pace:         { type: String, default: 'ON_PACE' },
  deltaMinutes: { type: Number, default: null },
  size:         { type: String, default: 'md' },
})

const d = computed(() => paceDisplay(props.pace, props.deltaMinutes))
</script>
