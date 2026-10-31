import { requireAdmin, json } from '../_auth.js'
import { fetchShifts } from './_validate.js'
import { isValidYmd, addDays, daysBetween } from '../../../../src/lib/timeclock.js'

// POST /api/admin/shifts/copy — { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', days?: 7 | 14 }
// Copies the shifts of the `days` days starting at `from` onto the same weekdays starting at `to`
// (e.g. last week into this week). Skips inactive employees and shifts that already exist
// (same employee, date, start and end), so running it twice doesn't duplicate anything.
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { from, to } = body || {}
  const days = body?.days ?? 7
  if (!isValidYmd(from) || !isValidYmd(to)) return json({ error: 'from and to must be YYYY-MM-DD' }, 400)
  if (![7, 14].includes(days)) return json({ error: 'days must be 7 or 14' }, 400)
  const shiftBy = daysBetween(from, to)
  if (shiftBy === 0) return json({ error: 'Choose a different week to copy into' }, 400)
  if (shiftBy % 7 !== 0) return json({ error: 'from and to must be the same day of the week' }, 400)

  try {
    const [source, target, employeesRes] = await Promise.all([
      fetchShifts(supabase, from, addDays(from, days - 1)),
      fetchShifts(supabase, to, addDays(to, days - 1)),
      supabase.from('Employee').select('id').eq('active', true),
    ])
    if (employeesRes.error) throw new Error(employeesRes.error.message)
    const active = new Set((employeesRes.data || []).map(e => e.id))

    const key = s => `${s.employeeId}|${s.date}|${s.startTime}|${s.endTime}`
    const existing = new Set(target.map(key))

    const rows = []
    let skippedInactive = 0
    let skippedExisting = 0
    for (const s of source) {
      if (!active.has(s.employeeId)) { skippedInactive++; continue }
      const row = {
        employeeId: s.employeeId,
        date: addDays(s.date, shiftBy),
        startTime: s.startTime,
        endTime: s.endTime,
        position: s.position,
        notes: s.notes,
      }
      if (existing.has(key(row))) { skippedExisting++; continue }
      existing.add(key(row))
      rows.push({ id: crypto.randomUUID(), ...row })
    }

    if (rows.length) {
      const { error } = await supabase.from('Shift').insert(rows)
      if (error) throw new Error(error.message)
    }

    return json({ created: rows.length, skippedInactive, skippedExisting })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
