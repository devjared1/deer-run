import { requireAdmin, json } from '../_auth.js'
import { parseRegister, registerErrorResponse } from './_validate.js'

// GET /api/admin/registers
export async function onRequestGet({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  const { data, error } = await result.supabase
    .from('Register')
    .select('id, name, stripeReaderId, active, createdAt')
    .order('name', { ascending: true })
  if (error) return json({ error: error.message }, 500)

  return json(data || [])
}

// POST /api/admin/registers — { name, stripeReaderId?, active? }
export async function onRequestPost({ request, env }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: fields, error: validationError } = parseRegister(body)
  if (validationError) return json({ error: validationError }, 400)

  const { data, error } = await result.supabase
    .from('Register')
    .insert({ id: crypto.randomUUID(), ...fields })
    .select('id, name, stripeReaderId, active, createdAt')
    .single()
  if (error) return registerErrorResponse(error)

  return json(data, 201)
}
