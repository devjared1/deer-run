import { requireAdmin, json } from '../_auth.js'
import { ENTRY_SELECT, serializeEntry } from '../../staff/_timesheet.js'
import { parseEntryInput, findOverlap, replaceBreaks, writeErrorMessage } from './_validate.js'

// PUT /api/admin/time-entries/:id — manager corrects an entry (replaces times, breaks and note)
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: existing } = await supabase
    .from('TimeEntry')
    .select('id, employeeId')
    .eq('id', params.id)
    .maybeSingle()
  if (!existing) return json({ error: 'Time entry not found' }, 404)

  const { entry, breaks, error: validationError } = parseEntryInput(body)
  if (validationError) return json({ error: validationError }, 400)

  const overlap = await findOverlap(supabase, existing.employeeId, entry, existing.id)
  if (overlap) return json({ error: overlap }, 409)

  const { error } = await supabase
    .from('TimeEntry')
    .update({ ...entry, editedById: dbUser.id, editedAt: new Date().toISOString() })
    .eq('id', existing.id)
  if (error) return json({ error: writeErrorMessage(error) }, error.code === '23505' ? 409 : 500)

  const breakError = await replaceBreaks(supabase, existing.id, breaks)
  if (breakError) return json({ error: breakError }, 500)

  const { data: saved } = await supabase.from('TimeEntry').select(ENTRY_SELECT).eq('id', existing.id).single()
  return json(serializeEntry(saved))
}

// DELETE /api/admin/time-entries/:id — removes the entry and its breaks
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase.from('TimeEntry').delete().eq('id', params.id).select('id')
  if (error) return json({ error: error.message }, 500)
  if (!data?.length) return json({ error: 'Time entry not found' }, 404)

  return json({ success: true })
}
