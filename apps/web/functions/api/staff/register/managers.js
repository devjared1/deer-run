import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'

// GET /api/staff/register/managers — managers who can approve at the register (have a PIN set)
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { data: settings } = await supabase.from('CourseSettings').select('managerPositions').eq('id', 'singleton').maybeSingle()
  const positions = settings?.managerPositions ?? []
  if (!positions.length) return json([])

  const { data, error } = await supabase
    .from('Employee')
    .select('id, firstName, lastName')
    .eq('active', true)
    .in('position', positions)
    .not('managerPinHash', 'is', null)
    .order('firstName', { ascending: true })
  if (error) return json({ error: error.message }, 500)

  return json(data || [])
}
