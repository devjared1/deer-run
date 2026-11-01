<template>
  <div class="space-y-3">
    <div
      class="flex flex-wrap gap-2"
      role="group"
      aria-label="Preview page"
    >
      <button
        v-for="p in pages"
        :key="p.key"
        type="button"
        :class="[
          'state-layer h-8 px-3 rounded-shape-sm border text-label-l cursor-pointer',
          current.key === p.key ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-on-surface-variant',
        ]"
        @click="show(p)"
      >
        {{ p.title }}
      </button>
    </div>

    <!-- transform contains the shell's fixed parts (bottom bar, FAB); dialogs still teleport to <body> -->
    <div
      class="shell-box relative overflow-hidden rounded-shape-md border border-outline-variant"
      style="transform: translateZ(0)"
    >
      <StaffLayout
        v-if="ready"
        :preview-path="current.path"
        contained
        :clock="clockForLayout"
        @update:preview-path="onNav"
      >
        <component
          :is="current.component"
          :key="current.key"
        />
      </StaffLayout>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Staff pages (preview)',
  galleryNote: 'Time Clock, My Timesheet, My Schedule, Time Off and Manager PIN inside StaffLayout with fake data: /api/staff/* is answered in the browser (in memory: punches, requests, cancel and PIN changes work; the current PIN is 1234). URL: ?section=staffpages &page= clock, timesheet, schedule, timeoff or pin; &clock= on, break or off.',
}
</script>

<script setup>
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef } from 'vue'
import { routeLocationKey, routerKey, useRouter } from 'vue-router'
import StaffLayout from '@/views/staff/StaffLayout.vue'
import TimeClockView from '@/views/staff/TimeClockView.vue'
import MyTimesheetView from '@/views/staff/MyTimesheetView.vue'
import MyScheduleView from '@/views/staff/MyScheduleView.vue'
import TimeOffView from '@/views/staff/TimeOffView.vue'
import ManagerPinView from '@/views/staff/ManagerPinView.vue'
import { useAuthStore } from '@/stores/auth'
import {
  addDays, localDate, localDateTimeToUtc, payPeriodContaining, weekStart, dayOfWeek, workedMinutes, breakMinutes,
  splitOvertime, daysBetween, DEFAULT_PAY_PERIOD,
} from '@/lib/timeclock'
import { schedulePeriod, SCHEDULE_VIEWS } from '@/lib/schedule'

const params = new URLSearchParams(location.search)

const pages = [
  { key: 'clock', path: '/staff', title: 'Time Clock', component: TimeClockView },
  { key: 'timesheet', path: '/staff/timesheet', title: 'My Timesheet', component: MyTimesheetView },
  { key: 'schedule', path: '/staff/schedule', title: 'My Schedule', component: MyScheduleView },
  { key: 'timeoff', path: '/staff/time-off', title: 'Time Off', component: TimeOffView },
  { key: 'pin', path: '/staff/pin', title: 'Manager PIN', component: ManagerPinView },
]
const current = shallowRef(pages.find(p => p.key === params.get('page')) ?? pages[0])

// Fake route + a router whose replace() only changes the fake route's query (RouterLinks still resolve normally)
const fakeRoute = reactive({ path: current.value.path, fullPath: current.value.path, meta: {}, params: {}, query: {}, hash: '', matched: [] })
provide(routeLocationKey, fakeRoute)
const realRouter = useRouter()
const fakeRouter = Object.create(realRouter)
fakeRouter.replace = (to) => {
  fakeRoute.query = { ...(to.query ?? {}) }
  return Promise.resolve()
}
provide(routerKey, fakeRouter)

function show(p) {
  Object.assign(fakeRoute, { path: p.path, fullPath: p.path, query: {} })
  current.value = p
}
function onNav(path) {
  const p = pages.find(x => x.path === path)
  if (p) show(p)
}

// ── Fake data ──
const today = localDate()
const at = (ymd, hhmm) => localDateTimeToUtc(ymd, hhmm).toISOString()
const ME = 'e3'

