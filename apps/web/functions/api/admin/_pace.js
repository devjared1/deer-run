import { fetchAll } from './_db.js'
import { DEFAULT_ROUND_MINUTES, LEARN_DAYS, learnHoleSeconds } from '../../../src/lib/pace.js'

/**
 * Learns per-hole times from the last LEARN_DAYS days of rounds (tee-offs, every PositionReport, finishes) and saves
 * them as CourseSettings.holeSeconds / holeTimesUpdatedAt / holeTimesRounds. Used by the daily job
 * (/api/internal/pace) and Admin → Settings → Recalculate (/api/admin/pace).
 * Returns { holeSeconds, rounds, roundsPerHole, updatedAt }. Throws on a database error.
 */
export async function recalculateHoleTimes(supabase) {
  const { data: settings, error } = await supabase.from('CourseSettings').select('roundMinutes').eq('id', 'singleton').single()
  if (error) throw new Error(error.message)

  const since = new Date(Date.now() - LEARN_DAYS * 86_400_000).toISOString()
  const bookings = await fetchAll(() => supabase
    .from('Booking')
    .select('id, startHole, roundHoles, teedOffAt, finishedAt, reports:PositionReport(hole, stage, reportedAt)')
    .eq('status', 'CONFIRMED')
    .gte('checkedInAt', since)
    .or('teedOffAt.not.is.null,positionAt.not.is.null')
    .order('id'))

  const learned = learnHoleSeconds(bookings, settings.roundMinutes ?? DEFAULT_ROUND_MINUTES)
  const updatedAt = new Date().toISOString()
  const { error: updateError } = await supabase.from('CourseSettings')
    .update({ holeSeconds: learned.holeSeconds, holeTimesRounds: learned.rounds, holeTimesUpdatedAt: updatedAt })
    .eq('id', 'singleton')
  if (updateError) throw new Error(updateError.message)
  return { ...learned, updatedAt }
}
