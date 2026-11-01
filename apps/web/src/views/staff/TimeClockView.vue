<template>
  <div class="max-w-2xl space-y-4">
    <Skeleton
      v-if="loading && !state"
      variant="card"
      label="Loading the time clock"
    />
    <ErrorBanner
      v-else-if="loadError && !state"
      :message="loadError"
      :retrying="loading"
      @retry="load"
    />

    <template v-else-if="state">
      <!-- Status and the action first -->
      <Card padding="lg">
        <div class="flex items-center gap-4">
          <div :class="['flex-none flex items-center justify-center w-14 h-14 rounded-full', statusStyle.badge]">
            <component
              :is="statusStyle.icon"
              class="w-8 h-8"
              aria-hidden="true"
            />
          </div>
          <div class="min-w-0">
            <h2
              class="font-display text-headline-m text-on-surface"
              aria-live="polite"
            >
              {{ statusStyle.label }}
            </h2>
            <p class="text-body-m text-on-surface-variant">
              <template v-if="state.openEntry">
                Since {{ formatClockTime(state.openEntry.clockIn) }}
                <template v-if="currentBreak">
                  · break since {{ formatClockTime(currentBreak.startedAt) }}
                </template>
              </template>
              <template v-else>
                Worked today: {{ formatMinutes(todayMinutes) }}
              </template>
            </p>
          </div>
        </div>

        <ErrorBanner
          v-if="actionError"
          class="mt-4"
          :message="actionError"
          @dismiss="actionError = null"
        />

        <div class="mt-6 flex flex-col sm:flex-row gap-3">
          <AppButton
            v-if="state.status === 'off'"
            size="xl"
            :icon="IconLogin"
            :loading="busy === 'clock_in'"
            :disabled="!!busy"
            class="w-full sm:w-auto sm:min-w-[14rem]"
            @click="act('clock_in')"
          >
            Clock in
          </AppButton>
          <AppButton
            v-if="state.status === 'on'"
            size="xl"
            variant="tonal"
            :icon="IconCoffee"
            :loading="busy === 'break_start'"
            :disabled="!!busy"
            class="w-full sm:w-auto sm:min-w-[12rem]"
            @click="act('break_start')"
          >
            Start break
          </AppButton>
          <AppButton
            v-if="state.status === 'break'"
            size="xl"
            :icon="IconPlay"
            :loading="busy === 'break_end'"
            :disabled="!!busy"
            class="w-full sm:w-auto sm:min-w-[12rem]"
            @click="act('break_end')"
          >
            End break
          </AppButton>
          <AppButton
            v-if="state.status !== 'off'"
            size="xl"
            :variant="state.status === 'on' ? 'filled' : 'outlined'"
            :icon="IconLogout"
            :loading="busy === 'clock_out'"
            :disabled="!!busy"
            class="w-full sm:w-auto sm:min-w-[12rem]"
            @click="clockOut"
          >
            Clock out
          </AppButton>
        </div>

        <!-- The live clock (server time), below the action -->
        <div class="mt-6 pt-4 border-t border-outline-variant flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div class="text-body-m text-on-surface-variant">
            {{ todayLabel }}
          </div>
          <div
            class="font-display text-headline-s text-on-surface tabular-nums"
            aria-hidden="true"
          >
            {{ clockNow }}
          </div>
        </div>
      </Card>

      <!-- Today's punches -->
      <Card padding="none">
        <div class="px-4 py-3 flex items-center justify-between gap-3 border-b border-outline-variant">
          <h2 class="text-title-m text-on-surface">
            Today
          </h2>
          <div class="text-body-m text-on-surface-variant">
            Worked <span class="text-title-s text-on-surface tabular-nums">{{ formatMinutes(todayMinutes) }}</span>
          </div>
        </div>
        <ul
          v-if="state.today.entries.length"
          class="divide-y divide-outline-variant"
        >
          <li
            v-for="entry in state.today.entries"
            :key="entry.id"
            class="px-4 py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 text-body-l text-on-surface">
                <IconSchedule
                  class="w-5 h-5 flex-none text-on-surface-variant"
                  aria-hidden="true"
                />
                <span>
                  {{ formatClockTime(entry.clockIn) }} – {{ entry.clockOut ? formatClockTime(entry.clockOut) : 'now' }}
                </span>
              </div>
              <div class="text-body-l text-on-surface tabular-nums">
                {{ formatMinutes(liveMinutes(entry)) }}
              </div>
            </div>
            <div
              v-for="b in entry.breaks"
              :key="b.id"
              class="flex items-center gap-3 mt-1 pl-8 text-body-m text-on-surface-variant"
            >
              <IconCoffee
                class="w-4 h-4 flex-none"
                aria-hidden="true"
              />
              Break {{ formatClockTime(b.startedAt) }} – {{ b.endedAt ? formatClockTime(b.endedAt) : 'now' }}
            </div>
          </li>
        </ul>
        <EmptyState
          v-else
          compact
          :icon="IconTimerOff"
          title="No time recorded today"
        />
      </Card>

      <!-- PIN for the shared time clock (/timeclock on the iPad); hidden before migration 13 -->
      <Card v-if="state.hasClockPin !== undefined" padding="lg" tag="section" aria-labelledby="clock-pin-title">
        <div class="flex items-start gap-4">
          <IconPin class="w-6 h-6 mt-0.5 flex-none text-primary" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <h2 id="clock-pin-title" class="text-title-m text-on-surface">Time clock PIN</h2>
            <p class="mt-1 text-body-m text-on-surface-variant">
              <template v-if="state.hasClockPin">
                Set. Use it on the time clock iPad: tap your name, then enter your PIN.
              </template>
              <template v-else>
                Not set yet. Choose one to clock in on the time clock iPad without signing in.
              </template>
            </p>
          </div>
        </div>
        <div class="mt-4 flex sm:justify-end">
          <AppButton :variant="state.hasClockPin ? 'outlined' : 'filled'" class="w-full sm:w-auto" @click="pinOpen = true">
            {{ state.hasClockPin ? 'Change PIN' : 'Set a PIN' }}
          </AppButton>
        </div>
      </Card>
    </template>

    <AppDialog v-model:open="pinOpen" :title="state?.hasClockPin ? 'Change your time clock PIN' : 'Set your time clock PIN'" persistent size="sm">
      <p class="mb-4 text-body-m text-on-surface-variant">
        4 to 6 digits, just for the time clock. Keep it private. Forgot it? A manager can set a new one.
      </p>
      <PinChangeForm endpoint="/api/staff/clock-pin" :has-pin="!!state?.hasClockPin" @saved="onPinSaved" />
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { apiFetch } from '@/lib/api'
import {
  COURSE_TZ, workedMinutes, formatMinutes, formatClockTime, formatLocalDate,
} from '@/lib/timeclock'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import PinChangeForm from '@/components/staff/PinChangeForm.vue'
import IconPin from '~icons/material-symbols/pin-rounded'
import IconLogin from '~icons/material-symbols/login-rounded'
import IconLogout from '~icons/material-symbols/logout-rounded'
import IconCoffee from '~icons/material-symbols/coffee-rounded'
import IconPlay from '~icons/material-symbols/timer-play-rounded'
import IconTimer from '~icons/material-symbols/timer-rounded'
import IconTimerOff from '~icons/material-symbols/timer-off-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'

