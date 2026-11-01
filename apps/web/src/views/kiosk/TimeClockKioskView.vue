<template>
  <div class="min-h-[100dvh] flex flex-col bg-surface font-body select-none">
    <!-- Header: the course, this device, and the time (server clock) -->
    <header class="bg-primary on-dark text-on-primary">
      <div class="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center gap-4">
        <BrandLogo variant="mark" :size="48" eager alt="" />
        <div class="min-w-0 flex-1">
          <h1 class="font-display text-headline-s leading-tight">Time Clock</h1>
          <p class="text-body-m text-on-primary/90 truncate">{{ kioskName || 'Deer Run Golf Course' }}</p>
        </div>
        <div class="text-right" aria-hidden="true">
          <div class="font-display text-headline-m tabular-nums leading-tight">{{ clockLabel }}</div>
          <div class="text-body-m text-on-primary/90">{{ dateLabel }}</div>
        </div>
      </div>
    </header>

    <main class="flex-1 min-h-0 flex flex-col w-full max-w-6xl mx-auto px-4 md:px-8 pt-6">
      <div v-if="screen === 'loading'" class="flex-1 flex items-center justify-center">
        <ProgressIndicator :size="48" label="Loading the time clock" />
      </div>

      <KioskSetup
        v-else-if="screen === 'setup'"
        :is-admin="auth.isAdmin"
        :signed-in-as="auth.isLoggedIn ? (auth.profile?.name || auth.profile?.email || '') : ''"
        :busy="setupBusy"
        :error="setupError"
        :notice="setupNotice"
        @setup="setUp"
      />

      <template v-else>
        <ErrorBanner
          v-if="listError"
          class="mb-4"
          :message="listError"
          :retrying="refreshing"
          @retry="refresh"
        />

        <!-- After a failed load with nothing to show, the banner says it all (not "No employees yet") -->
        <KioskEmployeePicker
          v-if="screen === 'list' && (employees.length || !listError)"
          v-model:search="search"
          :employees="employees"
          @pick="pick"
        />

        <KioskPinStep
          v-else-if="screen === 'pin' && picked"
          v-model:pin="pin"
          :employee="picked"
          :error="pinError"
          :busy="pinBusy"
          @submit="signIn"
          @back="reset"
        />

        <KioskActionStep
          v-else-if="screen === 'actions' && session"
          :state="session"
          :now="now"
          :busy="actionBusy"
          :error="actionError"
          @act="act"
          @close="reset"
        />

        <KioskDoneStep v-else-if="screen === 'done' && done" :done="done" :seconds-left="doneLeft" @close="reset" />
      </template>
    </main>
  </div>
</template>

<script setup>
// /timeclock: the standalone time clock for a shared iPad (no one signed in). An admin sets the device up once
// (POST /api/admin/kiosks → token in localStorage). Then: tap your name → type your time clock PIN → clock in / out,
// start / end a break → a done screen that returns to the names. Each request sends the PIN again
// (POST /api/kiosk/clock); it's only held in memory while that employee's screen is open and dropped after
// IDLE_SECONDS untouched. Keeps the screen awake (Screen Wake Lock) and uses its own web app manifest, so "Add to
// Home Screen" opens straight here. Set-up notes for the iPad: docs/timeclock-kiosk.md.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useHead } from '@unhead/vue'
import { apiFetch } from '@/lib/api'
import { kioskFetch, getKioskToken, setKioskToken } from '@/lib/kioskApi'
import { COURSE_TZ } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import KioskSetup from '@/components/kiosk/KioskSetup.vue'
import KioskEmployeePicker from '@/components/kiosk/KioskEmployeePicker.vue'
import KioskPinStep from '@/components/kiosk/KioskPinStep.vue'
import KioskActionStep from '@/components/kiosk/KioskActionStep.vue'
import KioskDoneStep from '@/components/kiosk/KioskDoneStep.vue'
import { DONE_SECONDS, IDLE_SECONDS, REFRESH_SECONDS, doneMessage } from '@/components/kiosk/kioskDisplay'
import IconLogout from '~icons/material-symbols/logout-rounded'

