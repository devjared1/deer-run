import { requireAdmin, json } from '../_auth.js'

// GET /api/admin/events?past=
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const past = searchParams.get('past')

  let query = supabase.from('TournamentEvent').select('*').order('eventDate', { ascending: false })
  if (past === 'true')  query = query.eq('past', true)
  if (past === 'false') query = query.eq('past', false)

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)

  return json(data || [])
}

// POST /api/admin/events — create event
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const body = await request.json()
  const { name, description, eventDate, startTime, format, entry, spotsTotal, memberOnly, featured, past } = body

  if (!name || !description || !eventDate || !startTime || !format) {
    return json({ error: 'name, description, eventDate, startTime, format are required' }, 400)
  }

  const { data, error } = await supabase
    .from('TournamentEvent')
    .insert({
      id: crypto.randomUUID(),
      name,
      description,
      eventDate: new Date(eventDate).toISOString(),
      startTime,
      format,
      entry: entry !== undefined ? Number(entry) : null,
      spotsTotal: spotsTotal !== undefined ? Number(spotsTotal) : null,
      memberOnly: Boolean(memberOnly),
      featured: Boolean(featured),
      past: Boolean(past),
    })
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  return json(data, 201)
}
