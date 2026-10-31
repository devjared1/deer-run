import { createClient } from '@supabase/supabase-js'
import { registerAccess } from '../staff/_auth.js'

function json(data, status = 200) {
  return Response.json(data, { status })
}

const EMPLOYEE_FIELDS = 'id, firstName, lastName, position, active'

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
  let { data: user } = await supabase
    .from('User')
    .select('*')
    .eq('supabaseId', authUser.id)
    .maybeSingle()

  if (!user) {
    const { data: created, error: dbError } = await supabase
      .from('User')
      .insert({ id: crypto.randomUUID(), supabaseId: authUser.id, email: authUser.email, role: 'MEMBER' })
      .select()
      .single()

    if (dbError) return json({ error: dbError.message }, 500)
    user = created

    // If an admin already added this person as an employee, link the new login to that record
    await supabase
      .from('Employee')
      .update({ userId: user.id })
      .eq('email', user.email.toLowerCase())
      .is('userId', null)
  }

  // Linked employee record (null for non-staff); the frontend uses it to show the staff portal
  const { data: employee } = await supabase
    .from('Employee')
    .select(EMPLOYEE_FIELDS)
    .eq('userId', user.id)
    .maybeSingle()

  return json({
    ...user,
    employee: employee ?? null,
    ...(employee ? await registerAccess(supabase, user, employee) : { canUseRegister: false, isRegisterManager: false }),
  })
}