const auth = useAuthStore()
const confirm = useConfirm()

useHead({
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: 'Time Clock' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
  ],
})

// loading | setup | list | pin | actions | done
const screen = ref('loading')
const kioskName = ref('')

// ── Clock (server time) ──
const skew = ref(0)
const now = ref(new Date())
const syncClock = (serverTime) => { if (serverTime) skew.value = Date.parse(serverTime) - Date.now() }
const clockLabel = computed(() => now.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ }))
const dateLabel = computed(() => now.value.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: COURSE_TZ }))

// ── Set up ──
const setupBusy = ref(false)
const setupError = ref('')
const setupNotice = ref('')

async function setUp(name) {
  setupBusy.value = true
  setupError.value = ''
  try {
    const { token, kiosk } = await apiFetch('/api/admin/kiosks', { method: 'POST', body: { name } })
    setKioskToken(token)
    kioskName.value = kiosk.name
    setupNotice.value = ''
    // Don't leave an admin signed in on a shared device
    await auth.logout()
    await refresh()
  } catch (e) {
    setupError.value = e.message
  } finally {
    setupBusy.value = false
  }
}

function needsSetup(notice = '') {
  setKioskToken(null)
  setupNotice.value = notice
  screen.value = 'setup'
}

// ── Names ──
const employees = ref([])
const search = ref('')
const listError = ref('')
const refreshing = ref(false)
let lastRefresh = 0

async function refresh() {
  if (!getKioskToken()) return needsSetup()
  refreshing.value = true
  try {
    const data = await kioskFetch('/api/kiosk/employees')
    employees.value = data.employees
    kioskName.value = data.kiosk.name
    syncClock(data.serverTime)
    listError.value = ''
    lastRefresh = Date.now()
    if (screen.value === 'loading' || screen.value === 'setup') screen.value = 'list'
  } catch (e) {
    if (e.code === 'KIOSK_NOT_SET_UP') return needsSetup(getKioskToken() ? 'This device was removed as a time clock. Set it up again to use it.' : '')
    listError.value = e.message
    if (screen.value === 'loading') screen.value = 'list'
  } finally {
    refreshing.value = false
  }
}

// ── One employee's turn: PIN, then actions, then done ──
const picked = ref(null)
const pin = ref('')
const pinError = ref('')
const pinBusy = ref(false)
const session = ref(null) // clockStatus for the signed-in employee
const actionBusy = ref(null)
const actionError = ref('')
const done = ref(null)
const doneLeft = ref(0)

function pick(e) {
  picked.value = e
  pin.value = ''
  pinError.value = ''
  screen.value = 'pin'
}

// Back to the names; nothing about the last employee is kept
function reset() {
  picked.value = null
  pin.value = ''
  pinError.value = ''
  session.value = null
  actionError.value = ''
  actionBusy.value = null
  done.value = null
  search.value = ''
  screen.value = 'list'
  if (Date.now() - lastRefresh > 5_000) refresh()
}

// A PIN problem on the server: show it on the keypad (and the lock / no-PIN screens when that's what it is)
function pinFailed(e) {
  pin.value = ''
  if (e.code === 'PIN_LOCKED') picked.value = { ...picked.value, pinLocked: true }
  if (e.code === 'PIN_NOT_SET') picked.value = { ...picked.value, hasPin: false }
  if (e.code === 'KIOSK_NOT_SET_UP') return needsSetup('This device was removed as a time clock. Set it up again to use it.')
  if (e.code === 'EMPLOYEE_NOT_FOUND') { reset(); listError.value = 'That employee is no longer active.'; return }
  pinError.value = e.message
}

async function signIn() {
  if (pinBusy.value || !pin.value) return
  pinBusy.value = true
  pinError.value = ''
  try {
    const state = await kioskFetch('/api/kiosk/clock', { method: 'POST', body: { employeeId: picked.value.id, pin: pin.value } })
    syncClock(state.serverTime)
    session.value = state
    screen.value = 'actions'
  } catch (e) {
    pinFailed(e)
  } finally {
    pinBusy.value = false
  }
}

