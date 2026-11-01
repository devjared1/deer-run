<template>
  <BottomSheet
    :open="open"
    @update:open="emit('update:open', $event)"
    @after-leave="emit('after-leave')"
  >
    <template #title>
      Hole {{ hole }} <span class="text-on-surface-variant font-normal">· par {{ info?.par }}{{ info?.name ? `, ${info.name}` : '' }}</span>
    </template>
    <div :data-contrast="highContrast ? 'high' : undefined">
      <p
        v-if="!groups.length"
        class="text-body-l text-on-surface-variant py-2"
      >
        No groups on this hole now.
      </p>
      <ul
        v-else
        class="divide-y divide-outline-variant"
      >
        <li
          v-for="g in groups"
          :key="g.booking.id"
          class="py-3 first:pt-0 space-y-2"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-title-m text-on-surface truncate">{{ g.booking.name }}</span>
            <span class="text-body-m text-on-surface-variant flex-shrink-0">
              {{ teeTime(g.slot.startTime) }} · {{ playersText(g.booking) }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-body-m text-on-surface-variant">
            <span>{{ stageLabel(g.track.stage) }}</span>
            <PaceBadge
              size="sm"
              :pace="g.track.pace"
              :delta-minutes="g.track.deltaMinutes"
            />
            <span :class="isFresh(g.track) ? '' : 'italic'">{{ basisText(g.track) }}</span>
          </div>
          <AppButton
            size="lg"
            block
            :icon="IconPinEdit"
            @click="emit('update', g)"
          >
            Update {{ g.booking.name }}
          </AppButton>
        </li>
      </ul>
    </div>
  </BottomSheet>
</template>

<script setup>
// The groups on one hole of the course map, each with its Update action (opens the update sheet for that group).
//   <HoleGroupsSheet v-model:open="open" :hole="7" :groups="groupsOnHole(7)" @update="openUpdate" />
// after-leave fires once the sheet has slid away (open the update sheet then, so the two don't overlap).
import { computed } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import PaceBadge from './PaceBadge.vue'
import { basisText, isFresh, playersText } from './paceDisplay'
import { teeTime } from '@/lib/teesheet'
import { holeInfo, stageLabel } from '@/lib/pace'
import IconPinEdit from '~icons/material-symbols/edit-location-alt-rounded'

const props = defineProps({
  open:         { type: Boolean, default: false },
  hole:         { type: Number, default: null },
  groups:       { type: Array, default: () => [] },
  highContrast: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'update', 'after-leave'])

const info = computed(() => (props.hole ? holeInfo(props.hole) : null))
</script>
