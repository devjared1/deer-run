<template>
  <section aria-labelledby="kiosk-actions-title" class="flex-1 flex flex-col items-center pt-2 md:pt-6">
    <div class="w-full max-w-2xl">
      <div class="flex items-center gap-4">
        <span :class="['flex-none flex items-center justify-center w-16 h-16 rounded-full', BADGE[state.status]]">
          <component :is="STATUS_ICONS[state.status]" class="w-9 h-9" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h2 id="kiosk-actions-title" class="font-display text-headline-l text-on-surface break-words">
            Hi, {{ state.employee.firstName }}
          </h2>
          <p class="text-title-m text-on-surface" aria-live="polite">
            <template v-if="openBreak">
              On break since {{ formatClockTime(openBreak.startedAt) }} · clocked in at {{ formatClockTime(state.openEntry.clockIn) }}
            </template>
            <template v-else-if="state.openEntry">On the clock since {{ formatClockTime(state.openEntry.clockIn) }}</template>
            <template v-else>{{ STATUS.off.label }}</template>
          </p>
          <p class="text-body-l text-on-surface-variant">Worked today: {{ formatMinutes(todayMinutes) }}</p>
        </div>
      </div>

      <ErrorBanner v-if="error" class="mt-6" :message="error" />

      <!-- The likely next punch first, full width -->
      <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AppButton
          v-for="a in actions"
          :key="a.action"
          size="xl"
          block
          :variant="a.variant"
          :icon="a.icon"
          :loading="busy === a.action"
          :disabled="!!busy && busy !== a.action"
          :class="actions.length === 1 ? 'sm:col-span-2' : ''"
          @click="emit('act', a.action)"
        >
          {{ a.label }}
        </AppButton>
      </div>

      <div class="mt-8 flex justify-center">
        <AppButton variant="text" size="lg" :icon="IconDone" :disabled="!!busy" @click="emit('close')">
          Done, back to the names
        </AppButton>
      </div>
    </div>
  </section>
</template>

<script setup>
// Time clock kiosk, step 3: the signed-in employee's state (on / off / on break, since when, worked today) and the
// punches that fit it. Emits act(action) and close. The page records the punch.
import { computed } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import { formatClockTime, formatMinutes, workedMinutes } from '@/lib/timeclock'
import { STATUS } from './kioskDisplay'
import IconLogin from '~icons/material-symbols/login-rounded'
import IconLogout from '~icons/material-symbols/logout-rounded'
import IconCoffee from '~icons/material-symbols/coffee-rounded'
import IconPlay from '~icons/material-symbols/timer-play-rounded'
import IconTimer from '~icons/material-symbols/timer-rounded'
import IconTimerOff from '~icons/material-symbols/timer-off-rounded'
import IconDone from '~icons/material-symbols/done-rounded'

const props = defineProps({
  // clockStatus from POST /api/kiosk/clock
  state: { type: Object, required: true },
  now:   { type: Date, required: true },
  busy:  { type: String, default: null },
  error: { type: String, default: '' },
})
const emit = defineEmits(['act', 'close'])

const STATUS_ICONS = { off: IconTimerOff, on: IconTimer, break: IconCoffee }
const BADGE = {
  off: 'bg-surface-container-highest text-on-surface-variant',
  on: 'bg-success-container text-on-success-container',
  break: 'bg-warning-container text-on-warning-container',
}

const openBreak = computed(() => props.state.openEntry?.breaks?.find(b => !b.endedAt) ?? null)

// Live total: closed entries as recorded, the open one up to now
const todayMinutes = computed(() => props.state.today.entries.reduce(
  (sum, e) => sum + (e.clockOut ? e.workedMinutes : workedMinutes(e, props.now)), 0,
))

const actions = computed(() => {
  if (props.state.status === 'off') return [{ action: 'clock_in', label: 'Clock in', icon: IconLogin, variant: 'filled' }]
  if (props.state.status === 'on') {
    return [
      { action: 'break_start', label: 'Start break', icon: IconCoffee, variant: 'tonal' },
      { action: 'clock_out', label: 'Clock out', icon: IconLogout, variant: 'filled' },
    ]
  }
  return [
    { action: 'break_end', label: 'End break', icon: IconPlay, variant: 'filled' },
    { action: 'clock_out', label: 'Clock out', icon: IconLogout, variant: 'outlined' },
  ]
})
</script>
