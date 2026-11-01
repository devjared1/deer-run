<template>
  <div class="space-y-3">
    <p class="text-body-m text-on-surface-variant">
      The standalone time clock (/timeclock) as it looks on the iPad. Every PIN is <strong>1234</strong>; Jordan has no
      PIN yet and Ray's is locked. Punches answer in the browser. The box is iPad landscape size (1180 × 820).
    </p>
    <div class="flex gap-2">
      <AppButton v-for="s in SIZES" :key="s.label" size="md" :variant="size === s ? 'tonal' : 'outlined'" @click="size = s">
        {{ s.label }}
      </AppButton>
    </div>
    <div class="overflow-auto rounded-shape-md border border-outline-variant">
      <div class="relative overflow-hidden" :style="{ transform: 'translateZ(0)', width: `${size.w}px`, height: `${size.h}px` }">
        <TimeClockKioskView />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Time Clock kiosk (preview)',
  galleryNote: 'TimeClockKioskView with a mocked /api/kiosk/* (fetch is stubbed and a preview kiosk token is set while this section is mounted).',
}
</script>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import TimeClockKioskView from '@/views/kiosk/TimeClockKioskView.vue'
import { getKioskToken, setKioskToken } from '@/lib/kioskApi'
import { workedMinutes } from '@/lib/timeclock'

const SIZES = [{ label: 'iPad landscape', w: 1180, h: 820 }, { label: 'iPad portrait', w: 820, h: 1180 }, { label: 'iPad mini', w: 744, h: 1133 }]
const size = ref(SIZES[0])

// The view needs a kiosk token to skip the set-up screen; the real one (if any) comes back afterwards
const savedToken = getKioskToken()
setKioskToken('dk_preview')

const ago = min => new Date(Date.now() - min * 60000).toISOString()
const PEOPLE = [
  ['Ana', 'Alvarez', 'PRO_SHOP_ATTENDANT'], ['Ben', 'Carter', 'GROUNDS_CREW'], ['Casey', 'Reed', 'STARTER'],
  ['Dale', 'Hutchins', 'COOK'], ['Erin', 'Fox', 'SERVER'], ['Gina', 'Morrow', 'GENERAL_MANAGER'],
  ['Jordan', 'Lee', 'BEVERAGE_CART_ATTENDANT'], ['Luis', 'Ortiz', 'EQUIPMENT_TECHNICIAN'], ['Mia', 'Park', 'OUTSIDE_SERVICES'],
  ['Pete', 'Ross', 'HEAD_GOLF_PROFESSIONAL'], ['Ray', 'Nguyen', 'GROUNDS_CREW'], ['Sasha', 'Long-Hyphenated-Name', 'PLAYER_ASSISTANT'],
]
// Per employee: { entries: [{ id, clockIn, clockOut, breaks }] } (today)
const clock = Object.fromEntries(PEOPLE.map((_, i) => [`e${i}`, { entries: [] }]))
clock.e0.entries.push({ id: 't0', clockIn: ago(190), clockOut: null, breaks: [] })
clock.e1.entries.push({ id: 't1', clockIn: ago(300), clockOut: null, breaks: [{ id: 'b1', startedAt: ago(12), endedAt: null }] })
clock.e5.entries.push({ id: 't5', clockIn: ago(420), clockOut: ago(240), breaks: [] })
const employees = PEOPLE.map(([firstName, lastName, position], i) => ({
  id: `e${i}`, firstName, lastName, position, hasPin: firstName !== 'Jordan', pinLocked: firstName === 'Ray',
}))

function stateOf(id) {
  const e = employees.find(x => x.id === id)
  const now = new Date()
  const entries = clock[id].entries.map(x => ({ ...x, workedMinutes: workedMinutes(x, now) }))
  const open = entries.find(x => !x.clockOut) ?? null
  return {
    status: !open ? 'off' : open.breaks.some(b => !b.endedAt) ? 'break' : 'on',
    openEntry: open,
    today: { date: now.toISOString().slice(0, 10), entries, workedMinutes: entries.reduce((s, x) => s + x.workedMinutes, 0) },
    serverTime: now.toISOString(),
    employee: { id, firstName: e.firstName, lastName: e.lastName, position: e.position },
  }
}

function punch(id, action) {
  const now = new Date().toISOString()
  const list = clock[id].entries
  const open = list.find(x => !x.clockOut)
  const openBreak = open?.breaks.find(b => !b.endedAt)
  if (action === 'clock_in') list.push({ id: `t${Date.now()}`, clockIn: now, clockOut: null, breaks: [] })
  if (action === 'break_start') open.breaks.push({ id: `b${Date.now()}`, startedAt: now, endedAt: null })
  if (action === 'break_end') openBreak.endedAt = now
  if (action === 'clock_out') { if (openBreak) openBreak.endedAt = now; open.clockOut = now }
}

function mock(url, init) {
  const u = new URL(url, location.origin)
  if (u.pathname === '/api/kiosk/employees') {
    return {
      kiosk: { id: 'k1', name: 'Pro shop iPad (preview)' },
      serverTime: new Date().toISOString(),
      employees: employees.map(e => ({ ...e, status: stateOf(e.id).status })),
    }
  }
  if (u.pathname === '/api/kiosk/clock') {
    const body = JSON.parse(init?.body ?? '{}')
    const e = employees.find(x => x.id === body.employeeId)
    if (!e) return { status: 404, body: { error: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' } }
    if (e.pinLocked) return { status: 423, body: { error: `${e.firstName}'s PIN is locked`, code: 'PIN_LOCKED' } }
    if (!e.hasPin) return { status: 400, body: { error: 'No PIN', code: 'PIN_NOT_SET' } }
    if (body.pin !== '1234') return { status: 403, body: { error: 'Wrong PIN (4 tries left)', code: 'PIN_WRONG' } }
    if (body.action) punch(e.id, body.action)
    return { ...stateOf(e.id), ...(body.action ? { done: body.action } : {}) }
  }
  if (u.pathname.startsWith('/api/')) return { status: 404, body: { error: `Not mocked: ${u.pathname}` } }
  return null
}

const realFetch = window.fetch
window.fetch = async (url, init) => {
  const result = typeof url === 'string' && url.startsWith('/api/kiosk/') ? mock(url, init) : null
  if (!result) return realFetch(url, init)
  await new Promise(r => setTimeout(r, 250))
  // { status: <number>, body } is an error reply; anything else is the body (clock states have a string `status`)
  const { status = 200, body = result } = typeof result.status === 'number' ? result : {}
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

onBeforeUnmount(() => {
  window.fetch = realFetch
  setKioskToken(savedToken)
})
</script>
