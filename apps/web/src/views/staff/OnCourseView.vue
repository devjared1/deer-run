<template>
  <div
    class="font-body"
    :data-contrast="highContrast ? 'high' : undefined"
  >
    <CoursePaceBar
      :delta-minutes="pace.deltaMinutes"
      :groups-out="onCourse.length"
      :golfers-out="golfersOut"
      :carts-out="cartsOut.size"
      :first-tee-late="pace.firstTeeLateMinutes"
    />

    <div class="max-w-6xl pt-3 space-y-6">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p
          class="text-body-m text-on-surface-variant"
          aria-live="polite"
        >
          <template v-if="refreshedAt">
            Updated {{ refreshedAt }}<span class="hidden sm:inline"> · refreshes every 30 s</span>
          </template>
        </p>
        <div class="flex items-center gap-2 ml-auto">
          <IconButton
            :icon="IconRefresh"
            label="Refresh now"
            :disabled="loading"
            @click="load({ quiet: !!sheet })"
          />
          <Switch
            v-model="highContrast"
            label="High contrast"
          />
        </div>
      </div>

      <div
        v-if="loading && !sheet"
        class="grid gap-3 sm:grid-cols-2"
      >
        <Skeleton
          variant="card"
          label="Loading the course"
        />
        <Skeleton variant="card" />
        <Skeleton
          variant="card"
          class="hidden sm:block"
        />
      </div>
      <ErrorBanner
        v-else-if="error && !sheet"
        :message="error"
        :retrying="loading"
        @retry="load()"
      />

      <div
        v-else-if="sheet"
        class="flex flex-col gap-8"
      >
        <!-- Starter: checked in, not off yet -->
        <section
          v-if="starter.length"
          class="order-1 lg:order-3 space-y-3"
          aria-labelledby="up-next-title"
        >
          <h2
            id="up-next-title"
            class="font-display text-headline-s text-on-surface"
          >
            Up next on the tee <span class="text-on-surface-variant text-title-l font-body">({{ starter.length }})</span>
          </h2>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <GroupCard
              v-for="g in starter"
              :key="g.booking.id"
              :group="g"
              kind="upnext"
              :now="now"
              :busy="busy === g.booking.id"
              @tee-off="teeOff(g)"
              @setup="openSetup(g)"
            />
          </div>
        </section>

        <!-- On the course -->
        <section
          class="order-2 lg:order-4 space-y-3"
          aria-labelledby="on-course-title"
        >
          <h2
            id="on-course-title"
            class="font-display text-headline-s text-on-surface"
          >
            On the course <span class="text-on-surface-variant text-title-l font-body">({{ onCourse.length }})</span>
          </h2>
          <EmptyState
            v-if="!onCourse.length"
            compact
            :icon="IconGolf"
            title="Nobody's out on the course"
            :message="starter.length ? 'Record a tee-off above when a group goes off the first tee.' : 'Groups show here once they check in on the tee sheet and tee off.'"
          />
          <div
            v-else
            class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            <GroupCard
              v-for="g in onCourse"
              :key="g.booking.id"
              :group="g"
              kind="oncourse"
              :now="now"
              :busy="busy === g.booking.id"
              @update="openPosition(g)"
              @finish="finish(g)"
              @tee-off="teeOff(g)"
              @undo-tee-off="undoTeeOff(g)"
              @setup="openSetup(g)"
            />
          </div>
        </section>

        <!-- Course map -->
        <Card
          variant="outlined"
          class="order-3 lg:order-2"
        >
          <CourseMap
            :groups="onCourse"
            @select-hole="openHole"
          />
        </Card>

        <!-- At a glance -->
        <section
          class="order-4 lg:order-1 grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3"
          aria-label="At a glance"
        >
          <Card
            variant="filled"
            padding="sm"
          >
            <h3 class="text-label-l text-on-surface-variant">
              First tee
            </h3>
            <p :class="['text-title-l mt-1', pace.firstTeeLateMinutes > PACE_TOLERANCE_MINUTES ? 'text-on-warning-container' : 'text-on-surface']">
              {{ firstTeeText }}
            </p>
            <p class="text-body-m text-on-surface-variant mt-1">
              Tee-offs recorded in the last 90 minutes
            </p>
          </Card>
          <Card
            variant="filled"
            padding="sm"
          >
            <h3 class="text-label-l text-on-surface-variant">
              Next open tee time
            </h3>
            <template v-if="nextOpen">
              <p class="text-title-l text-on-surface mt-1">
                {{ teeTime(nextOpen.slot.startTime) }} · {{ nextOpen.slot.available }} open
              </p>
              <p class="text-body-m text-on-surface-variant mt-1">
                <template v-if="nextOpen.lateBy > 0">
                  Likely goes off around {{ clock(nextOpen.goesOff) }};
                </template>
                done around {{ clock(nextOpen.finishes) }} (18 holes)
              </p>
            </template>
            <p
              v-else
              class="text-title-l text-on-surface-variant mt-1"
            >
              None left today
            </p>
          </Card>
          <Card
            variant="filled"
            padding="sm"
          >
            <h3 class="text-label-l text-on-surface-variant">
              On the course
            </h3>
            <p class="text-title-l text-on-surface mt-1">
              {{ golfersOut }} golfer{{ golfersOut === 1 ? '' : 's' }} · {{ cartsOut.size }} cart{{ cartsOut.size === 1 ? '' : 's' }}
            </p>
            <p class="text-body-m text-on-surface-variant mt-1">
              {{ lastFinish ? `Last group in around ${clock(lastFinish)}` : 'Nobody out right now' }}
            </p>
          </Card>
        </section>

        <!-- Finished (or probably finished) -->
        <section
          v-if="finished.length"
          class="order-5 space-y-3"
          aria-labelledby="finished-title"
        >
          <button
            type="button"
            class="state-layer w-full flex items-center justify-between min-h-12 -mx-2 px-2 rounded-shape-sm cursor-pointer"
            :aria-expanded="String(showFinished)"
            aria-controls="finished-list"
            @click="showFinished = !showFinished"
          >
            <h2
              id="finished-title"
              class="font-display text-headline-s text-on-surface"
            >
              Finished today <span class="text-on-surface-variant text-title-l font-body">({{ finished.length }})</span>
            </h2>
            <span class="flex items-center gap-1 text-label-l text-primary">
              {{ showFinished ? 'Hide' : 'Show' }}
              <IconExpand
                :class="['w-6 h-6 transition-transform duration-short-4', showFinished ? 'rotate-180' : '']"
                aria-hidden="true"
              />
            </span>
          </button>
          <div
            v-if="showFinished"
            id="finished-list"
            class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            <GroupCard
              v-for="g in finished"
              :key="g.booking.id"
              :group="g"
              kind="finished"
              :now="now"
              :busy="busy === g.booking.id"
              @finish="finish(g)"
              @update="openPosition(g)"
              @undo-finish="undoFinish(g)"
              @setup="openSetup(g)"
            />
          </div>
        </section>

        <details class="order-6 group text-body-m text-on-surface-variant">
          <summary class="state-layer flex items-center gap-2 min-h-12 -mx-2 px-2 rounded-shape-sm cursor-pointer text-label-l text-primary list-none">
            <IconInfo
              class="w-5 h-5"
              aria-hidden="true"
            />
            How the estimates work
          </summary>
          <p class="mt-2 max-w-prose">
            <template v-if="learned">
              Each hole's time is learned from the last {{ LEARN_DAYS }} days of reports (an 18-hole round currently takes
              about {{ formatMinutes(roundLength) }}), so every update you make sharpens the estimates.
            </template>
            <template v-else>
              Until there are enough reports to learn each hole's time, the expected {{ formatMinutes(roundLength) }} round
              (Admin → Settings) is split across the holes by par.
            </template>
            Positions are estimated from the latest reported position, or the tee-off, or the tee time if neither was
            recorded. Ahead and behind are measured against each group's tee time; within {{ PACE_TOLERANCE_MINUTES }}
            minutes counts as on pace.
          </p>
        </details>
      </div>
    </div>

    <!-- Map tile → the groups on that hole -->
    <HoleGroupsSheet
      v-model:open="holeSheet.open"
      :hole="holeSheet.hole"
      :groups="holeSheet.hole ? groupsOnHole(holeSheet.hole) : []"
      :high-contrast="highContrast"
      @update="updateFromHole"
      @after-leave="afterHoleSheet"
    />

    <!-- Update position: group → hole → stage → Save -->
    <UpdatePositionSheet
      v-model:open="positioning.open"
      :groups="positionGroups"
      :group-id="positioning.groupId"
      :busy="!!positioning.groupId && busy === positioning.groupId"
      :error="positioning.error"
      :high-contrast="highContrast"
      @group-change="id => { positioning.groupId = id; positioning.error = '' }"
      @save="savePosition"
    />

    <!-- Carts and round -->
    <BottomSheet
      v-model:open="setup.open"
      :title="setup.group ? `Carts and round: ${setup.group.booking.name}` : 'Carts and round'"
    >
      <div
        v-if="setup.group"
        :data-contrast="highContrast ? 'high' : undefined"
        class="space-y-3 pb-1"
      >
        <RoundSetupFields
          v-model="setup.form"
          :carts-out="cartsInUse(groups, setup.group.booking.id)"
        />
        <ErrorBanner
          v-if="setup.error"
          :message="setup.error"
        />
      </div>
      <template #actions="{ close }">
        <AppButton
          variant="text"
          size="lg"
          @click="close"
        >
          Cancel
        </AppButton>
        <AppButton
          size="lg"
          class="flex-1"
          :loading="!!setup.group && busy === setup.group.booking.id"
          @click="saveSetup"
        >
          Save
        </AppButton>
      </template>
    </BottomSheet>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { COURSE_TZ, localDateTimeToUtc } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import {
  LEARN_DAYS, PACE_TOLERANCE_MINUTES, STAGES, cartsInUse, coursePace, expectedRoundMinutes, formatMinutes,
  openHolesAhead, paceProfile, trackedGroups,
} from '@/lib/pace'
import { useHighContrast } from '@/composables/useHighContrast'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import Card from '@/components/ui/Card.vue'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Switch from '@/components/ui/Switch.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import RoundSetupFields from '@/components/oncourse/RoundSetupFields.vue'
import { setupForm, setupPayload } from '@/components/oncourse/roundSetup'
import GroupCard from '@/components/oncourse/GroupCard.vue'
import CourseMap from '@/components/oncourse/CourseMap.vue'
import CoursePaceBar from '@/components/oncourse/CoursePaceBar.vue'
import HoleGroupsSheet from '@/components/oncourse/HoleGroupsSheet.vue'
import UpdatePositionSheet from '@/components/oncourse/UpdatePositionSheet.vue'
import IconRefresh from '~icons/material-symbols/refresh-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconExpand from '~icons/material-symbols/expand-more-rounded'
import IconInfo from '~icons/material-symbols/info-rounded'

