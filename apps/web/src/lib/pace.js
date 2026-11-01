// On-course pace estimates, shared by the Vue app and the Pages Functions (no '@/' imports).
//
// Each hole's expected time comes from past rounds (CourseSettings.holeSeconds, learned daily from every position
// report by learnHoleSeconds()); until there's history, the expected round (CourseSettings.roundMinutes for 18 holes)
// is split across the holes by par. A group is placed on the course from its latest reported position (or its
// tee-off, or else its tee time) and assumed to keep the planned pace from there. Ahead/behind is measured against the booked tee time, so a group that went
// off 10 minutes late and has kept pace is still 10 minutes behind the tee sheet.

import { holes } from '../data/holes.js'
import { localDateTimeToUtc, toUtcIso } from './timeclock.js'

export const DEFAULT_ROUND_MINUTES = 255 // 4 h 15 min
export const MIN_ROUND_MINUTES = 120
export const MAX_ROUND_MINUTES = 420
// Within this many minutes of the plan counts as on pace
export const PACE_TOLERANCE_MINUTES = 10
// Course pace averages the groups whose position was reported this recently
export const RECENT_REPORT_MINUTES = 60
// "First tee running late" averages the groups that teed off this recently
const RECENT_TEE_OFF_MINUTES = 90

// Relative time per hole by par (a par 4 takes 1.4 times a par 3)
const PAR_WEIGHT = { 3: 10, 4: 14, 5: 17 }
const TOTAL_WEIGHT = holes.reduce((sum, h) => sum + PAR_WEIGHT[h.par], 0)

export const STAGES = [
  { value: 'TEE',     label: 'Teeing off',     short: 'Tee' },
  { value: 'FAIRWAY', label: 'In the fairway', short: 'Fairway' },
  { value: 'GREEN',   label: 'On the green',   short: 'Green' },
]
// Where each stage starts, as a fraction of the hole's time. Par 3s go from the tee straight to the green.
const STAGE_AT = {
  3: { TEE: 0, GREEN: 0.55 },
  4: { TEE: 0, FAIRWAY: 0.3, GREEN: 0.7 },
  5: { TEE: 0, FAIRWAY: 0.25, GREEN: 0.75 },
}

export function holeInfo(n) {
  return holes[n - 1] ?? null
}

/** The stages that make sense on a hole (no fairway on a par 3). */
export function stagesFor(hole) {
  const at = STAGE_AT[holeInfo(hole)?.par] ?? STAGE_AT[4]
  return STAGES.filter(s => s.value in at)
}

export function stageLabel(value) {
  return STAGES.find(s => s.value === value)?.label ?? value
}

/** Holes in playing order: start on 1 or 10, 9 or 18 holes (an 18 from 10 plays 10–18 then 1–9). */
export function holeOrder(startHole = 1, roundHoles = 18) {
  const nines = startHole === 10 ? [10, 1] : [1, 10]
  return nines.slice(0, roundHoles === 9 ? 1 : 2).flatMap(first => Array.from({ length: 9 }, (_, i) => first + i))
}

/**
 * Minutes per hole (18 values, hole 1 first) for a pace profile: either a round length in minutes (split by par) or
 * { roundMinutes, holeSeconds } from CourseSettings, where holeSeconds are the learned times (used when complete).
 */
export function perHoleMinutes(pace = DEFAULT_ROUND_MINUTES) {
  if (pace?.holeSeconds?.length === holes.length) return pace.holeSeconds.map(s => s / 60)
  const roundMinutes = (typeof pace === 'number' ? pace : pace?.roundMinutes) || DEFAULT_ROUND_MINUTES
  return holes.map(h => PAR_WEIGHT[h.par] * roundMinutes / TOTAL_WEIGHT)
}

/** The pace profile from a tee sheet / CourseSettings response: { roundMinutes, holeSeconds }. */
export function paceProfile(source) {
  return { roundMinutes: source?.roundMinutes ?? DEFAULT_ROUND_MINUTES, holeSeconds: source?.holeSeconds ?? [] }
}

/** Expected minutes for a whole round (18 holes from 1 by default) under a pace profile. */
export function expectedRoundMinutes(pace, round = {}) {
  return planTotal(roundPlan(round, pace))
}