// Clock: today's entries (in memory)
const clockState = ['on', 'break', 'off'].includes(params.get('clock')) ? params.get('clock') : 'on'
const minsAgo = m => new Date(Date.now() - m * 60000).toISOString()
let nextId = 1
const todayEntries = reactive([])
if (clockState !== 'off') {
  todayEntries.push({
    id: `t${nextId++}`, clockIn: minsAgo(192), clockOut: null, editedAt: null,
    breaks: clockState === 'break'
      ? [{ id: 'b1', startedAt: minsAgo(100), endedAt: minsAgo(85) }, { id: 'b2', startedAt: minsAgo(8), endedAt: null }]
      : [{ id: 'b1', startedAt: minsAgo(100), endedAt: minsAgo(85) }],
  })
} else {
  todayEntries.push({ id: `t${nextId++}`, clockIn: minsAgo(420), clockOut: minsAgo(60), editedAt: null, breaks: [{ id: 'b1', startedAt: minsAgo(260), endedAt: minsAgo(230) }] })
}

function serialize(e, now = new Date()) {
  return { ...e, date: localDate(new Date(e.clockIn)), breakMinutes: breakMinutes(e, now), workedMinutes: workedMinutes(e, now), longOpen: false }
}
function clockStatus() {
  const now = new Date()
  const entries = todayEntries.map(e => serialize(e, now))
  const open = entries.find(e => !e.clockOut) ?? null
  return {
    status: !open ? 'off' : open.breaks.some(b => !b.endedAt) ? 'break' : 'on',
    openEntry: open,
    today: { date: today, entries, workedMinutes: entries.reduce((s, e) => s + e.workedMinutes, 0) },
    serverTime: now.toISOString(),
    employee: { id: ME, firstName: 'Kayla', lastName: 'Ortiz', position: 'PRO_SHOP_ATTENDANT' },
  }
}
function punch(action) {
  const open = todayEntries.find(e => !e.clockOut)
  const nowIso = new Date().toISOString()
  if (action === 'clock_in') {
    if (open) return { error: "You're already on the clock" }
    todayEntries.push({ id: `t${nextId++}`, clockIn: nowIso, clockOut: null, editedAt: null, breaks: [] })
  } else if (!open) {
    return { error: "You're not on the clock" }
  } else if (action === 'break_start') {
    open.breaks.push({ id: `b${nextId++}`, startedAt: nowIso, endedAt: null })
  } else if (action === 'break_end') {
    const b = open.breaks.find(x => !x.endedAt)
    if (!b) return { error: "You're not on a break" }
    b.endedAt = nowIso
  } else if (action === 'clock_out') {
    open.breaks.filter(b => !b.endedAt).forEach(b => { b.endedAt = nowIso })
    open.clockOut = nowIso
  }
  return clockStatus()
}
const clockForLayout = computed(() => clockStatus())

// Timesheet: weekdays 8:00–16:30 with a 30 min lunch, a long Thursday (overtime), one edited punch
function timesheet(date) {
  const payPeriod = DEFAULT_PAY_PERIOD
  const { start, end } = payPeriodContaining(date || today, payPeriod)
  const period = {
    start, end, lengthDays: payPeriod.lengthDays, weekStartDay: dayOfWeek(payPeriod.anchor),
    prevStart: addDays(start, -payPeriod.lengthDays), nextStart: addDays(end, 1),
  }
  const now = new Date()
  const entries = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (d === today) {
      todayEntries.forEach(e => entries.push(serialize(e, now)))
      continue
    }
    const dow = dayOfWeek(d)
    if (d > today || dow === 0 || dow === 6) continue
    const late = dow === 4
    entries.push(serialize({
      id: `ts-${d}`, clockIn: at(d, '07:58'), clockOut: at(d, late ? '19:15' : '16:31'),
      editedAt: daysBetween(d, today) === 3 ? at(today, '09:00') : null,
      breaks: [{ id: `tb-${d}`, startedAt: at(d, '12:00'), endedAt: at(d, '12:30') }],
    }, now))
    if (dow === 2) {
      entries.push(serialize({ id: `ts2-${d}`, clockIn: at(d, '18:00'), clockOut: at(d, '21:00'), editedAt: null, breaks: [] }, now))
    }
  }
  const days = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const de = entries.filter(e => e.date === d)
    days.push({ date: d, entries: de, workedMinutes: de.reduce((s, e) => s + e.workedMinutes, 0) })
  }
  const weekMinutes = {}
  for (const day of days) {
    const ws = weekStart(day.date, period.weekStartDay)
    weekMinutes[ws] = (weekMinutes[ws] || 0) + day.workedMinutes
  }
  const weeks = Object.entries(weekMinutes).map(([ws, minutes]) => ({ weekStart: ws, workedMinutes: minutes, ...splitOvertime(minutes) }))
  return {
    period, days, weeks,
    workedMinutes: weeks.reduce((s, w) => s + w.workedMinutes, 0),
    regular: weeks.reduce((s, w) => s + w.regular, 0),
    overtime: weeks.reduce((s, w) => s + w.overtime, 0),
    openEntries: entries.filter(e => !e.clockOut).length,
    longOpenEntries: 0,
  }
}

