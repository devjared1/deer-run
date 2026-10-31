// Must match the EmployeePosition enum in apps/api/prisma/schema.prisma
export const employeePositions = [
  { value: 'GENERAL_MANAGER',             label: 'General Manager',             department: 'Management' },
  { value: 'HEAD_GOLF_PROFESSIONAL',      label: 'Head Golf Professional',      department: 'Golf Operations' },
  { value: 'ASSISTANT_GOLF_PROFESSIONAL', label: 'Assistant Golf Professional', department: 'Golf Operations' },
  { value: 'PRO_SHOP_ATTENDANT',          label: 'Pro Shop Attendant',          department: 'Golf Operations' },
  { value: 'STARTER',                     label: 'Starter',                     department: 'Golf Operations' },
  { value: 'PLAYER_ASSISTANT',            label: 'Player Assistant / Marshal',  department: 'Golf Operations' },
  { value: 'OUTSIDE_SERVICES',            label: 'Outside Services (Cart & Range)', department: 'Golf Operations' },
  { value: 'SUPERINTENDENT',              label: 'Golf Course Superintendent',  department: 'Course Maintenance' },
  { value: 'ASSISTANT_SUPERINTENDENT',    label: 'Assistant Superintendent',    department: 'Course Maintenance' },
  { value: 'GROUNDS_CREW',                label: 'Grounds Crew',                department: 'Course Maintenance' },
  { value: 'EQUIPMENT_TECHNICIAN',        label: 'Equipment Technician',        department: 'Course Maintenance' },
  { value: 'FOOD_BEVERAGE_MANAGER',       label: 'Food & Beverage Manager',     department: 'Food & Beverage' },
  { value: 'COOK',                        label: 'Cook',                        department: 'Food & Beverage' },
  { value: 'SERVER',                      label: 'Server / Bartender',          department: 'Food & Beverage' },
  { value: 'BEVERAGE_CART_ATTENDANT',     label: 'Beverage Cart Attendant',     department: 'Food & Beverage' },
]

export const departments = [...new Set(employeePositions.map(p => p.department))]

export function positionLabel(value) {
  return employeePositions.find(p => p.value === value)?.label ?? value
}
