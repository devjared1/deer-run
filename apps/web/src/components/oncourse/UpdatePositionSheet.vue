<template>
  <BottomSheet
    :open="open"
    title="Update position"
    @update:open="emit('update:open', $event)"
  >
    <div
      v-if="group"
      :data-contrast="highContrast ? 'high' : undefined"
      class="space-y-5 pb-1"
    >
      <!-- 1. Group (preselected from the card or the map) -->
      <fieldset
        v-if="groups.length > 1"
        class="min-w-0"
      >
        <legend class="text-label-l text-on-surface-variant mb-2">
          Group
        </legend>
        <div
          ref="groupRow"
          class="relative flex gap-2 overflow-x-auto -mx-6 px-6 pb-1"
        >
          <button
            v-for="g in groups"
            :key="g.booking.id"
            type="button"
            :aria-pressed="String(g.booking.id === selectedId)"
            :class="[
              'state-layer flex-shrink-0 inline-flex items-center gap-2 h-12 px-4 rounded-shape-sm border text-label-l cursor-pointer',
              g.booking.id === selectedId ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-on-surface',
            ]"
            @click="selectGroup(g.booking.id)"
          >
            <IconCheck
              v-if="g.booking.id === selectedId"
              class="w-[18px] h-[18px] -ml-1"
              aria-hidden="true"
            />
            <span class="tabular-nums">{{ teeTime(g.slot.startTime) }}</span>
            <span class="max-w-[10rem] truncate">{{ g.booking.name }}</span>
          </button>
        </div>
      </fieldset>

      <div class="rounded-shape-md bg-surface-container p-3 space-y-2">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-title-m text-on-surface truncate">{{ group.booking.name }}</span>
          <span class="text-body-m text-on-surface-variant flex-shrink-0">{{ playersText(group.booking) }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-body-m text-on-surface-variant">
          <template v-if="group.track.hole">
            <span>{{ isFresh(group.track) ? 'Last report' : 'Estimate' }}: hole {{ group.track.hole }}, {{ stageShort(group.track.stage).toLowerCase() }}</span>
            <PaceBadge
              size="sm"
              :pace="group.track.pace"
              :delta-minutes="group.track.deltaMinutes"
            />
          </template>
          <span v-else>Tee time {{ teeTime(group.slot.startTime) }} · {{ group.booking.roundHoles }} holes{{ group.booking.startHole === 10 ? ' from 10' : '' }}</span>
        </div>
      </div>

      <!-- 2. Hole: only the holes on this group's round, in playing order -->
      <fieldset class="min-w-0">
        <legend class="text-label-l text-on-surface-variant mb-2">
          Hole
        </legend>
        <div class="grid grid-cols-5 sm:grid-cols-6 gap-2">
          <button
            v-for="h in order"
            :key="h"
            type="button"
            :aria-pressed="String(hole === h)"
            :data-autofocus="hole === h ? true : undefined"
            :aria-label="`Hole ${h}${h === group.track.hole ? ' (where they are now)' : ''}`"
            :class="[
              'state-layer relative flex flex-col items-center justify-center min-h-14 rounded-shape-md cursor-pointer',
              hole === h ? 'bg-primary text-on-primary' : h === group.track.hole ? 'border-2 border-primary bg-primary-container text-on-primary-container' : 'border border-outline text-on-surface',
            ]"
            @click="pickHole(h)"
          >
            <span class="font-display text-title-l leading-none">{{ h }}</span>
            <span
              v-if="h === group.track.hole"
              class="text-label-s mt-0.5"
            >now</span>
          </button>
        </div>
      </fieldset>

      <!-- 3. Stage -->
      <fieldset class="min-w-0">
        <legend class="text-label-l text-on-surface-variant mb-2">
          On hole {{ hole }} <span class="font-normal">· par {{ holeInfo(hole)?.par }}, {{ holeInfo(hole)?.name }}</span>
        </legend>
        <SegmentedButton
          v-model="stage"
          class="stage-picker"
          block
          size="lg"
          :label="`Where on hole ${hole}`"
          :options="stageOptions"
        />
      </fieldset>

      <ErrorBanner
        v-if="error"
        :message="error"
      />
    </div>

    <template #actions="{ close }">
      <AppButton
        variant="text"
        size="lg"
        @click="close"
      >
        Cancel
      </AppButton>
      <AppButton
        size="lg"
        class="flex-1"
        :icon="IconSave"
        :loading="busy"
        @click="save"
      >
        Save: hole {{ hole }}, {{ stageShort(stage).toLowerCase() }}
      </AppButton>
    </template>
  </BottomSheet>
</template>

<script setup>
// The On Course update flow as a bottom sheet: group (preselected) → hole (only the round's holes, 56dp tiles in 5–6
// columns, the current hole marked "now") → stage (Tee / Fairway / Green, no fairway on a par 3) → Save at the bottom.
//   <UpdatePositionSheet v-model:open="open" :groups="candidates" :group-id="id" :busy="saving" :error="err" @save="…" />
// save emits { group, hole, stage }; the page posts it and closes the sheet.
import { computed, ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import PaceBadge from './PaceBadge.vue'
import { isFresh, playersText } from './paceDisplay'
import { teeTime } from '@/lib/teesheet'
import { STAGES, holeInfo, holeOrder, stagesFor } from '@/lib/pace'
import IconCheck from '~icons/material-symbols/check-rounded'
import IconSave from '~icons/material-symbols/my-location-rounded'

const props = defineProps({
  open:         { type: Boolean, default: false },
  groups:       { type: Array, default: () => [] },
  groupId:      { type: String, default: null },
  busy:         { type: Boolean, default: false },
  error:        { type: String, default: '' },
  highContrast: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'save', 'group-change'])

const selectedId = ref(null)
const groupRow = ref(null)
const hole = ref(1)
const stage = ref('TEE')

const group = computed(() => props.groups.find(g => g.booking.id === selectedId.value) ?? null)
const order = computed(() => (group.value ? holeOrder(group.value.booking.startHole, group.value.booking.roundHoles) : []))
const stageOptions = computed(() => stagesFor(hole.value).map(s => ({ value: s.value, label: s.short })))

function stageShort(value) {
  return STAGES.find(s => s.value === value)?.short ?? value
}

// Start from the estimate (or the first hole); a finished-by-estimate group starts on its last hole
function reset() {
  const g = group.value
  if (!g) return
  const o = order.value
  hole.value = g.track.hole ?? (g.track.state === 'DONE' ? o[o.length - 1] : o[0])
  stage.value = g.track.hole ? g.track.stage : 'TEE'
}

function selectGroup(id) {
  if (id === selectedId.value) return
  selectedId.value = id
  reset()
  emit('group-change', id)
}

function pickHole(h) {
  hole.value = h
  if (!stagesFor(h).some(s => s.value === stage.value)) stage.value = 'TEE'
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  selectedId.value = props.groupId ?? props.groups[0]?.booking.id ?? null
  reset()
}, { immediate: true })

// Bring the preselected group's chip into view once the sheet has rendered (the row scrolls sideways).
// scrollLeft, not scrollIntoView, which would also scroll the sheet's body sideways.
watch(groupRow, (row) => {
  const chip = row?.querySelector('[aria-pressed="true"]')
  if (chip) requestAnimationFrame(() => { row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2 })
})

function save() {
  if (!group.value) return
  emit('save', { group: group.value, hole: hole.value, stage: stage.value })
}
</script>

<style scoped>
/* Stage control: 56dp tall for gloves (SegmentedButton lg is 48dp) */
.stage-picker :deep(button) { @apply h-14 text-title-m; }
</style>
