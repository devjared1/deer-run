import { requireAdmin, json } from '../_auth.js'
import { ENTRY_SELECT, serializeEntry } from '../../staff/_timesheet.js'
import { parseEntryInput, findOverlap, saveTimeEntry } from './_validate.js'

// POST /api/admin/time-entries — manager adds an entry (e.g. a missed punch)
// Body: { employeeId, date, clockIn, clockOut, breaks, note } — see parseEntryInput
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: employee } = await supabase
    .from('Employee')
    .select('id')
    .eq('id', body.employeeId ?? '')
    .maybeSingle()
  if (!employee) return json({ error: 'Employee not found' }, 404)

  const { entry, breaks, error: validationError } = parseEntryInput(body)
  if (validationError) return json({ error: validationError }, 400)

  const overlap = await findOverlap(supabase, employee.id, entry)
  if (overlap) return json({ error: overlap }, 409)

  // Entry + breaks in one transaction
  const { id, error, status } = await saveTimeEntry(supabase, {
    employeeId: employee.id,
    editedById: dbUser.id,
    entry,
    breaks,
  })
  if (error) return json({ error }, status)

  const { data: saved } = await supabase.from('TimeEntry').select(ENTRY_SELECT).eq('id', id).single()
  return json(serializeEntry(saved), 201)
}
