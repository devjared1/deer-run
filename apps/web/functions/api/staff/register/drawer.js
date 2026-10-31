import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import { openSession, withRunningTotals, openDrawer, closeDrawer, SESSION_SELECT, serializeSession } from '../_drawer.js'

// GET /api/staff/register/drawer?registerId=
// The register's open drawer session (or null) and the last closed one. The open session's expected
// cash is only included for register managers: cashiers count blind when they close.
export async function onRequestGet({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, isRegisterManager } = result

  const registerId = new URL(request.url).searchParams.get('registerId')
  if (!registerId) return json({ error: 'registerId is required' }, 400)

  try {
    const [current, lastRes] = await Promise.all([
      openSession(supabase, registerId),
      supabase.from('CashDrawerSession').select(SESSION_SELECT).eq('registerId', registerId)
        .not('closedAt', 'is', null).order('closedAt', { ascending: false }).limit(1),
    ])
    if (lastRes.error) throw new Error(lastRes.error.message)
    let session = current
    if (session && isRegisterManager) session = await withRunningTotals(supabase, session)
    return json({ session, last: lastRes.data?.[0] ? serializeSession(lastRes.data[0]) : null })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/staff/register/drawer
//   { action: 'open', registerId, floatCents, note? }        start the drawer with a counted float
//   { action: 'close', sessionId, countedCents, note? }      close with the counted cash → expected, over/short
export async function onRequestPost({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  let outcome
  if (body?.action === 'open') {
    const { data: register } = await supabase.from('Register').select('id, active').eq('id', body.registerId ?? '').maybeSingle()
    if (!register?.active) return json({ error: 'Choose a register' }, 400)
    outcome = await openDrawer(supabase, { registerId: register.id, employeeId: employee.id, floatCents: body.floatCents, openNote: body.note })
  } else if (body?.action === 'close') {
    outcome = await closeDrawer(supabase, String(body.sessionId ?? ''), { employeeId: employee.id, countedCents: body.countedCents, closeNote: body.note })
  } else {
    return json({ error: "action must be 'open' or 'close'" }, 400)
  }

  if (outcome.error) return json({ error: outcome.error }, outcome.status)
  return json({ session: outcome.session }, body.action === 'open' ? 201 : 200)
}