const REFRESH_MS = 30_000
// Groups still show under "Up next" this long after their tee time if the starter hasn't recorded a tee-off
const STARTER_GRACE_MINUTES = 20

const { highContrast } = useHighContrast()
const confirm = useConfirm()
const snackbar = useSnackbar()

const sheet        = ref(null)
const loading      = ref(false)
const error        = ref(null)
const busy         = ref(null)
const refreshedAt  = ref(null)
const now          = ref(new Date())
const showFinished = ref(false)
const positioning  = reactive({ open: false, groupId: null, extraId: null, error: '' })
const holeSheet    = reactive({ open: false, hole: null, pending: null })
const setup        = reactive({ open: false, group: null, form: null, error: '' })
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

// The update sheet offers the groups on the course, plus the group it was opened for (e.g. "Still out")
const positionGroups = computed(() => {
  const extra = positioning.extraId && !onCourse.value.some(g => g.booking.id === positioning.extraId)
    ? groups.value.filter(g => g.booking.id === positioning.extraId)
    : []
  return [...onCourse.value, ...extra]
})

function groupsOnHole(hole) {
  return onCourse.value.filter(g => g.track.hole === hole)
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

// One action from a card; true when it saved. On failure: an error snackbar and a quiet reload.
async function act(g, action) {
  busy.value = g.booking.id
  try {
    await post(g, { action })
    return true
  } catch (e) {
    snackbar.show({ message: e.message, tone: 'error' })
    load({ quiet: true })
    return false
  } finally {
    busy.value = null
  }
}

async function teeOff(g) {
  if (await act(g, 'tee_off')) {
    snackbar.show({ message: `${g.booking.name} teed off`, actionLabel: 'Undo', onAction: () => act(g, 'undo_tee_off') })
  }
}

async function finish(g) {
  if (await act(g, 'finish')) {
    snackbar.show({ message: `${g.booking.name} finished`, actionLabel: 'Undo', onAction: () => act(g, 'undo_finish') })
  }
}

async function undoTeeOff(g) {
  const ok = await confirm({
    title: 'Undo tee-off?',
    message: `Clears ${g.booking.name}'s tee-off time and reported position, and deletes their position reports.`,
    confirmLabel: 'Undo tee-off',
    destructive: true,
  })
  if (ok && await act(g, 'undo_tee_off')) snackbar.show('Tee-off cleared')
}

async function undoFinish(g) {
  const ok = await confirm({
    title: 'Undo finish?',
    message: `Puts ${g.booking.name} back on the course.`,
    confirmLabel: 'Undo finish',
  })
  if (ok && await act(g, 'undo_finish')) snackbar.show(`${g.booking.name} is back on the course`)
}

function openPosition(g) {
  positioning.groupId = g.booking.id
  positioning.extraId = g.booking.id
  positioning.error = ''
  positioning.open = true
}

async function savePosition({ group, hole, stage }) {
  busy.value = group.booking.id
  positioning.error = ''
  try {
    await post(group, { action: 'position', hole, stage })
    positioning.open = false
    const where = STAGES.find(s => s.value === stage)?.short.toLowerCase() ?? stage
    snackbar.show(`${group.booking.name}: hole ${hole}, ${where}`)
  } catch (e) {
    positioning.error = e.message
  } finally {
    busy.value = null
  }
}

function openHole(hole) {
  holeSheet.hole = hole
  holeSheet.pending = null
  holeSheet.open = true
}

// Hole sheet → update sheet: open the second once the first has slid away
function updateFromHole(g) {
  holeSheet.pending = g
  holeSheet.open = false
}
function afterHoleSheet() {
  const g = holeSheet.pending
  holeSheet.pending = null
  if (g) openPosition(g)
}

function openSetup(g) {
  Object.assign(setup, { open: true, group: g, form: setupForm(g.booking), error: '' })
}

async function saveSetup() {
  const g = setup.group
  busy.value = g.booking.id
  setup.error = ''
  try {
    await post(g, { action: 'setup', ...setupPayload(setup.form) })
    setup.open = false
    snackbar.show('Carts and round saved')
  } catch (e) {
    setup.error = e.message
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
