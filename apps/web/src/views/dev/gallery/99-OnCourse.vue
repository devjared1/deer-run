<template>
  <div class="space-y-3">
    <p class="text-body-m text-on-surface-variant">
      Ten groups relative to now: finished, probably done, reported (fresh and stale), estimated from the tee-off or the
      tee time, ahead and behind, a 9-hole round from 10, and two waiting on the first tee. Updates are kept in memory.
      <code>&amp;tall=1</code> makes the box tall enough for a full-page screenshot.
    </p>
    <div
      :class="['relative overflow-hidden rounded-shape-md border border-outline-variant', tall ? 'h-[4800px]' : 'h-[860px]']"
      style="transform: translateZ(0)"
    >
      <StaffLayout
        v-if="ready"
        preview-path="/staff/oncourse"
        contained
        :clock="clockData"
      >
        <OnCourseView />
      </StaffLayout>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'On Course (preview)',
  galleryNote: 'OnCourseView inside StaffLayout with a fake course-staff profile; GET/POST /api/staff/oncourse are answered in the browser (dev only).',
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import StaffLayout from '@/views/staff/StaffLayout.vue'
import OnCourseView from '@/views/staff/OnCourseView.vue'
import { COURSE_TZ } from '@/lib/timeclock'
import { DEFAULT_ROUND_MINUTES, planOffset, positionAtOffset, roundPlan } from '@/lib/pace'

const tall = new URLSearchParams(location.search).get('tall') === '1'
const MIN = 60_000
const nowMs = Date.now()
const iso = ms => new Date(ms).toISOString()

