<template>
  <div class="relative rounded-shape-md border border-outline-variant" style="transform: translateZ(0)">
    <AdminLayout>
      <DashboardView />
    </AdminLayout>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Admin dashboard (preview)',
  galleryNote: 'DashboardView inside AdminLayout with mocked /api/admin responses: Needs attention (every kind of item), stat cards, register sales, the tee time usage heatmap, on the clock, tournaments and recent bookings.',
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, provide, reactive } from 'vue'
import { routeLocationKey } from 'vue-router'
import AdminLayout from '@/views/admin/AdminLayout.vue'
import DashboardView from '@/views/admin/DashboardView.vue'
import { useAuthStore } from '@/stores/auth'
import { addDays, localDate } from '@/lib/timeclock'

provide(routeLocationKey, reactive({ path: '/admin', fullPath: '/admin', meta: { title: 'Dashboard' }, params: {}, query: {}, hash: '', matched: [] }))

const today = localDate()
const iso = minutesAgo => new Date(Date.now() - minutesAgo * 60000).toISOString()

const series = Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, i - 6), bookings: 14 + i * 2, players: 44 + i * 6, revenueCents: 52000 + i * 4100 }))
const dashboard = {
  today: { date: today, bookings: 26, players: 82 }, lastWeek: { date: addDays(today, -7), bookings: 22, players: 70 },
  week: { revenueCents: 412000, confirmedBookings: 118, previousRevenueCents: 365000, previousConfirmedBookings: 104 },
  series, totalUsers: 1240, pendingBookings: 3,
  upcomingEvents: [{ id: 't1', name: 'Fall Scramble', eventDate: `${addDays(today, 12)}T00:00:00`, featured: true }],
  recentBookings: [{ id: 'b1', players: 4, totalCents: 16000, status: 'CONFIRMED', guestName: 'Pat Lowe', createdAt: iso(20), TeeTimeSlot: { date: addDays(today, 1), startTime: '08:10' }, User: null }],
}

const attention = {
  items: [
    { key: 'cardNotSaved', count: 1, checkouts: [{ id: 'c1', amountCents: 5499, registerName: 'Pro Shop', lastError: 'Network timeout', createdAt: iso(25) }] },
    { key: 'missedClockOut', count: 1, names: ['Tom Rigsby'] },
    { key: 'missedClockIn', count: 2, people: [{ name: 'Kayla Ortiz', startTime: '07:00' }, { name: 'Lena Hart', startTime: '11:00' }] },
    { key: 'drawersLeftOpen', count: 1, registers: ['Grill'] },
    { key: 'teeTimeGaps', count: 3, dates: [addDays(today, 12), addDays(today, 13), addDays(today, 14)] },
    { key: 'shiftSwaps', count: 1 },
    { key: 'timeOff', count: 2, firstStart: addDays(today, 5) },
    { key: 'statementsPastDue', count: 3, totalCents: 128450 },
    { key: 'outOfStock', count: 4, names: ['Pro V1 (dozen)', 'Rope Cap', 'Deer Run Polo', 'Leather Glove'] },
  ],
  errors: [],
}

// Weekday × hour shares: mornings and weekends busier
const usage = (() => {
  const cells = []
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 7; hour <= 16; hour++) {
      const weekend = weekday === 0 || weekday === 6
      const morning = Math.max(0, 1 - (hour - 7) / 10)
      const share = Math.min(1, Math.round(((weekend ? 0.55 : 0.2) + morning * 0.45 + (hour === 16 ? 0.1 : 0)) * 100) / 100)
      cells.push({ weekday, hour, capacity: 192, booked: Math.round(share * 192), share })
    }
  }
  return { from: addDays(today, -56), to: addDays(today, -1), weeks: 8, overall: { capacity: 13440, booked: 6100, share: 0.454 }, cells }
})()

const sales = {
  net: { salesCents: 184500, taxCents: 12400, totalCents: 196900 }, sales: { count: 42 }, returns: { voidCount: 1, refundCount: 2 },
  categories: [{ name: 'Green Fees', netCents: 98000 }, { name: 'Golf Balls', netCents: 32000 }, { name: 'Grill', netCents: 27500 }, { name: 'Apparel', netCents: 27000 }],
}

function mock(path, url) {
  if (path === '/api/admin/dashboard') return dashboard
  if (path === '/api/admin/attention') return attention
  if (path === '/api/admin/reports/teetime-usage') {
    const weeks = Number(url.searchParams.get('weeks') || 8)
    return { ...usage, weeks, from: addDays(today, -weeks * 7) }
  }
  if (path === '/api/admin/timeclock') return [{ id: 'te1', clockIn: iso(190), date: today, status: 'on', longOpen: false, employee: { firstName: 'Dana', lastName: 'Whitfield', position: 'GENERAL_MANAGER' } }]
  if (path === '/api/admin/sales/report') return sales
  if (path === '/api/admin/time-off/count') return { pending: 2 }
  return null
}

const realFetch = window.fetch
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
  const result = url.pathname.startsWith('/api/admin/') ? mock(url.pathname, url) : null
  if (!result) return realFetch(input, init)
  await new Promise(r => setTimeout(r, 250))
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
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
