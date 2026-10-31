import { requireAdmin, json } from '../_auth.js'
import {
  parseEmployee, findUserIdByEmail, constraintMessage, serializeEmployee, EMPLOYEE_COLUMNS, POSITIONS,
} from './_validate.js'

// GET /api/admin/employees?search=&position=&status=active|inactive|all
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { searchParams } = new URL(request.url)
  const search   = searchParams.get('search')
  const position = searchParams.get('position')
  const status   = searchParams.get('status') || 'active'

  let query = supabase
    .from('Employee')
    .select(EMPLOYEE_COLUMNS)
    .order('lastName', { ascending: true })
    .order('firstName', { ascending: true })

  if (status === 'active')   query = query.eq('active', true)
  if (status === 'inactive') query = query.eq('active', false)
  if (position && POSITIONS.includes(position)) query = query.eq('position', position)
  if (search) {
    // Strip characters that have meaning in PostgREST filter syntax
    const term = search.replace(/[,()*%]/g, ' ').trim()
    if (term) query = query.or(`firstName.ilike.%${term}%,lastName.ilike.%${term}%,email.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)

  return json((data || []).map(serializeEmployee))
}

// POST /api/admin/employees — create employee
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

  const { data: fields, error: validationError } = parseEmployee(body)
  if (validationError) return json({ error: validationError }, 400)

  const { data, error } = await supabase
    .from('Employee')
    .insert({
      id: crypto.randomUUID(),
      ...fields,
      userId: await findUserIdByEmail(supabase, fields.email),
    })
    .select(EMPLOYEE_COLUMNS)
    .single()

  if (error) {
    const message = constraintMessage(error)
    return message ? json({ error: message }, 409) : json({ error: error.message }, 500)
  }

  return json(serializeEmployee(data), 201)
}