async function act(action) {
  if (action === 'clock_out') {
    const ok = await confirm({
      title: `Clock out, ${session.value.employee.firstName}?`,
      message: session.value.status === 'break' ? 'Your break ends when you clock out.' : 'This ends your shift for now.',
      confirmLabel: 'Clock out',
      icon: IconLogout,
    })
    // Gone back to the names meanwhile (the dialog sat open past the idle timeout)
    if (!ok || !session.value) return
  }
  actionBusy.value = action
  actionError.value = ''
  try {
    const state = await kioskFetch('/api/kiosk/clock', {
      method: 'POST', body: { employeeId: picked.value.id, pin: pin.value, action },
    })
    syncClock(state.serverTime)
    showDone(doneMessage(action, state))
    // Update the tile now; the list refreshes when the done screen closes
    employees.value = employees.value.map(e => (e.id === picked.value.id ? { ...e, status: state.status } : e))
  } catch (e) {
    if (e.status === 409 && e.data?.status) {
      // Punched somewhere else meanwhile (the staff portal): show the current state with the message
      session.value = e.data
      actionError.value = e.message
    } else if (['PIN_WRONG', 'PIN_LOCKED', 'PIN_NOT_SET'].includes(e.code)) {
      // The PIN changed or was reset since they signed in: start their turn again
      screen.value = 'pin'
      pinFailed(e)
    } else {
      actionError.value = e.message
    }
  } finally {
    actionBusy.value = null
  }
}

function showDone(message) {
  pin.value = ''
  session.value = null
  done.value = message
  doneLeft.value = DONE_SECONDS
  screen.value = 'done'
}

// ── Idle: back to the names after IDLE_SECONDS untouched (drops the PIN). Listens on the document, so touches in
// the confirm dialog (teleported outside this page) count too ──
let lastTouch = Date.now()
const poke = () => { lastTouch = Date.now() }

function everySecond() {
  now.value = new Date(Date.now() + skew.value)
  const idle = (Date.now() - lastTouch) / 1000
  if (screen.value === 'done') {
    doneLeft.value -= 1
    if (doneLeft.value <= 0) reset()
  } else if ((screen.value === 'pin' || screen.value === 'actions') && idle >= IDLE_SECONDS && !pinBusy.value && !actionBusy.value) {
    reset()
  } else if (screen.value === 'list') {
    if (search.value && idle >= IDLE_SECONDS) search.value = ''
    if (Date.now() - lastRefresh >= REFRESH_SECONDS * 1000 && !refreshing.value) refresh()
  }
}

// ── Keep the iPad awake while the time clock is open (Screen Wake Lock: iPadOS 16.4+; ignored where unsupported) ──
let wakeLock = null
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    wakeLock = null
  }
}
function onVisibility() {
  if (document.visibilityState === 'visible') {
    keepAwake()
    if (screen.value === 'list') refresh()
  }
}

// ── "Add to Home Screen" should open the time clock, not the home page: point the manifest link at our own ──
let manifestLink = null
let siteManifest = null
function useKioskManifest() {
  manifestLink = document.querySelector('link[rel="manifest"]')
  if (!manifestLink) return
  siteManifest = manifestLink.getAttribute('href')
  manifestLink.setAttribute('href', '/timeclock.webmanifest')
}

let timer = null
onMounted(() => {
  useKioskManifest()
  keepAwake()
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('pointerdown', poke, true)
  document.addEventListener('keydown', poke, true)
  timer = setInterval(everySecond, 1000)
  if (getKioskToken()) refresh()
  else needsSetup()
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
  document.removeEventListener('pointerdown', poke, true)
  document.removeEventListener('keydown', poke, true)
  wakeLock?.release().catch(() => {})
  if (manifestLink && siteManifest) manifestLink.setAttribute('href', siteManifest)
})
</script>
