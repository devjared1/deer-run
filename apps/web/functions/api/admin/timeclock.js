import { requireAdmin, json } from './_auth.js'
import { ENTRY_SELECT, serializeEntry } from '../staff/_timesheet.js'

// GET /api/admin/timeclock — who is on the clock right now (for the dashboard)
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data, error } = await supabase
    .from('TimeEntry')
    .select(`${ENTRY_SELECT}, employee:Employee(id, firstName, lastName, position)`)
    .is('clockOut', null)
    .order('clockIn', { ascending: true })

  if (error) return json({ error: error.message }, 500)

  const now = new Date()
  return json((data || []).map(raw => {
    const entry = serializeEntry(raw, now)
    return { ...entry, status: entry.breaks.some(b => !b.endedAt) ? 'break' : 'on' }
  }))
}
