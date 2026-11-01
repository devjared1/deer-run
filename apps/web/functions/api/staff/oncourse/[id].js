import { json } from '../../admin/_auth.js'
import { requireCourse } from '../_auth.js'
import { localDate } from '../../../../src/lib/timeclock.js'
import { holeOrder, stagesFor } from '../../../../src/lib/pace.js'
import { serializeBooking, TEESHEET_BOOKING_COLUMNS } from '../teesheet/index.js'
import { dropStalePosition, parseRoundSetup } from '../_oncourse.js'

const BOOKING_SELECT = `${TEESHEET_BOOKING_COLUMNS}, slot:TeeTimeSlot(id, date, startTime), ` +
  'user:User(id, name, email, role, memberUntil, membershipTier), saleItems:SaleItem(sale:Sale!SaleItem_saleId_fkey(id, number))'

const ACTIONS = ['setup', 'tee_off', 'undo_tee_off', 'position', 'finish', 'undo_finish']

// POST /api/staff/oncourse/:bookingId — on-course tracking for a checked-in (paid) group. Times are server time.
//   setup        { cartNumbers?: string[], ownCart?, startHole?: 1 | 10, roundHoles?: 9 | 18 } — any day; a reported
//                position that's no longer on the round is cleared
//   tee_off      the group just teed off (keeps the first time if pressed twice)
//   undo_tee_off clears the tee-off and the reported position, and deletes the group's position reports
//   position     { hole, stage: 'TEE' | 'FAIRWAY' | 'GREEN' } — where the group is now: the latest goes on the booking,
//                and every report is kept in PositionReport (one within 3 minutes of the last replaces it as a
//                correction). The hole must be on the group's round and the stage on that hole (no fairway on a par 3)
//   finish       the group is done (off the 18th / 9th green); undo_finish puts it back on the course
// tee_off, position and finish are for today's tee times only, and not once the group is marked finished.
// Register staff and CourseSettings.coursePositions (requireCourse). Returns the booking (with `slot`).
export async function onRequestPost({ request, env, params }) {
  const result = await requireCourse(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!ACTIONS.includes(body?.action)) return json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, 400)

  const { data: booking, error } = await supabase.from('Booking').select(BOOKING_SELECT).eq('id', params.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!booking) return json({ error: 'Booking not found' }, 404)
  if (booking.status !== 'CONFIRMED') return json({ error: `This booking is ${booking.status.toLowerCase()}` }, 409)
  if (!booking.checkedInAt) return json({ error: "This group isn't checked in yet. Check them in on the tee sheet first." }, 409)

  const today = localDate()
  const now = new Date().toISOString()
  let update
  if (body.action === 'setup') {
    const setup = parseRoundSetup(body)
    if (setup.error) return json({ error: setup.error }, 400)
    update = dropStalePosition(booking, setup.fields)
  } else if (body.action === 'undo_tee_off') {
    update = { teedOffAt: null, positionHole: null, positionStage: null, positionAt: null }
  } else if (body.action === 'undo_finish') {
    update = { finishedAt: null }
  } else {
    if (booking.slot.date !== today) return json({ error: "Only today's groups can be updated on the course" }, 409)
    if (booking.finishedAt) return json({ error: 'This group is marked finished. Undo that first.' }, 409)
    if (body.action === 'tee_off') {
      update = booking.teedOffAt ? {} : { teedOffAt: now }
    } else if (body.action === 'finish') {
      update = { finishedAt: now }
    } else {
      const hole = Number(body.hole)
      if (!holeOrder(booking.startHole, booking.roundHoles).includes(hole)) {
        return json({ error: `Hole ${body.hole} isn't on this group's ${booking.roundHoles}-hole round` }, 400)
      }
      if (!stagesFor(hole).some(s => s.value === body.stage)) {
        return json({ error: `stage must be one of: ${stagesFor(hole).map(s => s.value).join(', ')}` }, 400)
      }
      update = { positionHole: hole, positionStage: body.stage, positionAt: now }
    }
  }

  if (Object.keys(update).length) {
    const { error: updateError } = await supabase.from('Booking').update(update).eq('id', booking.id)
    if (updateError) return json({ error: updateError.message }, 500)
  }

  // The history the per-hole times are learned from. An undone tee-off was a mistake, so its reports go too.
  if (body.action === 'position') {
    const saved = await saveReport(supabase, booking.id, result.employee.id, update)
    if (saved) return saved
  } else if (body.action === 'undo_tee_off') {
    const { error: deleteError } = await supabase.from('PositionReport').delete().eq('bookingId', booking.id)
    if (deleteError) return json({ error: deleteError.message }, 500)
  }

  const { data: fresh } = await supabase.from('Booking').select(BOOKING_SELECT).eq('id', booking.id).single()
  return json({ ...serializeBooking(fresh, today), slot: fresh.slot })
}

// A report this soon after the group's previous one is a correction (wrong hole tapped) and replaces it
const CORRECTION_MINUTES = 3

// Adds the report to PositionReport (replacing a correction). Returns an error Response or null.
async function saveReport(supabase, bookingId, employeeId, { positionHole, positionStage, positionAt }) {
  const since = new Date(new Date(positionAt).getTime() - CORRECTION_MINUTES * 60_000).toISOString()
  const { error: deleteError } = await supabase.from('PositionReport').delete()
    .eq('bookingId', bookingId).gte('reportedAt', since)
  if (deleteError) return json({ error: deleteError.message }, 500)
  const { error } = await supabase.from('PositionReport').insert({
    id: crypto.randomUUID(), bookingId, hole: positionHole, stage: positionStage, reportedAt: positionAt, employeeId,
  })
  return error ? json({ error: error.message }, 500) : null
}
