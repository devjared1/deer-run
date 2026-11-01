import { requireCourse } from '../_auth.js'
import { localDate } from '../../../../src/lib/timeclock.js'
import { loadTeeSheet } from '../teesheet/index.js'

// GET /api/staff/oncourse
// Today's tee sheet (same shape as GET /api/staff/teesheet: { date, today, roundMinutes, slots }) for the On Course
// page, which works out from the checked-in bookings where each group is (src/lib/pace.js), and from the open
// slots when a walk-in would go off. Register staff and CourseSettings.coursePositions (requireCourse).
export async function onRequestGet(context) {
  const result = await requireCourse(context.request, context.env)
  if (result instanceof Response) return result
  return loadTeeSheet(context, result.supabase, localDate())
}
