<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2" role="group" aria-label="Preview page">
      <button
        v-for="p in pages"
        :key="p.key"
        type="button"
        :class="[
          'state-layer h-8 px-3 rounded-shape-sm border text-label-l cursor-pointer',
          page === p.key ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-on-surface-variant',
        ]"
        @click="show(p)"
      >
        {{ p.meta.title }}
      </button>
    </div>

    <div class="relative rounded-shape-md border border-outline-variant" style="transform: translateZ(0)">
      <AdminLayout>
        <SettingsView v-if="page === 'settings'" key="settings" />
        <EmployeesView v-else-if="page === 'employees'" key="employees" />
        <TimesheetsView v-else key="timesheets" />
      </AdminLayout>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Admin: Settings, Employees, Timesheets (preview)',
  galleryNote: 'The three pages inside AdminLayout with mocked /api/admin responses (fetch is stubbed while this section is mounted). ?page=settings|employees|timesheets picks one.',
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, provide, reactive, ref } from 'vue'
import { routeLocationKey } from 'vue-router'
import AdminLayout from '@/views/admin/AdminLayout.vue'
import SettingsView from '@/views/admin/SettingsView.vue'
import EmployeesView from '@/views/admin/EmployeesView.vue'
import TimesheetsView from '@/views/admin/TimesheetsView.vue'
import { useAuthStore } from '@/stores/auth'
import { addDays, localDate, payPeriodContaining, DEFAULT_PAY_PERIOD, localDateTimeToUtc } from '@/lib/timeclock'

const pages = [
  { key: 'settings', path: '/admin/settings', meta: { title: 'Settings' } },
  { key: 'employees', path: '/admin/employees', meta: { title: 'Employees' } },
  { key: 'timesheets', path: '/admin/timesheets', meta: { title: 'Timesheets' } },
]
const initial = pages.find(p => p.key === new URLSearchParams(location.search).get('page')) ?? pages[0]
const page = ref(initial.key)

