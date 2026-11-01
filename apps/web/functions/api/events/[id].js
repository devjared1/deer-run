import { createClient } from '@supabase/supabase-js'

// GET /api/events/:id — one public TournamentEvent (same columns as GET /api/events) → the event object,
// or 404 { error: 'Event not found' }.

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestGet({ env, params }) {
  const id = String(params.id ?? '')
  if (!id || id.length > 64) return json({ error: 'Event not found' }, 404)

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase.from('TournamentEvent').select('*').eq('id', id).maybeSingle()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'Event not found' }, 404)

  return json(data)
}
