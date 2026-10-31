import { json } from '../_auth.js'

/** Validates a category payload; with partial = true only fields present are checked. */
export function parseCategory(body, { partial = false } = {}) {
  const data = {}
  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? '').trim()
    if (!name) return { error: 'name is required' }
    data.name = name
  }
  if (body.taxExempt !== undefined) data.taxExempt = Boolean(body.taxExempt)
  // Members get their Pro Shop discount in this category (src/lib/pricing.js)
  if (body.memberDiscount !== undefined) data.memberDiscount = Boolean(body.memberDiscount)
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder)
    if (!Number.isInteger(n)) return { error: 'sortOrder must be a whole number' }
    data.sortOrder = n
  }
  return { data }
}

export function categoryErrorResponse(error) {
  if (error.code === '23505') return json({ error: 'A category with that name already exists' }, 409)
  if (error.code === '23503') return json({ error: 'This category still has products. Move or delete them first, or deactivate the category.' }, 409)
  return json({ error: error.message }, 500)
}