const fakeRoute = reactive({ path: initial.path, fullPath: initial.path, meta: initial.meta, params: {}, query: {}, hash: '', matched: [] })
provide(routeLocationKey, fakeRoute)
function show(p) {
  page.value = p.key
  Object.assign(fakeRoute, { path: p.path, fullPath: p.path, meta: p.meta })
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const settings = {
  publicBookingDays: 7, memberBookingDays: 14, firstTeeTime: '07:30', lastTeeTime: '17:00', intervalMinutes: 10,
  payPeriodDays: 14, payPeriodAnchor: DEFAULT_PAY_PERIOD.anchor, salesTaxBps: 925,
  registerPositions: ['PRO_SHOP_ATTENDANT', 'HEAD_GOLF_PROFESSIONAL'], managerPositions: ['GENERAL_MANAGER'],
  lateFeeCents: 1500, tippingEnabled: true, tipPercentages: [15, 18, 20], tipPreTax: true,
  roundMinutes: 255, coursePositions: ['STARTER', 'PLAYER_ASSISTANT'],
  holeSeconds: [], holeTimesRounds: 0, holeTimesUpdatedAt: null,
  rates: { WEEKDAY_9: 2000, WEEKDAY_18: 3000, WEEKEND_9: 3000, WEEKEND_18: 4000, CART: 1200 },
  holidayDates: ['2026-11-26', '2026-12-25'],
}

const employees = [
  { id: 'e1', firstName: 'Gina', lastName: 'Morrow', email: 'gm@example.com', phone: '(256) 555-0101', position: 'GENERAL_MANAGER', hourlyRateCents: 3200, hireDate: '2019-03-04', active: true, userId: 'u1', hasManagerPin: true, managerPinLocked: false },
  { id: 'e2', firstName: 'Pete', lastName: 'Ross', email: 'pro@example.com', phone: null, position: 'HEAD_GOLF_PROFESSIONAL', hourlyRateCents: 2800, hireDate: '2021-05-17', active: true, userId: 'u2', hasManagerPin: true, managerPinLocked: true },
  { id: 'e3', firstName: 'Sasha', lastName: 'Long-Hyphenated-Name', email: 'shop.attendant.with.a.long.address@example.com', phone: '(256) 555-0133', position: 'PRO_SHOP_ATTENDANT', hourlyRateCents: 1350, hireDate: null, active: true, userId: null, hasManagerPin: false, managerPinLocked: false },
  { id: 'e4', firstName: 'Carl', lastName: 'Webb', email: 'crew@example.com', phone: null, position: 'GROUNDS_CREW', hourlyRateCents: null, hireDate: '2024-04-01', active: false, userId: null, hasManagerPin: false, managerPinLocked: false },
]

function timesheet(date) {
  const period = payPeriodContaining(date || localDate(), DEFAULT_PAY_PERIOD)
  const p = { ...period, lengthDays: 14, weekStartDay: 0, prevStart: addDays(period.start, -14), nextStart: addDays(period.end, 1) }
  const entry = (id, day, inT, outT, extra = {}) => ({
    id, date: day, clockIn: localDateTimeToUtc(day, inT).toISOString(), clockOut: outT ? localDateTimeToUtc(day, outT).toISOString() : null,
    breakMinutes: 30, workedMinutes: 480, longOpen: false, editedAt: null, note: null,
    breaks: [{ startedAt: localDateTimeToUtc(day, '12:00').toISOString(), endedAt: localDateTimeToUtc(day, '12:30').toISOString() }],
    ...extra,
  })
  const w2 = addDays(p.start, 7)
  const emps = employees.filter(e => e.active).map((e, i) => ({
    ...e,
    regular: 4800 - i * 600, overtime: i === 0 ? 180 : 0, workedMinutes: 4800 - i * 600 + (i === 0 ? 180 : 0),
    openEntries: i === 1 ? 1 : 0, longOpenEntries: i === 2 ? 1 : 0,
    weeks: [
      { weekStart: p.start, workedMinutes: 2580, overtime: i === 0 ? 180 : 0 },
      { weekStart: w2, workedMinutes: 2220, overtime: 0 },
    ],
    days: [
      { date: p.start, entries: [entry(`${e.id}-1`, p.start, '07:00', '15:30', { editedAt: '2026-10-20T10:00:00Z', note: 'Forgot to clock out, confirmed' })] },
      { date: addDays(p.start, 1), entries: [entry(`${e.id}-2`, addDays(p.start, 1), '08:00', '16:30')] },
      { date: w2, entries: [entry(`${e.id}-3`, w2, '07:30', null, { longOpen: i === 2 })] },
    ],
  }))
  return {
    period: p,
    employees: emps,
    totals: { workedMinutes: 12900, regular: 12720, overtime: 180, openEntries: 1, longOpenEntries: 1 },
  }
}

function mock(url, init = {}) {
  const u = new URL(url, location.origin)
  const method = (init.method || 'GET').toUpperCase()
  if (u.pathname === '/api/admin/settings') return method === 'PUT' ? { warning: 'Saved, but the tip percentages didn\'t reach Stripe (demo).' } : settings
  if (u.pathname === '/api/admin/pace') return { holeSeconds: Array.from({ length: 18 }, (_, i) => 780 + (i % 3) * 120), rounds: 42, updatedAt: new Date().toISOString() }
  if (u.pathname === '/api/admin/employees') {
    const status = u.searchParams.get('status') || 'active'
    const q = (u.searchParams.get('search') || '').toLowerCase()
    return employees.filter(e => (status === 'all' || e.active === (status === 'active'))
      && (!q || `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(q))
      && (!u.searchParams.get('position') || e.position === u.searchParams.get('position')))
  }
  if (u.pathname.startsWith('/api/admin/employees/')) {
    if (method === 'DELETE') return { status: 409, body: { error: "This employee has time clock history and can't be deleted. Deactivate them instead." } }
    const emp = employees.find(e => e.id === u.pathname.split('/').pop())
    const body = JSON.parse(init.body || '{}')
    if (emp && 'active' in body) emp.active = body.active
    return emp
  }
  if (u.pathname === '/api/admin/timesheets') return timesheet(u.searchParams.get('date'))
  if (u.pathname.startsWith('/api/admin/time-entries')) return { success: true }
  if (u.pathname === '/api/admin/time-off/count') return { pending: 2 }
  return null
}

const realFetch = window.fetch
window.fetch = async (url, init) => {
  const result = typeof url === 'string' && url.startsWith('/api/') ? mock(url, init) : null
  if (!result) return realFetch(url, init)
  await new Promise(r => setTimeout(r, 300))
  const { status = 200, body = result } = result.status ? result : {}
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

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
