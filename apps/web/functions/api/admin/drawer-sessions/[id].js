import { requireAdmin, json } from '../_auth.js'
import { closeDrawer } from '../../staff/_drawer.js'

// POST /api/admin/drawer-sessions/:id — { action: 'close', countedCents, note }
// Closes a drawer from the admin panel (e.g. the register PC is down or someone forgot). Needs an employee
// record for the admin, since closedBy is an employee.
export async function onRequestPost({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (body?.action !== 'close') return json({ error: "action must be 'close'" }, 400)

  const { data: employee } = await supabase.from('Employee').select('id').eq('userId', dbUser.id).maybeSingle()
  if (!employee) return json({ error: 'Your login needs an employee record to close a drawer (Admin → Employees)' }, 403)

  const outcome = await closeDrawer(supabase, params.id, {
    employeeId: employee.id,
    countedCents: body.countedCents,
    closeNote: body.note ? `${body.note} (closed from the admin panel)` : 'Closed from the admin panel',
  })
  if (outcome.error) return json({ error: outcome.error }, outcome.status)
  return json({ session: outcome.session })
}
