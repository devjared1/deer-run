import { createClient } from '@supabase/supabase-js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestGet({ request, env }) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401)
  }

  const token = authHeader.slice(7)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authUser) {
    return json({ error: 'Token verification failed' }, 401)
  }

  // Return existing user or create on first login
  const { data: existing } = await supabase
    .from('User')
    .select('*')
    .eq('supabaseId', authUser.id)
    .maybeSingle()

  if (existing) return json(existing)

  const { data: created, error: dbError } = await supabase
    .from('User')
    .insert({ id: crypto.randomUUID(), supabaseId: authUser.id, email: authUser.email, role: 'MEMBER' })
    .select()
    .single()

  if (dbError) return json({ error: dbError.message }, 500)

  return json(created)
}
