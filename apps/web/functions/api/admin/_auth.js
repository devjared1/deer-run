import { createClient } from '@supabase/supabase-js'

export function json(data, status = 200) {
  return Response.json(data, { status })
}

export function makeSupabase(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

/** Returns { supabase, dbUser } if admin, or a 401/403 Response if not. */
export async function requireAdmin(request, env) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = makeSupabase(env)
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7))
  if (error || !user) return json({ error: 'Unauthorized' }, 401)

  const { data: dbUser } = await supabase.from('User').select('*').eq('supabaseId', user.id).maybeSingle()
  if (!dbUser || dbUser.role !== 'ADMIN') return json({ error: 'Forbidden' }, 403)

  return { supabase, dbUser }
}
