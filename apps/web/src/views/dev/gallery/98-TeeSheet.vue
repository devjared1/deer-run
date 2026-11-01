<template>
  <div class="space-y-3">
    <p class="text-body-m text-on-surface-variant">
      Fake tee sheet built around the current time: checked-in groups on the course (one behind, one ahead), a
      finished group, online, phone and walk-in bookings, an unfinished online payment, an expired hold, a cancelled
      booking and open tee times. Actions answer in the browser; the register handoff is stubbed (no navigation).
    </p>
    <div
      class="relative overflow-hidden rounded-shape-md border border-outline-variant"
      :style="{ transform: 'translateZ(0)', height: boxHeight }"
    >
      <StaffLayout v-model:preview-path="page" contained :clock="clockData">
        <TeeSheetView />
      </StaffLayout>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Staff Tee Sheet (preview)',
  galleryNote: 'TeeSheetView inside StaffLayout with a mocked /api/staff/teesheet (fetch is stubbed while this section is mounted).',
}
</script>

<script setup>
import { onBeforeUnmount, provide, reactive, ref } from 'vue'
import { routeLocationKey, routerKey, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import StaffLayout from '@/views/staff/StaffLayout.vue'
import TeeSheetView from '@/views/staff/TeeSheetView.vue'
import { localDate, localTime } from '@/lib/timeclock'

const page = ref('/staff/teesheet')
// ?h=2400 makes the preview box taller (full-page screenshots)
const boxHeight = `${Number(new URLSearchParams(location.search).get('h')) || 760}px`
const realRouter = useRouter()

// The view reads ?date= from the route and router.replace()s it; keep both inside the preview
const fakeRoute = reactive({ path: '/staff/teesheet', fullPath: '/staff/teesheet', meta: { title: 'Tee Sheet' }, params: {}, query: {}, hash: '', matched: [] })
const fakeRouter = {
  ...realRouter,
  replace: (to) => { fakeRoute.query = { ...(to?.query ?? {}) }; return Promise.resolve() },
  push: (to) => { console.info('[preview] navigate to', to); return Promise.resolve() },
}
provide(routeLocationKey, fakeRoute)
provide(routerKey, fakeRouter)

// Dev-only: a fake register employee
const auth = useAuthStore()
const savedProfile = auth.profile
auth.profile = {
  id: 'preview', email: 'shop@example.com', role: 'GUEST', canUseRegister: true, canTrackCourse: true, isRegisterManager: false,
  employee: { id: 'preview-employee', firstName: 'Casey', lastName: 'Reed', position: 'PRO_SHOP_ATTENDANT', active: true },
}

const nowMs = Date.now()
const isoAgo = min => new Date(nowMs - min * 60000).toISOString()
const clockData = { status: 'on', openEntry: { clockIn: isoAgo(200), clockOut: null, breaks: [] }, serverTime: new Date(nowMs).toISOString() }

// ── Fake tee sheet ──
const today = localDate()
const [nh, nm] = localTime(new Date(nowMs).toISOString()).split(':').map(Number)
// Slots every 10 minutes from 2.5 h before now to 2 h after (kept inside the day)
const nowMin = Math.min(Math.max(nh * 60 + nm, 160), 24 * 60 - 130)
const firstMin = Math.floor((nowMin - 150) / 10) * 10
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

let n = 0
function booking(over) {
  n += 1
  return {
    id: `b${n}`, players: 4, status: 'CONFIRMED', source: 'ONLINE', guestName: null, guestEmail: null,
    checkedInAt: null, createdAt: isoAgo(3000 - n), totalCents: 18000, cartNumbers: [], ownCart: false, startHole: 1,
    roundHoles: 18, cartIncluded: true, teedOffAt: null, positionHole: null, positionStage: null, positionAt: null,
    finishedAt: null, holdsSpot: true, holdExpired: false, name: 'Guest', email: null, customer: null, receipts: [],
    ...over,
  }
}
const member = (id, name) => ({ id, name, email: `${id}@example.com`, role: 'MEMBER', membershipTier: 'Full', isMember: true })

// Bookings by minutes from the first slot
const PLAN = {
  0: [booking({ name: 'Hank Whitfield', players: 4, checkedInAt: isoAgo(160), cartNumbers: ['3', '4'], teedOffAt: isoAgo(150), finishedAt: isoAgo(5), customer: member('u1', 'Hank Whitfield'), receipts: [{ id: 's1', number: 1041 }] })],
  20: [booking({ name: 'Lisa Moreno', players: 3, source: 'PHONE', totalCents: 13500, checkedInAt: isoAgo(140), cartNumbers: ['7', '8'], teedOffAt: isoAgo(125), positionHole: 6, positionStage: 'GREEN', positionAt: isoAgo(25), receipts: [{ id: 's2', number: 1043 }] })],
  40: [
    booking({ name: 'Smith party', players: 2, source: 'POS', totalCents: 9000, checkedInAt: isoAgo(115), cartNumbers: ['12'], ownCart: true, teedOffAt: isoAgo(108), receipts: [{ id: 's3', number: 1046 }] }),
    booking({ name: 'Dale Hutchins', players: 2, cartIncluded: false, checkedInAt: isoAgo(112), startHole: 10, roundHoles: 9, teedOffAt: isoAgo(100), positionHole: 15, positionStage: 'TEE', positionAt: isoAgo(10), customer: member('u2', 'Dale Hutchins') }),
  ],
  70: [booking({ name: 'Priya Natarajan', players: 1, totalCents: 4500, status: 'CANCELLED', holdsSpot: false })],
  100: [booking({ name: 'Bobby Tran', players: 2, totalCents: 9000, status: 'PENDING', holdsSpot: false, holdExpired: true, cartIncluded: false })],
  150: [
    booking({ name: 'Wes Calloway', players: 4, customer: member('u3', 'Wes Calloway') }),
  ],
  160: [booking({ name: 'Morgan & Riley Fox', players: 2, roundHoles: 9, cartIncluded: false, totalCents: 6000 })],
  180: [booking({ name: 'Jenna Park', players: 3, status: 'PENDING', totalCents: 13500 })],
  200: [booking({ name: 'Phone: Carter group', players: 4, source: 'PHONE', totalCents: 18000, receipts: [{ id: 's4', number: 1052 }] })],
}

function slotsFor(date) {
  const slots = []
  for (let m = firstMin, i = 0; m <= firstMin + 270; m += 10, i += 1) {
    const offset = m - firstMin
    const bookings = date === today ? (PLAN[offset] ?? []) : (i % 5 === 1 ? [booking({ id: `${date}-${i}`, name: 'Taylor Brooks', players: 2 })] : [])
    slots.push({ id: `${date}-slot-${i}`, date, startTime: hhmm(m), maxPlayers: 4, memberOnly: offset === 230, bookings })
  }
  return slots
}
const sheets = {}
function sheetFor(date) {
  if (!sheets[date]) sheets[date] = slotsFor(date)
  const slots = sheets[date].map(s => {
    const booked = s.bookings.filter(b => b.holdsSpot).reduce((sum, b) => sum + b.players, 0)
    return { ...s, bookedPlayers: booked, available: Math.max(0, s.maxPlayers - booked) }
  })
  return { date, today, roundMinutes: 255, holeSeconds: [], slots }
}
function findBooking(id) {
  for (const slots of Object.values(sheets)) {
    for (const s of slots) {
      const b = s.bookings.find(x => x.id === id)
      if (b) return { b, s, slots }
    }
  }
  return null
}

function mock(url, init = {}) {
  const u = new URL(url, location.origin)
  const method = (init.method || 'GET').toUpperCase()
  const body = init.body ? JSON.parse(init.body) : {}
  if (u.pathname === '/api/staff/teesheet') return sheetFor(u.searchParams.get('date') || today)
  const m = u.pathname.match(/^\/api\/staff\/(teesheet|oncourse)\/([^/]+)$/)
  if (m && method === 'POST') {
    const found = findBooking(m[2])
    if (!found) return { status: 404, body: { error: 'Booking not found' } }
    const { b } = found
    const setup = () => Object.assign(b, {
      cartNumbers: body.cartNumbers ?? b.cartNumbers, ownCart: body.ownCart ?? b.ownCart,
      startHole: body.startHole ?? b.startHole, roundHoles: body.roundHoles ?? b.roundHoles,
    })
    if (body.action === 'check_in') { setup(); b.checkedInAt = new Date().toISOString() }
    else if (body.action === 'setup') setup()
    else if (body.action === 'undo_check_in') Object.assign(b, { checkedInAt: null, teedOffAt: null, positionHole: null, positionStage: null, positionAt: null, finishedAt: null })
    else if (body.action === 'cancel') Object.assign(b, { status: 'CANCELLED', holdsSpot: false })
    else if (body.action === 'move') {
      const target = Object.values(sheets).flat().find(s => s.id === body.teeTimeSlotId)
      found.s.bookings = found.s.bookings.filter(x => x.id !== b.id)
      target.bookings.push(b)
      return { ...b, emailError: b.source === 'ONLINE' ? 'Resend is not configured (preview)' : null }
    }
    return { ...b }
  }
  if (u.pathname.startsWith('/api/')) return { status: 404, body: { error: `Not mocked: ${u.pathname}` } }
  return null
}

const realFetch = window.fetch
window.fetch = async (url, init) => {
  const result = typeof url === 'string' && url.startsWith('/api/') ? mock(url, init) : null
  if (!result) return realFetch(url, init)
  await new Promise(r => setTimeout(r, 250))
  // { status: <number>, body } is an error reply; anything else is the body (bookings have a string `status`)
  const { status = 200, body = result } = typeof result.status === 'number' ? result : {}
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

onBeforeUnmount(() => {
  window.fetch = realFetch
  auth.profile = savedProfile
})
</script>
