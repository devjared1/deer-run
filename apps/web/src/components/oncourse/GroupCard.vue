<template>
  <Card
    tag="article"
    variant="outlined"
    :aria-label="`${booking.name}, tee time ${teeTime(group.slot.startTime)}`"
  >
    <div class="flex flex-col gap-3">
      <!-- Who -->
      <div class="flex items-start gap-2">
        <div class="flex-1 min-w-0">
          <h3 class="text-title-l text-on-surface break-words">
            {{ booking.name }}
          </h3>
          <p class="text-body-l text-on-surface">
            <span class="font-bold">{{ playersText(booking) }}</span>
            · <span class="tabular-nums">{{ teeTime(group.slot.startTime) }}</span>
            <span
              v-if="track.teedOffAt && kind !== 'upnext'"
              class="tabular-nums text-on-surface-variant whitespace-nowrap"
            > · off {{ clock(track.teedOffAt) }}</span>
          </p>
          <p class="text-body-m text-on-surface-variant">
            {{ roundText }}
          </p>
        </div>
        <RowActionsMenu
          v-if="menuItems.length"
          :label="`More actions for ${booking.name}`"
          :items="menuItems"
          class="-mr-2 -mt-1"
        />
      </div>

      <!-- Where (on the course) -->
      <div
        v-if="kind === 'oncourse'"
        class="flex flex-wrap items-center gap-2"
      >
        <span
          :class="[
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-shape-sm border text-label-l',
            fresh ? 'bg-primary-container text-on-primary-container border-transparent' : 'estimate-hatch bg-surface text-on-surface border-dashed border-on-surface-variant',
          ]"
        >
          <IconPin
            class="w-[18px] h-[18px] -ml-1"
            aria-hidden="true"
          />
          Hole {{ track.hole }} · {{ stageLabel(track.stage) }}
        </span>
        <PaceBadge
          :pace="track.pace"
          :delta-minutes="track.deltaMinutes"
        />
      </div>

      <!-- Waiting on the tee -->
      <div
        v-else-if="kind === 'upnext'"
        class="flex flex-wrap items-center gap-2"
      >
        <StatusChip
          :tone="late ? 'warning' : 'neutral'"
          :icon="late ? 'warning' : 'pending'"
          :label="dueText"
        />
      </div>

      <!-- Finished -->
      <div
        v-else
        class="flex flex-wrap items-center gap-2"
      >
        <template v-if="track.state === 'FINISHED'">
          <StatusChip
            kind="round"
            status="FINISHED"
            :label="`In at ${clock(track.finishedAt)}`"
          />
          <span class="text-body-m text-on-surface-variant">{{ formatMinutes(track.playedMinutes) }}</span>
          <PaceBadge
            :pace="track.pace"
            :delta-minutes="track.deltaMinutes"
          />
        </template>
        <StatusChip
          v-else
          kind="round"
          status="DONE"
          :label="`Probably done (est. ${clock(track.estimatedFinish)})`"
        />
      </div>

      <ul
        v-if="kind === 'oncourse'"
        class="text-body-m text-on-surface-variant space-y-0.5"
      >
        <li :class="fresh ? '' : 'italic'">
          {{ basisText(track) }}
        </li>
        <li v-if="track.expectedHole && track.expectedHole !== track.hole">
          Should be on {{ track.expectedHole }}
        </li>
        <li
          v-if="group.gap"
          :class="track.pace === 'BEHIND' ? 'font-bold text-on-warning-container' : ''"
        >
          {{ group.gap }} open hole{{ group.gap === 1 ? '' : 's' }} ahead
        </li>
        <li>Done around {{ clock(track.estimatedFinish) }}</li>
      </ul>

      <!-- Actions: one big primary within thumb reach -->
      <div
        v-if="kind === 'oncourse'"
        class="flex flex-wrap gap-2"
      >
        <AppButton
          size="lg"
          class="flex-[1_1_11rem]"
          :icon="IconPinEdit"
          :disabled="busy"
          @click="emit('update')"
        >
          Update position
        </AppButton>
        <AppButton
          size="lg"
          variant="outlined"
          class="flex-auto"
          :icon="IconFlag"
          :disabled="busy"
          @click="emit('finish')"
        >
          Finished
        </AppButton>
      </div>
      <AppButton
        v-else-if="kind === 'upnext'"
        size="lg"
        block
        :icon="IconTeeOff"
        :loading="busy"
        @click="emit('tee-off')"
      >
        Teed off
      </AppButton>
      <div
        v-else-if="track.state !== 'FINISHED'"
        class="grid grid-cols-2 gap-2"
      >
        <AppButton
          size="lg"
          block
          :icon="IconFlag"
          :loading="busy"
          @click="emit('finish')"
        >
          Finished
        </AppButton>
        <AppButton
          size="lg"
          block
          variant="outlined"
          :icon="IconPinEdit"
          :disabled="busy"
          @click="emit('update')"
        >
          Still out
        </AppButton>
      </div>
    </div>
  </Card>
