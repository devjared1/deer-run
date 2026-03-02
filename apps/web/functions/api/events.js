import { createClient } from '@supabase/supabase-js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url)
  const pastParam = searchParams.get('past')

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  let query = supabase.from('TournamentEvent').select('*').order('eventDate')

  if (pastParam === 'true') {
    query = query.eq('past', true)
  } else if (pastParam === 'false') {
    query = query.eq('past', false)
  }

  const { data, error } = await query

  if (error) return json({ error: error.message }, 500)

  return json(data)
}
