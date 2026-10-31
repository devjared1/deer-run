import { employeePositions, positionLabel } from '@/data/employeePositions'
import { shiftMinutes, timeOffCovers } from '@/lib/schedule'

// Shift chip colors by department (screen and print)
const DEPARTMENT_CLASSES = {
  'Management':         'bg-pine/15 border-pine/40 text-pine',
  'Golf Operations':    'bg-lake/15 border-lake/40 text-lake-dark',
  'Course Maintenance': 'bg-amber/20 border-amber/50 text-bark',
  'Food & Beverage':    'bg-clay/15 border-clay/40 text-clay-dark',
}

export function departmentOf(position) {
  return employeePositions.find(p => p.value === position)?.department ?? null
}

/** The position a shift is worked as: its override, else the employee's position. */
export function shiftPosition(shift, employee) {
  return shift.position || employee?.position || null
}

export function shiftClasses(shift, employee) {
  return DEPARTMENT_CLASSES[departmentOf(shiftPosition(shift, employee))] ?? 'bg-gray-100 border-gray-300 text-gray-700'
}

export const TIME_OFF_LABELS = { VACATION: 'Vacation', SICK: 'Sick', PERSONAL: 'Personal', UNPAID: 'Unpaid' }

/** Label for a time off request on a day ("Off", "Off · Vacation", "Requested off"). */
export function timeOffLabel(request) {
  if (request.status === 'PENDING') return 'Requested off'
  return request.type ? `Off · ${TIME_OFF_LABELS[request.type] ?? request.type}` : 'Off'
}

export function timeOffOn(timeOff, employeeId, date) {
  return timeOff.find(r => r.employeeId === employeeId && timeOffCovers(r, date)) ?? null
}

export function totalHours(shifts) {
  const minutes = shifts.reduce((sum, s) => sum + shiftMinutes(s), 0)
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

export { positionLabel }
