<template>
  <div class="space-y-6">
    <div
      class="flex flex-wrap gap-2"
      role="group"
      aria-label="Preview page"
    >
      <button
        v-for="p in pages"
        :key="p.path"
        type="button"
        :class="[
          'state-layer h-8 px-3 rounded-shape-sm border text-label-l cursor-pointer',
          fakeRoute.path === p.path ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-on-surface-variant',
        ]"
        @click="show(p)"
      >
        {{ p.meta.title }}
      </button>
    </div>

    <!-- transform contains the shell's fixed/sticky parts -->
    <div
      class="shell-box relative overflow-hidden rounded-shape-md border border-outline-variant"
      style="transform: translateZ(0)"
    >
      <div class="h-full overflow-y-auto">
        <AdminLayout>
          <ScheduleView v-if="fakeRoute.path === '/admin/schedule'" />
          <TimeOffView v-else />
        </AdminLayout>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="text-title-m">
        Read-only (staff My Schedule: whole team, own row highlighted)
      </h3>
      <ScheduleGrid
        :dates="weekDates"
        :employees="EMPLOYEES"
        :shifts="store.shifts"
        :time-off="TIME_OFF"
        highlight-employee-id="e3"
      />
      <ScheduleMonth
        :dates="monthDates"
        :month="monthPeriod.start.slice(0, 7)"
        :employees="EMPLOYEES"
        :shifts="store.shifts"
        :time-off="TIME_OFF"
        highlight-employee-id="e3"
      />
      <ScheduleLegend :warnings="false" />
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Admin schedule and time off (preview)',
  galleryNote: 'The admin Schedule and Time Off pages inside AdminLayout, with a fake route/router and a fetch stub for /api/admin/shifts and /api/admin/time-off (in memory: add, edit, delete, copy, email, decisions work). Below: the read-only grid and month (agenda below md) as the staff page uses them.',
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, provide, reactive, computed } from 'vue'
import { routeLocationKey, routerKey, useRouter } from 'vue-router'
import AdminLayout from '@/views/admin/AdminLayout.vue'
import ScheduleView from '@/views/admin/ScheduleView.vue'
import TimeOffView from '@/views/admin/TimeOffView.vue'
import ScheduleGrid from '@/components/schedule/ScheduleGrid.vue'
import ScheduleMonth from '@/components/schedule/ScheduleMonth.vue'
import ScheduleLegend from '@/components/schedule/ScheduleLegend.vue'
import { useAuthStore } from '@/stores/auth'
import { addDays, localDate } from '@/lib/timeclock'
import { schedulePeriod, datesBetween, SCHEDULE_VIEWS } from '@/lib/schedule'

const pages = [
  { path: '/admin/schedule', meta: { title: 'Schedule' } },
  { path: '/admin/time-off', meta: { title: 'Time Off Requests' } },
]

// Fake route + a router whose replace() only changes the fake route's query (RouterLinks still resolve normally)
const fakeRoute = reactive({ path: pages[0].path, fullPath: pages[0].path, meta: pages[0].meta, params: {}, query: {}, hash: '', matched: [] })
provide(routeLocationKey, fakeRoute)
const realRouter = useRouter()
const fakeRouter = Object.create(realRouter)
fakeRouter.replace = (to) => {
  fakeRoute.query = { ...(to.query ?? {}) }
  return Promise.resolve()
}
provide(routerKey, fakeRouter)
function show(p) {
  Object.assign(fakeRoute, { path: p.path, fullPath: p.path, meta: p.meta, query: {} })
}

