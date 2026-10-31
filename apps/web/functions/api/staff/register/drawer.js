import { json } from '../../admin/_auth.js'
import { requireRegister } from '../_auth.js'
import {
  openSession, withRunningTotals, openDrawer, closeDrawer, recordMovement, sessionMovements, SESSION_SELECT, serializeSession,
} from '../_drawer.js'

// GET /api/staff/register/drawer?registerId=
// The register's open drawer session (or null) and the last closed one. The open session lists its paid-ins,
// paid-outs and safe drops (session.movements). Its running totals and expected cash are only included for
// register managers: cashiers count blind when they close.
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
    else if (session) session = { ...session, movements: await sessionMovements(supabase, session.id) }
    return json({ session, last: lastRes.data?.[0] ? serializeSession(lastRes.data[0]) : null })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/staff/register/drawer
//   { action: 'open', registerId, floatCents, note? }        start the drawer with a counted float
//   { action: 'close', sessionId, countedCents, note? }      close with the counted cash → expected, over/short
//   { action: 'movement', registerId, type, amountCents, reason?, recipient?, approvalId }
//       type PAID_IN | PAID_OUT | SAFE_DROP on the open drawer (409 DRAWER_CLOSED if none). Each needs a manager
//       approval for the same action (POST /api/staff/approvals); paid-outs need a reason. → 201 { movement }
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
  } else if (body?.action === 'movement') {
    const { data: register } = await supabase.from('Register').select('id, active').eq('id', body.registerId ?? '').maybeSingle()
    if (!register?.active) return json({ error: 'Choose a register' }, 400)
    const movement = await recordMovement(supabase, {
      registerId: register.id,
      employeeId: employee.id,
      type: body.type,
      amountCents: body.amountCents,
      reason: body.reason,
      recipient: body.recipient,
      approvalId: body.approvalId,
    })
    if (movement.error) return json({ error: movement.error, ...(movement.code ? { code: movement.code } : {}) }, movement.status)
    return json({ movement: movement.movement }, 201)
  } else {
    return json({ error: "action must be 'open', 'close' or 'movement'" }, 400)
  }

  if (outcome.error) return json({ error: outcome.error }, outcome.status)
  return json({ session: outcome.session }, body.action === 'open' ? 201 : 200)
}
