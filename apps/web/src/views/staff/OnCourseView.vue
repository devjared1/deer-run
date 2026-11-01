<template>
  <div class="max-w-6xl space-y-4 font-body">
    <div v-if="loading && !sheet" class="text-gray-400 text-sm">
      Loading…
    </div>
    <div v-else-if="error" class="text-red-500 text-sm">
      {{ error }}
    </div>

    <template v-else-if="sheet">
      <!-- Summary -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="card">
          <div class="card-label">
            Course pace
          </div>
          <div :class="['card-value', paceText(pace.pace)]">
            {{ pace.deltaMinutes == null ? 'No recent reports' : paceLabel(pace.deltaMinutes) }}
          </div>
          <div class="card-note">
            {{ pace.deltaMinutes == null
              ? 'Update a group\'s position to see how the course is running'
              : `From ${pace.reportedGroups} group${pace.reportedGroups === 1 ? '' : 's'} reported in the last hour` }}
          </div>
        </div>
        <div class="card">
          <div class="card-label">
            First tee
          </div>
          <div :class="['card-value', pace.firstTeeLateMinutes > PACE_TOLERANCE_MINUTES ? 'text-clay' : 'text-bark']">
            {{ firstTeeText }}
          </div>
          <div class="card-note">
            Tee-offs the starter recorded in the last 90 minutes
          </div>
        </div>
        <div class="card">
          <div class="card-label">
            On the course
          </div>
          <div class="card-value text-bark">
            {{ onCourse.length }} group{{ onCourse.length === 1 ? '' : 's' }} · {{ golfersOut }} golfers
          </div>
          <div class="card-note">
            {{ cartsOut.size }} cart{{ cartsOut.size === 1 ? '' : 's' }} out<span v-if="lastFinish"> · last group in around {{ clock(lastFinish) }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-label">
            Next open tee time
          </div>
          <template v-if="nextOpen">
            <div class="card-value text-bark">
              {{ teeTime(nextOpen.slot.startTime) }} · {{ nextOpen.slot.available }} open
            </div>
            <div class="card-note">
              <template v-if="nextOpen.lateBy > 0">
                Likely goes off around {{ clock(nextOpen.goesOff) }};
              </template>
              done around {{ clock(nextOpen.finishes) }} (18 holes)
            </div>
          </template>
          <div v-else class="card-value text-gray-400">
            None left today
          </div>
        </div>
      </div>

      <p v-if="actionError" class="text-red-500 text-sm">
        {{ actionError }}
      </p>

      <!-- Course map -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display font-bold text-bark">
            Where groups are
          </h2>
          <div class="text-xs text-gray-400">
            Solid: reported in the last {{ FRESH_MINUTES }} min · dashed: estimated
            <span v-if="refreshedAt"> · updated {{ refreshedAt }}</span>
          </div>
        </div>
        <div v-for="nine in NINES" :key="nine.label" class="mb-2 last:mb-0">
          <div class="text-xs text-gray-400 mb-1">
            {{ nine.label }}
          </div>
          <div class="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
            <div
              v-for="h in nine.holes"
              :key="h.hole"
              :class="['rounded-lg border p-1.5 min-h-[4.5rem]', groupsOnHole(h.hole).length ? 'border-pine/30 bg-pine/5' : 'border-gray-100 bg-gray-50']"
            >
              <div class="flex items-baseline justify-between text-xs">
                <span class="font-bold text-bark">{{ h.hole }}</span>
                <span class="text-gray-400">Par {{ h.par }}</span>
              </div>
              <div class="flex flex-wrap gap-1 mt-1">
                <button
                  v-for="g in groupsOnHole(h.hole)"
                  :key="g.booking.id"
                  type="button"
                  :title="`${g.booking.name} · ${stageLabel(g.track.stage)} · ${paceLabel(g.track.deltaMinutes)}`"
                  :class="['chip', chipClass(g), isFresh(g.track) ? '' : 'border-dashed']"
                  @click="openPosition(g)"
                >
                  {{ chipLabel(g.booking) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Starter: checked in, not off yet -->
      <div class="bg-white rounded-xl border border-gray-200">
        <h2 class="font-display font-bold text-bark px-4 pt-4 pb-2">
          Up next on the tee
        </h2>
        <div v-if="!starter.length" class="px-4 pb-4 text-sm text-gray-400">
          No checked-in groups are waiting. Groups show here once they check in on the tee sheet.
        </div>
        <div v-for="g in starter" :key="g.booking.id" class="row">
          <div class="w-20 flex-shrink-0 font-display font-bold text-bark">
            {{ teeTime(g.slot.startTime) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-bark text-sm">
              {{ g.booking.name }} <span class="font-normal text-gray-500">· {{ playersText(g.booking) }}</span>
            </div>
            <div class="text-xs text-gray-500">
              {{ roundText(g.booking) }}
            </div>
          </div>
          <div :class="['text-sm w-36', dueClass(g)]">
            {{ dueText(g) }}
          </div>
          <div class="flex gap-2">
            <button class="btn-pine-sm" :disabled="busy === g.booking.id" @click="act(g, 'tee_off')">
              Teed off
            </button>
            <button class="btn-outline-xs" @click="openSetup(g)">
              Carts
            </button>
          </div>
        </div>
      </div>

      <!-- On the course -->
      <div class="bg-white rounded-xl border border-gray-200">
        <h2 class="font-display font-bold text-bark px-4 pt-4 pb-2">
          On the course
        </h2>
        <div v-if="!onCourse.length" class="px-4 pb-4 text-sm text-gray-400">
          Nobody's out on the course right now.
        </div>
        <div v-for="g in onCourse" :key="g.booking.id" class="row">
          <div class="w-20 flex-shrink-0">
            <div class="font-display font-bold text-bark">
              {{ teeTime(g.slot.startTime) }}
            </div>
            <div v-if="g.track.teedOffAt" class="text-xs text-gray-400">
              off {{ clock(g.track.teedOffAt) }}
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-bark text-sm">
              {{ g.booking.name }} <span class="font-normal text-gray-500">· {{ playersText(g.booking) }}</span>
            </div>
            <div class="text-xs text-gray-500">
              {{ roundText(g.booking) }}
            </div>
          </div>
          <div class="w-52 text-sm">
            <div class="text-bark">
              Hole {{ g.track.hole }} · {{ stageLabel(g.track.stage) }}
            </div>
            <div class="text-xs text-gray-400">
              {{ basisText(g.track) }}
            </div>
          </div>
          <div class="w-40 text-sm">
            <span :class="['badge', badgeClass(g.track.pace)]">{{ paceLabel(g.track.deltaMinutes) }}</span>
            <div v-if="g.track.expectedHole && g.track.expectedHole !== g.track.hole" class="text-xs text-gray-400 mt-0.5">
              Should be on {{ g.track.expectedHole }}
            </div>
            <div v-if="g.gap" :class="['text-xs mt-0.5', g.track.pace === 'BEHIND' ? 'text-clay font-semibold' : 'text-gray-400']">
              {{ g.gap }} open hole{{ g.gap === 1 ? '' : 's' }} ahead
            </div>
          </div>
          <div class="w-24 text-xs text-gray-500">
            Done ~{{ clock(g.track.estimatedFinish) }}
          </div>
          <div class="flex flex-wrap gap-2 justify-end">
            <button class="btn-pine-sm" @click="openPosition(g)">
              Update
            </button>
            <button
              v-if="!g.track.teedOffAt"
              class="btn-outline-xs"
              :disabled="busy === g.booking.id"
              title="Record that the group just teed off"
              @click="act(g, 'tee_off')"
            >
              Teed off
            </button>
            <button class="btn-outline-xs" :disabled="busy === g.booking.id" @click="act(g, 'finish')">
              Finished
            </button>
            <button class="btn-outline-xs" @click="openSetup(g)">
              Carts
            </button>
            <button
              v-if="g.track.teedOffAt"
              class="btn-outline-xs text-gray-400"
              :disabled="busy === g.booking.id"
              title="Clear the tee-off time and reported position"
              @click="act(g, 'undo_tee_off')"
            >
              Undo tee-off
            </button>
          </div>
        </div>
      </div>

      <!-- Finished (or probably finished) -->
      <div v-if="finished.length" class="bg-white rounded-xl border border-gray-200">
        <button class="w-full flex items-center justify-between px-4 py-3" @click="showFinished = !showFinished">
          <h2 class="font-display font-bold text-bark">
            Finished today ({{ finished.length }})
          </h2>
          <span class="text-gray-400 text-sm">{{ showFinished ? 'Hide' : 'Show' }}</span>
        </button>
        <template v-if="showFinished">
          <div v-for="g in finished" :key="g.booking.id" class="row">
            <div class="w-20 flex-shrink-0 font-display font-bold text-gray-400">
              {{ teeTime(g.slot.startTime) }}
            </div>
            <div class="flex-1 min-w-0 text-sm">
              <span class="font-semibold text-bark">{{ g.booking.name }}</span>
              <span class="text-gray-500"> · {{ roundText(g.booking) }}</span>
            </div>
            <div class="text-sm text-gray-500 w-64">
              <template v-if="g.track.state === 'FINISHED'">
                In at {{ clock(g.track.finishedAt) }} · {{ formatMinutes(g.track.playedMinutes) }}
                <span :class="['badge ml-1', badgeClass(g.track.pace)]">{{ paceLabel(g.track.deltaMinutes) }}</span>
              </template>
              <template v-else>
                Probably finished (est. {{ clock(g.track.estimatedFinish) }})
              </template>
            </div>
            <div class="flex gap-2">
              <button
                v-if="g.track.state === 'FINISHED'"
                class="btn-outline-xs text-gray-400"
                :disabled="busy === g.booking.id"
                @click="act(g, 'undo_finish')"
              >
                Undo
              </button>
              <template v-else>
                <button class="btn-outline-xs" :disabled="busy === g.booking.id" @click="act(g, 'finish')">
                  Finished
                </button>
                <button class="btn-outline-xs" @click="openPosition(g)">
                  Still out
                </button>
              </template>
            </div>
          </div>
        </template>
      </div>

      <p class="text-gray-400 text-xs">
        Refreshes every 30 seconds.
        <template v-if="learned">
          Each hole's time is learned from the last {{ LEARN_DAYS }} days of reports (an 18-hole round currently takes
          about {{ formatMinutes(roundLength) }}), so every update you make sharpens the estimates.
        </template>
        <template v-else>
          Until there are enough reports to learn each hole's time, the expected {{ formatMinutes(roundLength) }} round
          (Admin → Settings) is split across the holes by par.
        </template>
        Positions are estimated from the latest reported position, or the tee-off, or the tee time if neither was recorded. Ahead and behind are measured against each group's tee time, within
        {{ PACE_TOLERANCE_MINUTES }} minutes counts as on pace.
      </p>
    </template>

    <!-- Update position -->
    <div v-if="positioning" class="modal-overlay" @click.self="positioning = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">
          Where is {{ positioning.group.booking.name }}?
        </h2>
        <p class="text-gray-500 text-sm mb-4">
          {{ roundText(positioning.group.booking) }} · tee time {{ teeTime(positioning.group.slot.startTime) }}
        </p>
        <div class="grid grid-cols-9 gap-1 mb-4">
          <button
            v-for="h in positioning.holes"
            :key="h"
            type="button"
            :class="['h-10 rounded-lg border text-sm',
                     positioning.hole === h ? 'bg-pine text-parch border-pine' : 'border-gray-300 text-bark hover:bg-gray-50']"
            @click="pickHole(h)"
          >
            {{ h }}
          </button>
        </div>
        <div class="flex rounded-lg border border-gray-300 overflow-hidden w-fit">
          <button
            v-for="s in stagesFor(positioning.hole)"
            :key="s.value"
            type="button"
            :class="['px-4 py-2 text-sm', positioning.stage === s.value ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
            @click="positioning.stage = s.value"
          >
            {{ s.label }}
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-2">
          Hole {{ positioning.hole }}: par {{ holeInfo(positioning.hole)?.par }}, {{ holeInfo(positioning.hole)?.name }}
        </p>
        <p v-if="positioning.error" class="text-red-500 text-sm mt-3">
          {{ positioning.error }}
        </p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="positioning = null">
            Back
          </button>
          <button class="btn-amber px-4 py-2 text-sm" :disabled="busy === positioning.group.booking.id" @click="savePosition">
            {{ busy === positioning.group.booking.id ? 'Saving…' : 'Save position' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Carts and round -->
    <div v-if="setup" class="modal-overlay" @click.self="setup = null">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-4">
          Carts and round — {{ setup.group.booking.name }}
        </h2>
        <RoundSetupFields v-model="setup.form" :carts-out="cartsInUse(groups, setup.group.booking.id)" />
        <p v-if="setup.error" class="text-red-500 text-sm mt-3">
          {{ setup.error }}
        </p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="setup = null">
            Back
          </button>
          <button class="btn-amber px-4 py-2 text-sm" :disabled="busy === setup.group.booking.id" @click="saveSetup">
            {{ busy === setup.group.booking.id ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { COURSE_TZ, localDateTimeToUtc } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import {
  LEARN_DAYS, PACE_TOLERANCE_MINUTES, cartsInUse, coursePace, expectedRoundMinutes, formatMinutes, holeInfo, holeOrder,
  openHolesAhead, paceLabel, paceProfile, stageLabel, stagesFor, trackedGroups,
} from '@/lib/pace'
import { holes } from '@/data/holes'
import RoundSetupFields from '@/components/oncourse/RoundSetupFields.vue'
import { cartsLabel, setupForm, setupPayload } from '@/components/oncourse/roundSetup'

const REFRESH_MS = 30_000
// A report this recent shows solid on the map
const FRESH_MINUTES = 30
// Groups still show under "Up next" this long after their tee time if the starter hasn't recorded a tee-off
const STARTER_GRACE_MINUTES = 20
const NINES = [
  { label: 'Front nine', holes: holes.slice(0, 9) },
  { label: 'Back nine', holes: holes.slice(9) },
]

const sheet        = ref(null)
const loading      = ref(false)
const error        = ref(null)
const actionError  = ref(null)
const busy         = ref(null)
const refreshedAt  = ref(null)
const now          = ref(new Date())
const showFinished = ref(false)
const positioning  = ref(null) // { group, holes, hole, stage, error }
const setup        = ref(null) // { group, form, error }
let timer = null

const profile = computed(() => paceProfile(sheet.value))
const learned = computed(() => profile.value.holeSeconds.length === 18)
const roundLength = computed(() => expectedRoundMinutes(profile.value))

const groups = computed(() => {
  const list = trackedGroups(sheet.value?.slots, profile.value, now.value)
  const gaps = openHolesAhead(list.map(g => g.track))
  return list.map((g, i) => ({ ...g, gap: gaps[i] }))
})

const pace = computed(() => coursePace(groups.value.map(g => g.track), now.value))

// Not recorded off yet, and either before the tee time or only just past it
function isUpNext({ booking, track }) {
  if (booking.teedOffAt || booking.positionAt || track.state === 'FINISHED') return false
  return track.state === 'WAITING' || (now.value - track.teeTime) / 60_000 < STARTER_GRACE_MINUTES
}

const starter  = computed(() => groups.value.filter(isUpNext))
const onCourse = computed(() => groups.value.filter(g => g.track.state === 'ON_COURSE' && !isUpNext(g)))
const finished = computed(() => groups.value.filter(g => g.track.state === 'FINISHED' || g.track.state === 'DONE')
  .sort((a, b) => b.track.estimatedFinish - a.track.estimatedFinish))

const golfersOut = computed(() => onCourse.value.reduce((s, g) => s + g.booking.players, 0))
const cartsOut   = computed(() => cartsInUse(groups.value))
const lastFinish = computed(() => {
  const times = onCourse.value.map(g => g.track.estimatedFinish.getTime())
  return times.length ? new Date(Math.max(...times)) : null
})

const firstTeeText = computed(() => {
  const late = pace.value.firstTeeLateMinutes
  if (late == null) return 'No recent tee-offs'
  if (late <= 2) return 'On time'
  return `${formatMinutes(late)} late`
})

// For call-ins and walk-ins: the next tee time with room, and when it'll really go off at today's pace
const nextOpen = computed(() => {
  const slot = (sheet.value?.slots ?? []).find(s => s.available > 0 && localDateTimeToUtc(s.date, s.startTime) > now.value)
  if (!slot) return null
  const lateBy = Math.max(0, pace.value.firstTeeLateMinutes ?? 0)
  const goesOff = new Date(localDateTimeToUtc(slot.date, slot.startTime).getTime() + lateBy * 60_000)
  const extra = Math.max(0, pace.value.deltaMinutes ?? 0) - lateBy
  const finishes = new Date(goesOff.getTime() + (roundLength.value + Math.max(0, extra)) * 60_000)
  return { slot, lateBy, goesOff, finishes }
})

function groupsOnHole(hole) {
  return onCourse.value.filter(g => g.track.hole === hole)
}

function isFresh(track) {
  return track.basis === 'REPORTED' && track.reportedMinutesAgo <= FRESH_MINUTES
}

function chipLabel(b) {
  if (b.cartNumbers?.length) return b.cartNumbers.join('·')
  return b.name.split(' ')[0]
}

function chipClass(g) {
  if (g.track.pace === 'BEHIND') return 'bg-clay/15 text-clay border-clay/50'
  if (g.track.pace === 'AHEAD') return 'bg-lake/15 text-lake border-lake/50'
  return 'bg-pine/15 text-pine border-pine/50'
}

function badgeClass(p) {
  if (p === 'BEHIND') return 'bg-clay/15 text-clay'
  if (p === 'AHEAD') return 'bg-lake/15 text-lake'
  return 'bg-pine/15 text-pine'
}

function paceText(p) {
  if (p === 'BEHIND') return 'text-clay'
  if (p === 'AHEAD') return 'text-lake'
  return 'text-bark'
}

function playersText(b) {
  return `${b.players} player${b.players === 1 ? '' : 's'}`
}

function roundText(b) {
  const holesText = `${b.roundHoles} holes${b.startHole === 10 ? ' from 10' : ''}`
  return [cartsLabel(b) || 'No cart recorded', holesText].join(' · ')
}

function basisText(track) {
  if (track.basis === 'REPORTED') return `Reported ${track.reportedMinutesAgo ? `${formatMinutes(track.reportedMinutesAgo)} ago` : 'just now'}`
  if (track.basis === 'TEED_OFF') return 'Estimated from the tee-off'
  return 'Estimated from the tee time'
}

function dueText({ track }) {
  if (track.state === 'WAITING' && track.startsInMinutes > 0) return `Due in ${formatMinutes(track.startsInMinutes)}`
  const late = Math.round((now.value - track.teeTime) / 60_000)
  return late <= 0 ? 'Due now' : `${formatMinutes(late)} past tee time`
}

function dueClass({ track }) {
  const late = (now.value - track.teeTime) / 60_000
  return late > PACE_TOLERANCE_MINUTES ? 'text-clay font-semibold' : 'text-gray-500'
}

function clock(d) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}

async function load({ quiet = false } = {}) {
  if (!quiet) loading.value = true
  error.value = null
  try {
    sheet.value = await apiFetch('/api/staff/oncourse')
    now.value = new Date()
    refreshedAt.value = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch (e) {
    if (!quiet) error.value = e.message
  } finally {
    loading.value = false
  }
}

// Saves one action and puts the updated booking straight into the sheet
async function post(g, body) {
  const fresh = await apiFetch(`/api/staff/oncourse/${g.booking.id}`, { method: 'POST', body })
  const slot = sheet.value.slots.find(s => s.id === g.slot.id)
  if (slot) slot.bookings = slot.bookings.map(b => (b.id === fresh.id ? { ...b, ...fresh } : b))
  now.value = new Date()
}

async function act(g, action) {
  busy.value = g.booking.id
  actionError.value = null
  try {
    await post(g, { action })
  } catch (e) {
    actionError.value = e.message
    load({ quiet: true })
  } finally {
    busy.value = null
  }
}

function openPosition(g) {
  const order = holeOrder(g.booking.startHole, g.booking.roundHoles)
  // Start from the estimate (or the first hole); a finished-by-estimate group starts on its last hole
  const hole = g.track.hole ?? (g.track.state === 'DONE' ? order[order.length - 1] : order[0])
  const stage = g.track.hole ? g.track.stage : 'TEE'
  positioning.value = { group: g, holes: order, hole, stage, error: null }
}

function pickHole(h) {
  const p = positioning.value
  p.hole = h
  if (!stagesFor(h).some(s => s.value === p.stage)) p.stage = 'TEE'
}

async function savePosition() {
  const p = positioning.value
  busy.value = p.group.booking.id
  p.error = null
  try {
    await post(p.group, { action: 'position', hole: p.hole, stage: p.stage })
    positioning.value = null
  } catch (e) {
    p.error = e.message
  } finally {
    busy.value = null
  }
}

function openSetup(g) {
  setup.value = { group: g, form: setupForm(g.booking), error: null }
}

async function saveSetup() {
  const s = setup.value
  busy.value = s.group.booking.id
  s.error = null
  try {
    await post(s.group, { action: 'setup', ...setupPayload(s.form) })
    setup.value = null
  } catch (e) {
    s.error = e.message
  } finally {
    busy.value = null
  }
}

onMounted(() => {
  load()
  timer = setInterval(() => { if (!document.hidden) load({ quiet: true }) }, REFRESH_MS)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.card       { @apply bg-white rounded-xl border border-gray-200 p-4; }
.card-label { @apply text-xs text-gray-400 uppercase tracking-wide; }
.card-value { @apply font-display font-bold text-lg mt-1; }
.card-note  { @apply text-xs text-gray-400 mt-1; }
.row        { @apply flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-t border-gray-100; }
.chip       { @apply text-xs px-1.5 py-0.5 rounded border font-semibold; }
.badge      { @apply text-xs px-2 py-0.5 rounded-full whitespace-nowrap; }
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.btn-pine-sm    { @apply bg-pine text-parch text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-pine/90 transition-colors disabled:opacity-50; }
.btn-outline-xs { @apply border border-gray-300 text-gray-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40; }
</style>
