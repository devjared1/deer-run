<template>
  <div class="space-y-6 print:hidden">
    <!-- Up for grabs -->
    <section aria-labelledby="open-shifts-title">
      <h2 id="open-shifts-title" class="text-title-l text-on-surface mb-2 flex items-center gap-2">
        <IconHand class="w-6 h-6 text-primary" aria-hidden="true" /> Open shifts
      </h2>
      <Card v-if="open.length" padding="none" class="overflow-hidden">
        <ul class="divide-y divide-outline-variant">
          <li v-for="o in open" :key="o.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div class="flex-1 min-w-[12rem]">
              <p class="text-body-l text-on-surface">{{ when(o.shift) }}</p>
              <p class="text-body-m text-on-surface-variant">
                {{ o.posted ? 'Open shift' : `${name(o.offeredBy)}'s shift` }}<template v-if="o.shift.position"> · {{ positionLabel(o.shift.position) }}</template><template v-if="o.note"> · “{{ o.note }}”</template>
              </p>
            </div>
            <AppButton variant="tonal" :icon="IconHand" :loading="busy === `${o.id}:claim`" :disabled="!!busy" @click="emit('act', o, 'claim')">
              Pick up<span class="sr-only"> the {{ when(o.shift) }} shift</span>
            </AppButton>
          </li>
        </ul>
      </Card>
      <p v-else class="text-body-m text-on-surface-variant">
        No open shifts right now. Can't work one of yours? Use <span class="text-on-surface">Offer</span> on the shift.
      </p>
    </section>

    <!-- Mine -->
    <section v-if="mine.length" aria-labelledby="my-swaps-title">
      <h2 id="my-swaps-title" class="text-title-l text-on-surface mb-2 flex items-center gap-2">
        <IconSwap class="w-6 h-6 text-primary" aria-hidden="true" /> My swaps
      </h2>
      <Card padding="none" class="overflow-hidden">
        <ul class="divide-y divide-outline-variant">
          <li v-for="o in mine" :key="o.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div class="flex-1 min-w-[12rem]">
              <p class="text-body-l text-on-surface">{{ when(o.shift) }}</p>
              <p class="text-body-m text-on-surface-variant">{{ describe(o) }}</p>
              <p v-if="o.reviewNote" class="text-body-s text-on-surface-variant">Manager: “{{ o.reviewNote }}”</p>
            </div>
            <StatusChip size="sm" :label="STATUS[o.status].label" :tone="STATUS[o.status].tone" />
            <AppButton
              v-if="isMine(o) && ['OPEN', 'CLAIMED'].includes(o.status) && !o.posted"
              variant="text"
              :loading="busy === `${o.id}:cancel`"
              :disabled="!!busy"
              @click="emit('act', o, 'cancel')"
            >
              Withdraw
            </AppButton>
            <AppButton
              v-else-if="o.status === 'CLAIMED' && o.claimedBy?.id === employeeId"
              variant="text"
              :loading="busy === `${o.id}:release`"
              :disabled="!!busy"
              @click="emit('act', o, 'release')"
            >
              Let it go
            </AppButton>
          </li>
        </ul>
      </Card>
    </section>
  </div>
</template>

<script setup>
// My Schedule: shifts up for grabs (Pick up) and my swaps (offered / picked up, with their status and Withdraw /
// Let it go while a manager hasn't decided). Data from GET /api/staff/shift-offers; the page does the requests.
// Props: open, mine (offers), employeeId (me), busy ("<offerId>:<action>" while a request runs). Emits act(offer, action).
import { formatLocalDate } from '@/lib/timeclock'
import { longTime } from '@/lib/schedule'
import { positionLabel } from '@/components/schedule/scheduleDisplay'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import IconHand from '~icons/material-symbols/front-hand-rounded'
import IconSwap from '~icons/material-symbols/swap-horiz-rounded'

const props = defineProps({
  open:       { type: Array, default: () => [] },
  mine:       { type: Array, default: () => [] },
  employeeId: { type: String, default: null },
  busy:       { type: String, default: null },
})
const emit = defineEmits(['act'])

const STATUS = {
  OPEN:      { label: 'Offered', tone: 'neutral' },
  CLAIMED:   { label: 'Waiting for a manager', tone: 'warning' },
  APPROVED:  { label: 'Approved', tone: 'success' },
  DENIED:    { label: 'Not approved', tone: 'error' },
  CANCELLED: { label: 'Withdrawn', tone: 'neutral' },
}

const name = p => (p ? `${p.firstName} ${p.lastName}`.trim() : 'A coworker')
const when = s => `${formatLocalDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${longTime(s.startTime)} – ${longTime(s.endTime)}`
const isMine = o => o.offeredBy?.id === props.employeeId

function describe(o) {
  if (isMine(o)) {
    if (o.status === 'OPEN') return 'You offered this shift. Nobody has picked it up yet.'
    if (o.status === 'CLAIMED') return `${name(o.claimedBy)} picked it up. It's yours until a manager approves.`
    if (o.status === 'APPROVED') return `${name(o.claimedBy)} is working it now.`
    if (o.status === 'DENIED') return 'Not approved: it\'s still your shift.'
    return 'You withdrew this offer.'
  }
  if (o.status === 'CLAIMED') return `You picked up ${o.posted ? 'this open shift' : `${name(o.offeredBy)}'s shift`}.`
  if (o.status === 'APPROVED') return 'Approved: it\'s on your schedule.'
  if (o.status === 'DENIED') return 'Not approved: it stays with them.'
  return o.posted ? 'Open shift' : `${name(o.offeredBy)}'s shift`
}
</script>
