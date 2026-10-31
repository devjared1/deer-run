import { requireAdmin, json } from '../_auth.js'
import { ENTRY_SELECT, serializeEntry } from '../../staff/_timesheet.js'
import { parseEntryInput, findOverlap, replaceBreaks, writeErrorMessage } from './_validate.js'

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

  const id = crypto.randomUUID()
  const { error } = await supabase.from('TimeEntry').insert({
    id,
    employeeId: employee.id,
    ...entry,
    editedById: dbUser.id,
    editedAt: new Date().toISOString(),
  })
  if (error) return json({ error: writeErrorMessage(error) }, error.code === '23505' ? 409 : 500)

  const breakError = await replaceBreaks(supabase, id, breaks)
  if (breakError) return json({ error: breakError }, 500)

  const { data: saved } = await supabase.from('TimeEntry').select(ENTRY_SELECT).eq('id', id).single()
  return json(serializeEntry(saved), 201)
}
