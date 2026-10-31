import { requireAdmin, json } from '../_auth.js'
import { parseRegister, registerErrorResponse } from './_validate.js'

// PUT /api/admin/registers/:id
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: update, error: validationError } = parseRegister(body, { partial: true })
  if (validationError) return json({ error: validationError }, 400)
  if (!Object.keys(update).length) return json({ error: 'No fields to update' }, 400)

  const { data, error } = await result.supabase
    .from('Register')
    .update(update)
    .eq('id', params.id)
    .select('id, name, stripeReaderId, active, createdAt')
    .maybeSingle()
  if (error) return registerErrorResponse(error)
  if (!data) return json({ error: 'Register not found' }, 404)

  return json(data)
}

// DELETE /api/admin/registers/:id — only when it has no sales
export async function onRequestDelete({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result

  const { data, error } = await result.supabase.from('Register').delete().eq('id', params.id).select('id')
  if (error) return registerErrorResponse(error)
  if (!data?.length) return json({ error: 'Register not found' }, 404)

  return json({ success: true })
}
