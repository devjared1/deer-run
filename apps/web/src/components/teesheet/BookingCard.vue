<template>
  <Card
    variant="outlined"
    padding="sm"
    tag="article"
    :aria-label="`${booking.name}, ${playersText(booking.players)}, ${chip.label}`"
    :class="inactive ? 'bg-surface-container' : ''"
  >
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 pt-1">
        <h3 :class="['text-title-l break-words', inactive ? 'text-on-surface-variant line-through' : 'text-on-surface']">
          {{ booking.name }}
        </h3>
        <p class="mt-0.5 flex items-center gap-1.5 text-title-m text-on-surface">
          <IconGroup class="w-5 h-5 flex-none text-on-surface-variant" aria-hidden="true" />
          {{ playersText(booking.players) }}
        </p>
      </div>
      <RowActionsMenu
        v-if="menuItems.length"
        :label="`More actions for ${booking.name}`"
        :items="menuItems"
        class="-mr-1 -mt-1"
      />
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <StatusChip :label="chip.label" :tone="chip.tone" :icon="ICONS[chip.icon]" />
      <StatusChip v-if="booking.customer?.isMember" kind="role" status="MEMBER" />
    </div>

    <p v-if="roundLine.length" class="mt-3 flex items-start gap-2 text-body-m text-on-surface">
      <IconGolfCart class="w-5 h-5 flex-none text-on-surface-variant" aria-hidden="true" />
      <span>{{ roundLine.join(' · ') }}</span>
    </p>

    <p v-if="courseNote" class="mt-2 flex items-start gap-2 text-body-m text-on-surface">
      <component :is="noteIcon" :class="['w-5 h-5 flex-none', noteIconClass]" aria-hidden="true" />
      <span :class="courseNote.pace === 'BEHIND' ? 'font-bold' : ''">{{ courseNote.text }}</span>
    </p>

    <p v-if="booking.receipts?.length" class="mt-2 flex items-center gap-2 text-body-m text-on-surface-variant">
      <IconReceipt class="w-5 h-5 flex-none" aria-hidden="true" />
      Receipt{{ booking.receipts.length === 1 ? '' : 's' }} {{ booking.receipts.map(r => `#${r.number}`).join(', ') }}
    </p>

    <div v-if="primary" class="mt-3 flex sm:justify-end">
      <AppButton
        :variant="primary.variant"
        size="lg"
        :icon="primary.icon"
        :loading="busy"
        class="w-full sm:w-auto"
        @click="primary.onClick"
      >
        {{ primary.label }}
      </AppButton>
    </div>
  </Card>
</template>

<script setup>
// One booking on the staff Tee Sheet: name + players, one status chip, the round / carts line, the on-course note
// (today only, passed in), one primary action and the rest in the overflow menu. The page does the API calls.
// Emits: check-in, register (ring up add-ons), setup (carts and round), undo (undo check-in), move, cancel.
import { computed } from 'vue'
import Card from '@/components/ui/Card.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import AppButton from '@/components/ui/AppButton.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import { cartsLabel } from '@/components/oncourse/roundSetup'
import { bookingChip, canChange, isInactive, playersText, roundText } from './teeSheetDisplay'
import IconGolfCart from '~icons/deer/golf-cart'
import IconCheckedIn from '~icons/material-symbols/check-circle-rounded'
import IconPaidOnline from '~icons/material-symbols/credit-card-rounded'
import IconPaidRegister from '~icons/material-symbols/payments-rounded'
import IconPending from '~icons/material-symbols/hourglass-top-rounded'
import IconExpired from '~icons/material-symbols/timer-off-rounded'
import IconCancelled from '~icons/material-symbols/cancel-rounded'
import IconGroup from '~icons/material-symbols/group-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconHowToReg from '~icons/material-symbols/how-to-reg-rounded'
import IconRegister from '~icons/material-symbols/point-of-sale-rounded'
import IconTune from '~icons/material-symbols/tune-rounded'
import IconUndo from '~icons/material-symbols/undo-rounded'
import IconMove from '~icons/material-symbols/event-repeat-rounded'
import IconCancel from '~icons/material-symbols/cancel-rounded'
import IconAhead from '~icons/material-symbols/trending-up-rounded'
import IconBehind from '~icons/material-symbols/trending-down-rounded'
import IconOnPace from '~icons/material-symbols/trending-flat-rounded'
import IconFlag from '~icons/material-symbols/flag-rounded'
import IconWaiting from '~icons/material-symbols/schedule-rounded'

const ICONS = {
  checkedIn: IconCheckedIn, paidOnline: IconPaidOnline, paidRegister: IconPaidRegister,
  pending: IconPending, expired: IconExpired, cancelled: IconCancelled,
}

const props = defineProps({
  booking:    { type: Object, required: true },
  // { text, pace: AHEAD | ON_PACE | BEHIND | null, state } from the page (today's checked-in groups), or null
  courseNote: { type: Object, default: null },
  busy:       { type: Boolean, default: false },
})
const emit = defineEmits(['check-in', 'register', 'setup', 'undo', 'move', 'cancel'])

const chip = computed(() => bookingChip(props.booking))
const inactive = computed(() => isInactive(props.booking))

const roundLine = computed(() => {
  const b = props.booking
  const parts = []
  const round = roundText(b)
  if (round) parts.push(round)
  if (b.checkedInAt && b.status === 'CONFIRMED') {
    const carts = cartsLabel(b)
    parts.push(carts || 'No cart numbers yet')
  }
  return parts
})

const noteIcon = computed(() => {
  const n = props.courseNote
  if (n?.pace === 'BEHIND') return IconBehind
  if (n?.pace === 'AHEAD') return IconAhead
  if (n?.pace === 'ON_PACE') return IconOnPace
  return n?.state === 'WAITING' ? IconWaiting : IconFlag
})
const noteIconClass = computed(() => {
  const pace = props.courseNote?.pace
  if (pace === 'BEHIND') return 'text-error'
  if (pace === 'AHEAD') return 'text-secondary'
  return 'text-on-surface-variant'
})

const confirmed = computed(() => props.booking.status === 'CONFIRMED')

// One primary action: Check in (paid, not checked in) or Ring up add-ons (checked in)
const primary = computed(() => {
  if (!confirmed.value) return null
  if (!props.booking.checkedInAt) {
    return { label: 'Check in', icon: IconHowToReg, variant: 'filled', onClick: () => emit('check-in') }
  }
  return { label: 'Ring up add-ons', icon: IconRegister, variant: 'tonal', onClick: () => emit('register') }
})

const menuItems = computed(() => {
  const b = props.booking
  const items = []
  if (confirmed.value && b.checkedInAt) {
    items.push({ label: 'Carts and round', icon: IconTune, disabled: props.busy, onClick: () => emit('setup') })
    items.push({ label: 'Undo check-in', icon: IconUndo, disabled: props.busy, onClick: () => emit('undo') })
  }
  if (canChange(b)) {
    if (confirmed.value) items.push({ label: 'Move to another time', icon: IconMove, disabled: props.busy, onClick: () => emit('move') })
    items.push({ label: 'Cancel booking', icon: IconCancel, danger: true, disabled: props.busy, onClick: () => emit('cancel') })
  }
  return items
})
</script>