// Schedule
const EMPLOYEES = [
  { id: 'e1', firstName: 'Dana', lastName: 'Whitfield', position: 'GENERAL_MANAGER', active: true },
  { id: 'e2', firstName: 'Marcus', lastName: 'Bell', position: 'HEAD_GOLF_PROFESSIONAL', active: true },
  { id: 'e3', firstName: 'Kayla', lastName: 'Ortiz', position: 'PRO_SHOP_ATTENDANT', active: true },
  { id: 'e4', firstName: 'Tom', lastName: 'Rigsby', position: 'GROUNDS_CREW', active: true },
  { id: 'e5', firstName: 'Lena', lastName: 'Hart', position: 'SERVER', active: true },
]
const TEAM_TIME_OFF = [
  { id: 'o1', employeeId: 'e5', startDate: addDays(today, 1), endDate: addDays(today, 2), status: 'APPROVED' },
  { id: 'o2', employeeId: ME, startDate: addDays(today, 4), endDate: addDays(today, 4), status: 'APPROVED', type: 'PERSONAL' },
]
const PATTERN = [
  ['e1', 0, '08:00', '16:30'], ['e1', 1, '08:00', '16:30'], ['e1', 3, '08:00', '16:30'],
  ['e2', 0, '06:30', '14:30'], ['e2', 2, '06:30', '14:30'], ['e2', 4, '06:30', '14:30', null, 'Lessons 2-4'],
  [ME, 0, '13:00', '19:00'], [ME, 1, '07:00', '13:00'], [ME, 2, '07:00', '15:00', 'STARTER'], [ME, 5, '07:00', '15:00', null, 'Member-guest setup'],
  ['e4', 0, '05:30', '13:30'], ['e4', 3, '05:30', '13:30'], ['e4', 4, '05:30', '13:30'],
  ['e5', 1, '11:00', '21:00'], ['e5', 5, '16:00', '01:00', null, 'Tournament dinner'],
]
const SHIFTS = []
for (let w = -42; w <= 42; w += 7) {
  for (const [employeeId, d, startTime, endTime, position = null, notes = null] of PATTERN) {
    SHIFTS.push({ id: `s${SHIFTS.length}`, employeeId, date: addDays(weekStart(today), w + d), startTime, endTime, position, notes })
  }
}
function schedule(url) {
  const view = SCHEDULE_VIEWS[url.searchParams.get('view')] ? url.searchParams.get('view') : 'week'
  const period = schedulePeriod(view, url.searchParams.get('date') || today, { anchor: DEFAULT_PAY_PERIOD.anchor })
  const team = url.searchParams.get('team') === '1'
  const inRange = x => x.date >= period.gridStart && x.date <= period.gridEnd
  return {
    period,
    employeeId: ME,
    employees: team ? EMPLOYEES : EMPLOYEES.filter(e => e.id === ME),
    shifts: SHIFTS.filter(s => inRange(s) && (team || s.employeeId === ME)),
    timeOff: TEAM_TIME_OFF.filter(r => team || r.employeeId === ME),
  }
}