// ─── Fake data ──────────────────────────────────────────────────────────────
const today = localDate()
const EMPLOYEES = [
  { id: 'e1', firstName: 'Dana', lastName: 'Whitfield', position: 'GENERAL_MANAGER', active: true },
  { id: 'e2', firstName: 'Marcus', lastName: 'Bell', position: 'HEAD_GOLF_PROFESSIONAL', active: true },
  { id: 'e3', firstName: 'Kayla', lastName: 'Ortiz', position: 'PRO_SHOP_ATTENDANT', active: true },
  { id: 'e4', firstName: 'Tom', lastName: 'Rigsby', position: 'GROUNDS_CREW', active: true },
  { id: 'e5', firstName: 'Lena', lastName: 'Hart', position: 'SERVER', active: true },
  { id: 'e6', firstName: 'Ray', lastName: 'Cobb', position: 'STARTER', active: false },
]
const TIME_OFF = [
  { id: 't1', employeeId: 'e5', startDate: addDays(today, 1), endDate: addDays(today, 2), status: 'APPROVED', type: 'VACATION' },
  { id: 't2', employeeId: 'e4', startDate: addDays(today, 3), endDate: addDays(today, 3), status: 'PENDING', type: 'PERSONAL' },
]
const PATTERN = [
  ['e1', 0, '08:00', '16:30'], ['e1', 1, '08:00', '16:30'], ['e1', 3, '08:00', '16:30'],
  ['e2', 0, '06:30', '14:30'], ['e2', 2, '06:30', '14:30'], ['e2', 4, '06:30', '14:30', null, 'Lessons 2-4'],
  ['e3', 0, '13:00', '19:00'], ['e3', 1, '07:00', '13:00'], ['e3', 1, '12:00', '18:00'], ['e3', 5, '07:00', '15:00', 'STARTER'],
  ['e4', 0, '05:30', '13:30'], ['e4', 3, '05:30', '13:30'], ['e4', 4, '05:30', '13:30'],
  ['e5', 1, '11:00', '21:00'], ['e5', 5, '16:00', '01:00', null, 'Tournament dinner'],
  ['e6', 2, '07:00', '12:00'],
]
let nextId = 1
const store = reactive({ shifts: [] })
for (let w = -14; w <= 35; w += 7) {
  for (const [employeeId, d, startTime, endTime, position = null, notes = null] of PATTERN) {
    store.shifts.push({ id: `s${nextId++}`, employeeId, date: addDays(today, w + d), startTime, endTime, position, notes })
  }
}
const timeOffRequests = reactive([
  {
    id: 'r1', status: 'PENDING', type: 'PERSONAL', startDate: TIME_OFF[1].startDate, endDate: TIME_OFF[1].endDate, days: 1,
    reason: 'Family wedding out of town', createdAt: new Date().toISOString(), employee: EMPLOYEES[3],
    scheduledShifts: store.shifts.filter(s => s.employeeId === 'e4' && s.date === TIME_OFF[1].startDate),
  },
  {
    id: 'r2', status: 'APPROVED', type: 'VACATION', startDate: TIME_OFF[0].startDate, endDate: TIME_OFF[0].endDate, days: 2,
    reason: null, createdAt: new Date(Date.now() - 5 * 864e5).toISOString(), reviewedAt: new Date(Date.now() - 4 * 864e5).toISOString(),
    reviewedByName: 'Dana Whitfield', employee: EMPLOYEES[4], scheduledShifts: [],
  },
  {
    id: 'r3', status: 'PENDING', type: 'SICK', startDate: addDays(today, 8), endDate: addDays(today, 12), days: 5,
    reason: null, createdAt: new Date().toISOString(), employee: EMPLOYEES[5], scheduledShifts: [],
  },
])

const weekDates = computed(() => { const p = schedulePeriod('week', today); return datesBetween(p.start, p.end) })
const monthPeriod = schedulePeriod('month', today)
const monthDates = datesBetween(monthPeriod.gridStart, monthPeriod.gridEnd)

// ─── fetch stub ─────────────────────────────────────────────────────────────
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const realFetch = window.fetch
window.fetch = async (input, opts = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url, location.origin)
  const method = (opts.method ?? 'GET').toUpperCase()
  const body = opts.body ? JSON.parse(opts.body) : null
  const p = u.pathname
  await new Promise(r => setTimeout(r, 250))
  if (p === '/api/admin/shifts' && method === 'GET') {
    const view = SCHEDULE_VIEWS[u.searchParams.get('view')] ? u.searchParams.get('view') : 'week'
    const period = schedulePeriod(view, u.searchParams.get('date') || today)
    const shifts = store.shifts.filter(s => s.date >= period.gridStart && s.date <= period.gridEnd)
    return json({ period, employees: EMPLOYEES, shifts, timeOff: TIME_OFF })
  }
  if (p === '/api/admin/shifts' && method === 'POST') {
    const s = { id: `s${nextId++}`, ...body }
    store.shifts.push(s)
    return json(s, 201)
  }
  if (p === '/api/admin/shifts/copy') return json({ created: 12, skippedExisting: 3, skippedInactive: 1 })
  if (p === '/api/admin/shifts/email') {
    return json({ sent: 4, skippedNoEmail: 1, skippedInactive: 0, failed: [{ employeeId: 'e5', name: 'Lena Hart', error: 'Mailbox unavailable' }] })
  }
  const shiftMatch = p.match(/^\/api\/admin\/shifts\/(s\d+)$/)
  if (shiftMatch) {
    const i = store.shifts.findIndex(s => s.id === shiftMatch[1])
    if (method === 'DELETE') { store.shifts.splice(i, 1); return json({ ok: true }) }
    Object.assign(store.shifts[i], body)
    return json({ ...store.shifts[i] })
  }
  if (p === '/api/admin/time-off/count') return json({ pending: timeOffRequests.filter(r => r.status === 'PENDING').length })
  if (p === '/api/admin/time-off') {
    const status = u.searchParams.get('status')
    return json(timeOffRequests.filter(r => status === 'all' || r.status === status))
  }
  const toMatch = p.match(/^\/api\/admin\/time-off\/(r\d+)$/)
  if (toMatch) {
    const r = timeOffRequests.find(x => x.id === toMatch[1])
    r.status = body.action === 'approve' ? 'APPROVED' : 'DENIED'
    r.reviewedAt = new Date().toISOString()
    r.reviewedByName = 'Gallery Admin'
    r.reviewNote = body.action === 'revoke' ? `Approval revoked: ${body.note}` : body.note || null
    return json({ ok: true })
  }
  return realFetch(input, opts)
}

// A signed-in admin who is also staff
const authStore = useAuthStore()
let savedProfile = null
onMounted(() => {
  savedProfile = authStore.profile
  if (!savedProfile) authStore.profile = { email: 'gm@example.com', role: 'ADMIN', employee: { active: true } }
})
onBeforeUnmount(() => {
  window.fetch = realFetch
  authStore.profile = savedProfile
})
</script>

<style scoped>
.shell-box { height: 820px; }
</style>