/** [{ hole, par, start, end }] in minutes from the tee-off, for a booking's startHole / roundHoles. */
export function roundPlan({ startHole = 1, roundHoles = 18 } = {}, pace = DEFAULT_ROUND_MINUTES) {
  const minutes = perHoleMinutes(pace)
  let t = 0
  return holeOrder(startHole, roundHoles).map(hole => {
    const start = t
    t += minutes[hole - 1]
    return { hole, par: holeInfo(hole).par, start, end: t }
  })
}

function planTotal(plan) {
  return plan.length ? plan[plan.length - 1].end : 0
}

/** Minutes into the round at which the group reaches hole + stage, or null if the hole isn't in the round. */
export function planOffset(plan, hole, stage = 'TEE') {
  const e = plan.find(p => p.hole === hole)
  if (!e) return null
  const at = STAGE_AT[e.par][stage] ?? 0 // a fairway on a par 3 counts as the tee
  return e.start + at * (e.end - e.start)
}

/** { hole, stage } the plan has the group on this many minutes in; null before the start or after the last green. */
export function positionAtOffset(plan, minutes) {
  if (minutes < 0) return null
  const e = plan.find(p => minutes < p.end)
  if (!e) return null
  const fraction = (minutes - e.start) / (e.end - e.start)
  const reached = Object.entries(STAGE_AT[e.par]).filter(([, at]) => fraction >= at)
  return { hole: e.hole, stage: reached[reached.length - 1][0] }
}

export function paceOf(deltaMinutes) {
  if (deltaMinutes > PACE_TOLERANCE_MINUTES) return 'BEHIND'
  if (deltaMinutes < -PACE_TOLERANCE_MINUTES) return 'AHEAD'
  return 'ON_PACE'
}

/** 12 → "12 min behind", -8 → "8 min ahead", 3 → "On pace" */
export function paceLabel(deltaMinutes) {
  if (deltaMinutes == null) return ''
  const pace = paceOf(deltaMinutes)
  if (pace === 'ON_PACE') return 'On pace'
  return `${formatMinutes(Math.abs(deltaMinutes))} ${pace === 'BEHIND' ? 'behind' : 'ahead'}`
}

/** 75 → "1 h 15 min", 40 → "40 min" */
export function formatMinutes(minutes) {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
}

const minutesBetween = (from, to) => (to.getTime() - from.getTime()) / 60_000
const asDate = ts => (ts ? new Date(toUtcIso(ts)) : null)

/**
 * Where a checked-in group probably is, and how it's doing against its tee time.
 * booking: startHole, roundHoles, teedOffAt, positionHole, positionStage, positionAt, finishedAt
 * slot: { date, startTime }
 * Returns {
 *   state: 'WAITING' (before its start) | 'ON_COURSE' | 'DONE' (past the last green by the estimate, not marked
 *          finished) | 'FINISHED',
 *   hole, stage            estimated now (ON_COURSE only), holeNumber of holesTotal in playing order
 *   expectedHole           where the tee time says the group should be now (null before / after the round)
 *   deltaMinutes, pace     + behind / − ahead of the tee time's plan; 'AHEAD' | 'ON_PACE' | 'BEHIND'
 *   basis                  'REPORTED' (a marshal's report) | 'TEED_OFF' (starter's tee-off) | 'TEE_TIME' (assumed on time)
 *   reportedMinutesAgo, teeTime, teedOffAt, finishedAt, estimatedFinish (Dates), totalMinutes, startsInMinutes
 * }
 */