// Time off
const requests = reactive([
  { id: 'r1', status: 'PENDING', type: 'VACATION', startDate: addDays(today, 18), endDate: addDays(today, 22), days: 5, reason: 'Beach trip with the family', reviewNote: null },
  { id: 'r2', status: 'APPROVED', type: 'PERSONAL', startDate: addDays(today, 4), endDate: addDays(today, 4), days: 1, reason: null, reviewNote: 'Enjoy it' },
  { id: 'r3', status: 'DENIED', type: 'VACATION', startDate: addDays(today, 9), endDate: addDays(today, 10), days: 2, reason: 'Concert', reviewNote: 'Member-guest weekend: we need everyone. Can you swap with Tom?' },
  { id: 'r4', status: 'CANCELLED', type: 'SICK', startDate: addDays(today, -12), endDate: addDays(today, -12), days: 1, reason: null, reviewNote: null },
])

// PIN
const pin = reactive({ value: '1234' })

function route(method, path, url, body) {
  if (path === '/api/staff/clock') return method === 'POST' ? punch(body.action) : clockStatus()
  if (path === '/api/staff/timesheet') return timesheet(url.searchParams.get('date'))
  if (path === '/api/staff/schedule') return schedule(url)
  if (path === '/api/staff/time-off' && method === 'GET') return [...requests].sort((a, b) => b.startDate.localeCompare(a.startDate))
  if (path === '/api/staff/time-off' && method === 'POST') {
    const r = { id: `r${requests.length + 1}`, status: 'PENDING', type: body.type, startDate: body.startDate, endDate: body.endDate, days: daysBetween(body.startDate, body.endDate) + 1, reason: body.reason || null, reviewNote: null }
    requests.push(r)
    const scheduledShifts = SHIFTS.filter(s => s.employeeId === ME && s.date >= r.startDate && s.date <= r.endDate)
    return [{ ...r, scheduledShifts }, 201]
  }
  const m = path.match(/^\/api\/staff\/time-off\/(r\d+)$/)
  if (m) {
    const r = requests.find(x => x.id === m[1])
    if (r.status !== 'PENDING') return [{ error: `This request was already ${r.status.toLowerCase()}` }, 409]
    r.status = 'CANCELLED'
    return { ...r }
  }
  if (path === '/api/staff/pin' && method === 'GET') return { hasPin: true, lockedUntil: null }
  if (path === '/api/staff/pin' && method === 'PUT') {
    if (body.currentPin !== pin.value) return [{ error: "That isn't your current PIN" }, 403]
    pin.value = body.newPin
    return { ok: true }
  }
  return null
}

// Answer /api/staff/* in the browser (plain Vite has no Functions); everything else goes to the real fetch
const realFetch = window.fetch
const ready = ref(false)
const authStore = useAuthStore()
let savedProfile = null
onMounted(() => {
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
    if (!url.pathname.startsWith('/api/staff/')) return realFetch(input, init)
    const result = route((init.method || 'GET').toUpperCase(), url.pathname, url, init.body ? JSON.parse(init.body) : null)
    await new Promise(r => setTimeout(r, 250))
    const [body, status] = Array.isArray(result) && typeof result[1] === 'number' ? result : [result, result?.error ? 409 : 200]
    if (body === null) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }
  savedProfile = authStore.profile
  authStore.profile = {
    id: 'preview', email: 'kayla@example.com', role: 'GUEST',
    canUseRegister: true, canTrackCourse: true, isRegisterManager: true,
    employee: { id: ME, firstName: 'Kayla', lastName: 'Ortiz', position: 'PRO_SHOP_ATTENDANT', active: true },
  }
  ready.value = true
})
onBeforeUnmount(() => {
  window.fetch = realFetch
  authStore.profile = savedProfile
})
</script>

<style scoped>
.shell-box { height: 860px; }
</style>