</template>

<script setup>
// One checked-in group on the On Course page. kind: upnext (waiting on the first tee: Teed off) | oncourse (Update
// position + Finished) | finished (marked finished, or past its last green by the estimate). Everything else is in
// the overflow menu; the page confirms the undo actions.
// group: { booking, slot, track, gap } from OnCourseView (pace.js trackedGroups + openHolesAhead).
// Emits: update, tee-off, finish, undo-tee-off, undo-finish, setup.
import { computed } from 'vue'
import Card from '@/components/ui/Card.vue'
import AppButton from '@/components/ui/AppButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import PaceBadge from './PaceBadge.vue'
import { basisText, isFresh, playersText } from './paceDisplay'
import { cartsLabel } from './roundSetup'
import { COURSE_TZ } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import { PACE_TOLERANCE_MINUTES, formatMinutes, stageLabel } from '@/lib/pace'
import IconPin from '~icons/material-symbols/location-on-rounded'
import IconPinEdit from '~icons/material-symbols/edit-location-alt-rounded'
import IconFlag from '~icons/material-symbols/flag-rounded'
import IconTeeOff from '~icons/material-symbols/sports-golf-rounded'
import IconUndo from '~icons/material-symbols/undo-rounded'
import IconCart from '~icons/deer/golf-cart'

const props = defineProps({
  group: { type: Object, required: true },
  kind:  { type: String, required: true, validator: v => ['upnext', 'oncourse', 'finished'].includes(v) },
  busy:  { type: Boolean, default: false },
  now:   { type: Date, required: true },
})
const emit = defineEmits(['update', 'tee-off', 'finish', 'undo-tee-off', 'undo-finish', 'setup'])

const booking = computed(() => props.group.booking)
const track = computed(() => props.group.track)
const fresh = computed(() => isFresh(track.value))

const roundText = computed(() => {
  const b = booking.value
  const holesText = `${b.roundHoles} holes${b.startHole === 10 ? ' from 10' : ''}`
  return [cartsLabel(b) || 'No cart recorded', holesText].join(' · ')
})

const lateMinutes = computed(() => (props.now - track.value.teeTime) / 60_000)
const late = computed(() => lateMinutes.value > PACE_TOLERANCE_MINUTES)
const dueText = computed(() => {
  const t = track.value
  if (t.state === 'WAITING' && t.startsInMinutes > 0) return `Due in ${formatMinutes(t.startsInMinutes)}`
  const m = Math.round(lateMinutes.value)
  return m <= 0 ? 'Due now' : `${formatMinutes(m)} past tee time`
})

const menuItems = computed(() => {
  const t = track.value
  const items = []
  if (props.kind === 'oncourse' && !t.teedOffAt) {
    items.push({ label: 'Teed off just now', icon: IconTeeOff, disabled: props.busy, onClick: () => emit('tee-off') })
  }
  if (t.state !== 'FINISHED') {
    items.push({ label: 'Carts and round', icon: IconCart, onClick: () => emit('setup') })
  }
  if (props.kind === 'oncourse' && t.teedOffAt) {
    items.push({ label: 'Undo tee-off', icon: IconUndo, danger: true, disabled: props.busy, onClick: () => emit('undo-tee-off') })
  }
  if (t.state === 'FINISHED') {
    items.push({ label: 'Undo finish', icon: IconUndo, danger: true, disabled: props.busy, onClick: () => emit('undo-finish') })
  }
  return items
})

function clock(d) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}
</script>

<style scoped>
/* Estimated position: hatched, no fill (a fresh report is a solid fill) */
.estimate-hatch {
  background-image: repeating-linear-gradient(135deg, rgb(var(--md-sys-color-outline-variant) / .35) 0 2px, transparent 2px 8px);
}
/* High contrast darkens outline-variant: keep the hatch light so the text stays readable */
[data-contrast="high"] .estimate-hatch {
  background-image: repeating-linear-gradient(135deg, rgb(var(--md-sys-color-outline-variant) / .2) 0 2px, transparent 2px 8px);
}
</style>