export function trackGroup(booking, slot, pace = DEFAULT_ROUND_MINUTES, now = new Date()) {
  const plan = roundPlan(booking, pace)
  const totalMinutes = planTotal(plan)
  const teeTime = localDateTimeToUtc(slot.date, slot.startTime)
  const teedOffAt = asDate(booking.teedOffAt)
  const finishedAt = asDate(booking.finishedAt)
  const reportedAt = asDate(booking.positionAt)
  const reportedOffset = booking.positionHole && reportedAt
    ? planOffset(plan, booking.positionHole, booking.positionStage || 'TEE')
    : null

  let delta, progress, basis
  let reportedMinutesAgo = null
  if (reportedOffset != null) {
    delta = minutesBetween(teeTime, reportedAt) - reportedOffset
    progress = reportedOffset + minutesBetween(reportedAt, now)
    basis = 'REPORTED'
    reportedMinutesAgo = Math.max(0, Math.round(minutesBetween(reportedAt, now)))
  } else {
    const start = teedOffAt ?? teeTime
    delta = minutesBetween(teeTime, start)
    progress = minutesBetween(start, now)
    basis = teedOffAt ? 'TEED_OFF' : 'TEE_TIME'
  }

  const base = { teeTime, teedOffAt, finishedAt, totalMinutes, holesTotal: plan.length, basis, reportedMinutesAgo }
  if (finishedAt) {
    const finishDelta = minutesBetween(teeTime, finishedAt) - totalMinutes
    return {
      ...base, state: 'FINISHED', hole: null, stage: null, expectedHole: null,
      deltaMinutes: Math.round(finishDelta), pace: paceOf(finishDelta), estimatedFinish: finishedAt,
      playedMinutes: Math.round(minutesBetween(teedOffAt ?? teeTime, finishedAt)),
    }
  }

  const common = {
    ...base,
    deltaMinutes: Math.round(delta),
    pace: paceOf(delta),
    expectedHole: positionAtOffset(plan, minutesBetween(teeTime, now))?.hole ?? null,
    estimatedFinish: new Date(teeTime.getTime() + (delta + totalMinutes) * 60_000),
  }
  if (progress < 0) return { ...common, state: 'WAITING', hole: null, stage: null, startsInMinutes: Math.round(-progress) }
  const pos = positionAtOffset(plan, progress)
  if (!pos) return { ...common, state: 'DONE', hole: null, stage: null }
  return { ...common, state: 'ON_COURSE', ...pos, holeNumber: plan.findIndex(p => p.hole === pos.hole) + 1 }
}

/** Checked-in, paid bookings from a tee sheet's slots, in tee time order: [{ booking, slot, track }]. */
export function trackedGroups(slots, pace, now = new Date()) {
  return (slots || []).flatMap(slot => slot.bookings
    .filter(b => b.status === 'CONFIRMED' && b.checkedInAt)
    .map(booking => ({ booking, slot, track: trackGroup(booking, slot, pace, now) })))
}

// ─── Learning per-hole times from past rounds ──────────────────────────────

// Rounds from the last this-many days are used
export const LEARN_DAYS = 60
// Each hole starts with this many rounds' worth of the par split, so a few reports don't swing it
const PRIOR_ROUNDS = 3
// A stretch between two reports played faster than 0.4× or slower than 2.5× the plan is a mistake (a late
// "Finished" tap, a wrong hole) and is left out
const MIN_SEGMENT_RATIO = 0.4
const MAX_SEGMENT_RATIO = 2.5

// Passes of the fit in learnHoleSeconds()
const FIT_ITERATIONS = 60

/**
 * Per-hole times from past rounds. Each round gives its known points in time: the tee-off, every position report and
 * the finish, so each stretch between two consecutive points is "these holes (or parts of holes) took this long".
 * The hole times that best explain all the stretches are found iteratively: each pass splits every stretch's time
 * over its holes in proportion to the current estimates and averages what each hole got. With reports landing on
 * different holes across rounds, a slow hole stands out from its neighbours. Each hole is also pulled toward the par
 * split of roundMinutes by PRIOR_ROUNDS rounds' worth, so a few reports don't swing it.
 * rounds: [{ startHole, roundHoles, teedOffAt?, finishedAt?, reports: [{ hole, stage, reportedAt }] }]
 * Returns { holeSeconds (18, hole 1 first), rounds (how many rounds added any time), roundsPerHole (18; how much
 * of each hole was covered, in rounds) }.
 */