const confirm  = useConfirm()
const snackbar = useSnackbar()

const state       = ref(null)
const loading     = ref(false)
const loadError   = ref(null)
const busy        = ref(null)     // the action being sent
const actionError = ref(null)
const pinOpen     = ref(false)

function onPinSaved({ changed }) {
  pinOpen.value = false
  state.value = { ...state.value, hasClockPin: true }
  snackbar.show(changed ? 'Time clock PIN changed' : 'Time clock PIN set')
}

// Ticks every second to drive the clock and running totals, on the server's clock (serverTime − client time)
const skew = ref(0)
const now = ref(new Date())
let ticker = null
const tick = () => { now.value = new Date(Date.now() + skew.value) }

function setState(data) {
  state.value = data
  if (data?.serverTime) skew.value = Date.parse(data.serverTime) - Date.now()
  tick()
}

const clockNow = computed(() =>
  now.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: COURSE_TZ }),
)
const todayLabel = computed(() =>
  state.value ? formatLocalDate(state.value.today.date, { weekday: 'long', month: 'long', day: 'numeric' }) : '',
)

const currentBreak = computed(() => state.value?.openEntry?.breaks.find(b => !b.endedAt) ?? null)

const STATUS = {
  off:   { label: 'Off the clock', badge: 'bg-surface-container-highest text-on-surface-variant', icon: IconTimerOff },
  on:    { label: 'On the clock',  badge: 'bg-success-container text-on-success-container', icon: IconTimer },
  break: { label: 'On break',      badge: 'bg-warning-container text-on-warning-container', icon: IconCoffee },
}
const statusStyle = computed(() => STATUS[state.value?.status ?? 'off'])

function liveMinutes(entry) {
  return entry.clockOut ? entry.workedMinutes : workedMinutes(entry, now.value)
}

const todayMinutes = computed(() =>
  (state.value?.today.entries ?? []).reduce((sum, e) => sum + liveMinutes(e), 0),
)

async function load() {
  loading.value   = true
  loadError.value = null
  try {
    setState(await apiFetch('/api/staff/clock'))
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
}

const DONE = {
  clock_in:    s => `Clocked in at ${formatClockTime(s.openEntry?.clockIn)}`,
  break_start: () => 'Break started',
  break_end:   () => 'Break ended',
  clock_out:   s => `Clocked out · ${formatMinutes(s.today.workedMinutes)} today`,
}

async function act(action) {
  busy.value        = action
  actionError.value = null
  try {
    const data = await apiFetch('/api/staff/clock', { method: 'POST', body: { action } })
    setState(data)
    snackbar.show(DONE[action](data))
  } catch (e) {
    actionError.value = e.message
    // The state may have changed elsewhere (another device); refresh it
    await load()
  } finally {
    busy.value = null
  }
}

async function clockOut() {
  const ok = await confirm({
    title: 'Clock out now?',
    message: `You've worked ${formatMinutes(todayMinutes.value)} today.${currentBreak.value ? ' Your break will end when you clock out.' : ''}`,
    confirmLabel: 'Clock out',
    icon: IconLogout,
  })
  if (ok) await act('clock_out')
}

onMounted(() => {
  load()
  ticker = setInterval(tick, 1000)
})
onBeforeUnmount(() => clearInterval(ticker))
</script>
