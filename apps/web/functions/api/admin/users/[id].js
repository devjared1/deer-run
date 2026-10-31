import { requireAdmin, json } from '../_auth.js'
import { isValidYmd } from '../../../../src/lib/timeclock.js'
import { MEMBERSHIP_TIERS } from '../products/_validate.js'

// PUT /api/admin/users/:id — { role?, memberUntil?, membershipTier? }
// memberUntil is the last day of membership ("YYYY-MM-DD", or null for no expiry); a member whose date has
// passed drops to GUEST. Admins can't change their own role.
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser: adminUser } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const update = {}
  if (body.role !== undefined) {
    if (!['GUEST', 'MEMBER', 'ADMIN'].includes(body.role)) return json({ error: 'role must be GUEST, MEMBER, or ADMIN' }, 400)
    if (params.id === adminUser.id && body.role !== adminUser.role) return json({ error: 'Cannot change your own role' }, 400)
    update.role = body.role
  }
  if (body.memberUntil !== undefined) {
    if (body.memberUntil !== null && body.memberUntil !== '' && !isValidYmd(body.memberUntil)) {
      return json({ error: 'Member until must be a date (YYYY-MM-DD)' }, 400)
    }
    update.memberUntil = body.memberUntil || null
    update.renewalReminderKey = null // a new end date gets its own reminders
  }
  if (body.membershipTier !== undefined) {
    const tier = body.membershipTier || null
    if (tier && !MEMBERSHIP_TIERS.includes(tier)) return json({ error: `Tier must be one of ${MEMBERSHIP_TIERS.join(', ')}` }, 400)
    update.membershipTier = tier
  }
  if (!Object.keys(update).length) return json({ error: 'Nothing to update' }, 400)

  const { data, error } = await supabase
    .from('User')
    .update(update)
    .eq('id', params.id)
    .select('id, email, name, role, memberUntil, membershipTier')
    .maybeSingle()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'User not found' }, 404)

  return json(data)
}
