<template>
  <span
    :class="[
      'inline-flex items-center flex-shrink-0 whitespace-nowrap rounded-shape-sm font-body align-middle',
      size === 'sm' ? 'h-6 px-2 gap-1 text-label-m' : 'h-8 px-3 gap-1.5 text-label-l',
      TONES[info.tone] || TONES.neutral,
    ]"
  >
    <component :is="iconComponent" v-if="iconComponent" :class="size === 'sm' ? 'w-4 h-4 -ml-0.5' : 'w-[18px] h-[18px] -ml-1'" aria-hidden="true" />
    <slot>{{ info.label }}</slot>
  </span>
</template>

<script setup>
// Status chip (MD3 assist-chip look, not interactive): 8dp corners, 32dp tall (sm: 24dp for dense tables),
// tone container colors and a leading icon, so status is never color alone.
//   <StatusChip kind="booking" status="CONFIRMED" />            (label/tone/icon from statusChips.js)
//   <StatusChip label="Working" tone="success" icon="check" />  (explicit; icon is a name below or a component)
// Explicit label/tone/icon props override the map. :icon="false" hides the icon. The default slot replaces the label.
import { computed } from 'vue'
import { statusInfo } from './statusChips.js'
import IconCheck from '~icons/material-symbols/check-circle-rounded'
import IconPending from '~icons/material-symbols/schedule-rounded'
import IconCancel from '~icons/material-symbols/cancel-rounded'
import IconUndo from '~icons/material-symbols/undo-rounded'
import IconCheckIn from '~icons/material-symbols/how-to-reg-rounded'
import IconTimerOff from '~icons/material-symbols/timer-off-rounded'
import IconBlock from '~icons/material-symbols/block-rounded'
import IconError from '~icons/material-symbols/error-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'
import IconMember from '~icons/material-symbols/card-membership-rounded'
import IconAdmin from '~icons/material-symbols/shield-person-rounded'
import IconPause from '~icons/material-symbols/pause-circle-rounded'
import IconLock from '~icons/material-symbols/lock-rounded'
import IconAhead from '~icons/material-symbols/fast-forward-rounded'
import IconBehind from '~icons/material-symbols/hourglass-top-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconFlag from '~icons/material-symbols/flag-rounded'
import IconCard from '~icons/material-symbols/credit-card-rounded'
import IconSync from '~icons/material-symbols/sync-rounded'
import IconInfo from '~icons/material-symbols/info-rounded'

const props = defineProps({
  kind:   { type: String, default: null },
  status: { type: String, default: null },
  label:  { type: String, default: null },
  tone:   { type: String, default: null, validator: v => v == null || ['neutral', 'primary', 'success', 'warning', 'error', 'info'].includes(v) },
  icon:   { type: [String, Object, Function, Boolean], default: null },
  size:   { type: String, default: 'md', validator: v => ['sm', 'md'].includes(v) },
})

// Icon names used by statusChips.js (and the `icon` prop)
const STATUS_ICONS = {
  check: IconCheck, pending: IconPending, cancel: IconCancel, undo: IconUndo, checkIn: IconCheckIn,
  timerOff: IconTimerOff, block: IconBlock, error: IconError, warning: IconWarning, person: IconPerson,
  member: IconMember, admin: IconAdmin, pause: IconPause, lock: IconLock, ahead: IconAhead, behind: IconBehind,
  golf: IconGolf, flag: IconFlag, card: IconCard, sync: IconSync, info: IconInfo,
}

const TONES = {
  neutral: 'bg-surface-container-highest text-on-surface-variant',
  primary: 'bg-primary-container text-on-primary-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error:   'bg-error-container text-on-error-container',
  info:    'bg-secondary-container text-on-secondary-container',
}

const info = computed(() => {
  const base = props.kind || props.status ? statusInfo(props.kind, props.status) : { label: '', tone: 'neutral', icon: null }
  return {
    label: props.label ?? base.label,
    tone: props.tone ?? base.tone,
    icon: props.icon ?? base.icon,
  }
})

const iconComponent = computed(() => {
  const icon = info.value.icon
  if (!icon) return null
  return typeof icon === 'string' ? STATUS_ICONS[icon] ?? null : icon
})
</script>
