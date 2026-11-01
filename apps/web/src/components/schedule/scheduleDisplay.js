import { employeePositions, departments, positionLabel } from '@/data/employeePositions'
import { shiftMinutes, timeOffCovers } from '@/lib/schedule'

// Shift chip colors by department (screen and print). Literal class strings so Tailwind generates them.
const DEPARTMENT_CLASSES = {
  'Management':         'bg-primary-container border-primary/40 text-on-primary-container',
  'Golf Operations':    'bg-secondary-container border-secondary/40 text-on-secondary-container',
  'Course Maintenance': 'bg-gold-container border-gold/50 text-on-gold-container',
  'Food & Beverage':    'bg-tertiary-container border-tertiary/40 text-on-tertiary-container',
}
const OTHER_CLASSES = 'bg-surface-container-highest border-outline-variant text-on-surface-variant'

// Time off on a day: dashed box; pending requests get the warning container (the label also says "Requested off")
export const TIME_OFF_CLASSES = {
  PENDING:  'border-dashed border-warning bg-warning-container text-on-warning-container',
  APPROVED: 'border-dashed border-outline bg-surface-container text-on-surface-variant',
}

export function departmentOf(position) {
  return employeePositions.find(p => p.value === position)?.department ?? null
}

/** Chip classes for a department ('' or unknown → neutral). */
export function departmentClasses(department) {
  return DEPARTMENT_CLASSES[department] ?? OTHER_CLASSES
}

/** Departments with their chip classes, for the legend. */
export const DEPARTMENT_LEGEND = departments.map(d => ({ department: d, classes: departmentClasses(d) }))

/** The position a shift is worked as: its override, else the employee's position. */
export function shiftPosition(shift, employee) {
  return shift.position || employee?.position || null
}

export function shiftClasses(shift, employee) {
  return departmentClasses(departmentOf(shiftPosition(shift, employee)))
}

export function timeOffClasses(request) {
  return request?.status === 'PENDING' ? TIME_OFF_CLASSES.PENDING : TIME_OFF_CLASSES.APPROVED
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

/** "7.5 hours" style length of one shift (no trailing zeros). */
export function shiftHoursText(shift) {
  return `${(shiftMinutes(shift) / 60).toFixed(2).replace(/\.?0+$/, '')}h`
}

export { positionLabel }
