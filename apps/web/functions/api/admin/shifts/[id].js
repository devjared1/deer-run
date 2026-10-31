import { requireAdmin, json } from '../_auth.js'
import { parseShift, SHIFT_COLUMNS } from './_validate.js'

// PUT /api/admin/shifts/:id — any of { employeeId, date, startTime, endTime, position, notes }
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: update, error: validationError } = parseShift(body, { partial: true })
  if (validationError) return json({ error: validationError }, 400)
  if (!Object.keys(update).length) return json({ error: 'No fields to update' }, 400)

  const { data: existing } = await supabase.from('Shift').select(SHIFT_COLUMNS).eq('id', params.id).maybeSingle()
  if (!existing) return json({ error: 'Shift not found' }, 404)

  // Check start ≠ end against the stored value when only one of them changes
  const startTime = update.startTime ?? existing.startTime
  const endTime = update.endTime ?? existing.endTime
  if (startTime === endTime) {
    return json({ error: "A shift can't start and end at the same time" }, 400)
  }

  if (update.employeeId) {
    const { data: employee } = await supabase.from('Employee').select('id').eq('id', update.employeeId).maybeSingle()
    if (!employee) return json({ error: 'Employee not found' }, 404)
  }

  const { data, error } = await supabase
    .from('Shift')
    .update(update)
    .eq('id', params.id)
    .select(SHIFT_COLUMNS)
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'Shift not found' }, 404)

  return json(data)
}

// DELETE /api/admin/shifts/:id
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase.from('Shift').delete().eq('id', params.id).select('id')
  if (error) return json({ error: error.message }, 500)
  if (!data?.length) return json({ error: 'Shift not found' }, 404)

  return json({ success: true })
}