export function learnHoleSeconds(rounds, roundMinutes = DEFAULT_ROUND_MINUTES) {
  const prior = perHoleMinutes(roundMinutes)
  const segments = [] // { cover: [[holeIndex, fraction of the hole]], minutes }
  let used = 0

  for (const r of rounds) {
    const plan = roundPlan(r, roundMinutes)
    const total = planTotal(plan)
    const points = []
    if (r.teedOffAt) points.push({ offset: 0, at: asDate(r.teedOffAt) })
    for (const rep of r.reports || []) {
      const offset = planOffset(plan, rep.hole, rep.stage)
      if (offset != null && rep.reportedAt) points.push({ offset, at: asDate(rep.reportedAt) })
    }
    if (r.finishedAt) points.push({ offset: total, at: asDate(r.finishedAt) })
    points.sort((a, b) => a.at - b.at)

    let added = false
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]
      const to = points[i]
      const span = to.offset - from.offset
      const elapsed = minutesBetween(from.at, to.at)
      if (span < 1 || elapsed <= 0) continue // same spot, or a report that went backwards
      const ratio = elapsed / span
      if (ratio < MIN_SEGMENT_RATIO || ratio > MAX_SEGMENT_RATIO) continue
      const cover = plan
        .map(e => [e.hole - 1, (Math.min(e.end, to.offset) - Math.max(e.start, from.offset)) / (e.end - e.start)])
        .filter(([, fraction]) => fraction > 0)
      segments.push({ cover, minutes: elapsed })
      added = true
    }
    if (added) used++
  }

  // How much of each hole the stretches cover, in rounds
  const coverage = prior.map(() => 0)
  for (const s of segments) for (const [h, f] of s.cover) coverage[h] += f

  let estimate = [...prior]
  for (let pass = 0; pass < FIT_ITERATIONS; pass++) {
    const got = prior.map(() => 0)
    for (const s of segments) {
      const predicted = s.cover.reduce((sum, [h, f]) => sum + f * estimate[h], 0)
      for (const [h, f] of s.cover) got[h] += s.minutes * (f * estimate[h]) / predicted
    }
    estimate = prior.map((p, h) => (got[h] + PRIOR_ROUNDS * p) / (coverage[h] + PRIOR_ROUNDS))
  }

  return {
    holeSeconds: estimate.map(m => Math.round(m * 60)),
    rounds: used,
    roundsPerHole: coverage.map(c => Math.round(c * 10) / 10),
  }
}

/**
 * Map of cart number → group name for carts still out, except one booking's. A group that's marked finished, or
 * past its last green by the estimate, has brought its carts back.
 */
export function cartsInUse(groups, exceptBookingId = null) {
  const carts = new Map()
  for (const { booking, track } of groups) {
    if (booking.id === exceptBookingId || track.state === 'FINISHED' || track.state === 'DONE') continue
    for (const c of booking.cartNumbers || []) carts.set(c, booking.name)
  }
  return carts
}

/**
 * Course-wide pace from the groups' trackGroup() results:
 * { groupsOut, deltaMinutes (average of recent reports; null without any), reportedGroups,
 *   firstTeeLateMinutes (average tee-off delay of recent starts; null without any) }
 */
export function coursePace(tracks, now = new Date()) {
  const out = tracks.filter(t => t.state === 'ON_COURSE')
  const reported = out.filter(t => t.basis === 'REPORTED' && t.reportedMinutesAgo <= RECENT_REPORT_MINUTES)
  const recentStarts = tracks.filter(t => t.teedOffAt && minutesBetween(t.teedOffAt, now) <= RECENT_TEE_OFF_MINUTES)
  const average = list => (list.length ? Math.round(list.reduce((s, x) => s + x, 0) / list.length) : null)
  return {
    groupsOut: out.length,
    deltaMinutes: average(reported.map(t => t.deltaMinutes)),
    reportedGroups: reported.length,
    firstTeeLateMinutes: average(recentStarts.map(t => minutesBetween(t.teeTime, t.teedOffAt))),
  }
}

/**
 * For each track, how many empty holes lie between the group and the next group ahead of it on the course
 * (null when it's the lead group or not on the course). Holes are compared in 1–18 order, so a group that started
 * on 10 and has turned to the front nine is compared with the groups there.
 */
export function openHolesAhead(tracks) {
  const position = t => t.hole + (STAGES.findIndex(s => s.value === t.stage) / STAGES.length)
  const out = tracks.filter(t => t.state === 'ON_COURSE')
  return tracks.map(t => {
    if (t.state !== 'ON_COURSE') return null
    const ahead = out.filter(o => o !== t && position(o) > position(t))
    if (!ahead.length) return null
    const next = Math.min(...ahead.map(o => o.hole))
    return Math.max(0, next - t.hole - 1)
  })
}