// Course-local date and "HH:MM" of a moment (slots near midnight still get the right date)
function local(ms) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: COURSE_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map(p => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

// Tee times every 10 minutes from 5 h ago to 2 h ahead, on the 10-minute mark
const first = Math.floor((nowMs - 300 * MIN) / (10 * MIN)) * 10 * MIN
const slots = Array.from({ length: 43 }, (_, i) => {
  const ms = first + i * 10 * MIN
  const { date, time } = local(ms)
  return { id: `slot${i}`, ms, date, startTime: time, maxPlayers: 4, memberOnly: false, bookings: [] }
})
const slotNear = minutesFromNow => slots.reduce((best, s) => (Math.abs(s.ms - (nowMs + minutesFromNow * MIN)) < Math.abs(best.ms - (nowMs + minutesFromNow * MIN)) ? s : best))

let n = 0
function book(slot, name, players, extra = {}) {
  const b = {
    id: `bk${++n}`, status: 'CONFIRMED', source: 'ONLINE', name, players, totalCents: players * 4500,
    checkedInAt: iso(slot.ms - 20 * MIN), createdAt: iso(slot.ms - 3 * 86400_000), holdsSpot: true, holdExpired: false,
    cartNumbers: [], ownCart: false, startHole: 1, roundHoles: 18,
    teedOffAt: null, positionHole: null, positionStage: null, positionAt: null, finishedAt: null,
    customer: null, receipts: [], ...extra,
  }
  slot.bookings.push(b)
  return b
}

// A reported position this many minutes ago that leaves the group `delta` minutes behind (+) or ahead (−)
function reported(slot, b, { agoMinutes, delta }) {
  const plan = roundPlan(b, DEFAULT_ROUND_MINUTES)
  const at = nowMs - agoMinutes * MIN
  const pos = positionAtOffset(plan, (at - slot.ms) / MIN - delta)
  const offset = planOffset(plan, pos.hole, pos.stage)
  Object.assign(b, {
    teedOffAt: iso(slot.ms + Math.max(0, delta) * MIN * 0.3),
    positionHole: pos.hole, positionStage: pos.stage, positionAt: iso(slot.ms + (offset + delta) * MIN),
  })
}

const s1 = slotNear(-275); book(s1, 'Henderson party', 4, { cartNumbers: ['3', '4'], teedOffAt: iso(s1.ms + 4 * MIN), finishedAt: iso(nowMs - 12 * MIN) })
const s2 = slotNear(-262); book(s2, 'Walt Briggs', 2, { cartNumbers: ['7'] })
const s3 = slotNear(-205); reported(s3, book(s3, 'Tuesday Men\'s League', 4, { cartNumbers: ['11', '12'] }), { agoMinutes: 6, delta: 24 })
const s4 = slotNear(-175); reported(s4, book(s4, 'Carla Ruiz', 3, { cartNumbers: ['15', '16'] }), { agoMinutes: 12, delta: 12 })
const s5 = slotNear(-140); book(s5, 'Okafor foursome', 4, { cartNumbers: ['18', '19'], teedOffAt: iso(s5.ms + 6 * MIN) })
const s6 = slotNear(-110); reported(s6, book(s6, 'Dean & Pat Moss', 2, { cartNumbers: ['21'] }), { agoMinutes: 70, delta: -11 })
const s7 = slotNear(-80); reported(s7, book(s7, 'Lindqvist', 1, { ownCart: true }), { agoMinutes: 3, delta: -12 })
const s8 = slotNear(-60); reported(s8, book(s8, 'Bobby Tran', 4, { cartNumbers: ['24', '25'] }), { agoMinutes: 2, delta: 20 })
const s9 = slotNear(-40); book(s9, 'Juniors clinic', 3, { ownCart: true, startHole: 10, roundHoles: 9, teedOffAt: iso(s9.ms) })
const s10 = slotNear(-15); book(s10, 'Graham Pell', 2, { cartNumbers: ['27'] })
const s11 = slotNear(10); book(s11, 'Sanders party', 4, { cartNumbers: ['28', '29'] })
// Booked, not checked in yet (not on this page), so the next open slot is a little later
book(slotNear(20), 'Martinez', 4, { checkedInAt: null })
book(slotNear(30), 'Kim', 2, { checkedInAt: null })

function payload() {
  return {
    date: local(nowMs).date, today: local(nowMs).date, roundMinutes: DEFAULT_ROUND_MINUTES, holeSeconds: [],
    slots: slots.map(({ ms, ...s }) => {
      const bookedPlayers = s.bookings.reduce((sum, b) => sum + b.players, 0)
      return { ...s, bookings: s.bookings.map(b => ({ ...b })), bookedPlayers, available: Math.max(0, s.maxPlayers - bookedPlayers) }
    }),
  }
}

function postAction(id, body) {
  const slot = slots.find(s => s.bookings.some(b => b.id === id))
  const b = slot?.bookings.find(x => x.id === id)
  if (!b) return [404, { error: 'Booking not found' }]
  const t = new Date().toISOString()
  switch (body.action) {
    case 'tee_off': b.teedOffAt = b.teedOffAt ?? t; break
    case 'undo_tee_off': Object.assign(b, { teedOffAt: null, positionHole: null, positionStage: null, positionAt: null }); break
    case 'position':
      if (body.hole === 13) return [409, { error: 'Hole 13 is closed for maintenance (demo error)' }]
      Object.assign(b, { positionHole: body.hole, positionStage: body.stage, positionAt: t })
      break
    case 'finish': b.finishedAt = t; break
    case 'undo_finish': b.finishedAt = null; break
    case 'setup': Object.assign(b, { cartNumbers: body.cartNumbers, ownCart: body.ownCart, startHole: body.startHole, roundHoles: body.roundHoles }); break
    default: return [400, { error: 'Unknown action' }]
  }
  const { ms: _ms, bookings: _bookings, ...slotInfo } = slot
  return [200, { ...b, slot: slotInfo }]
}

const clockData = { status: 'on', openEntry: { clockIn: iso(nowMs - 200 * MIN), clockOut: null, breaks: [] }, serverTime: iso(nowMs) }

// Answer /api/staff/oncourse* in the browser; everything else goes to the real fetch
const realFetch = window.fetch
const ready = ref(false)
const auth = useAuthStore()
let savedProfile = null
onMounted(() => {
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
    if (!url.pathname.startsWith('/api/staff/oncourse')) return realFetch(input, init)
    await new Promise(r => setTimeout(r, 300))
    const method = (init.method || 'GET').toUpperCase()
    const [status, body] = method === 'GET'
      ? [200, payload()]
      : postAction(url.pathname.split('/').pop(), JSON.parse(init.body || '{}'))
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }
  savedProfile = auth.profile
  auth.profile = {
    id: 'preview', email: 'marshal@example.com', role: 'GUEST', canUseRegister: false, canTrackCourse: true, isRegisterManager: false,
    employee: { id: 'preview-employee', firstName: 'Jordan', lastName: 'Smith', position: 'PLAYER_ASSISTANT', active: true },
  }
  ready.value = true
})
onBeforeUnmount(() => {
  window.fetch = realFetch
  auth.profile = savedProfile
})
</script>
