import { authenticate, json, makeSupabase } from '../admin/_auth.js'
import { verifyLinkToken } from '../_links.js'

/**
 * The golfer's own booking, for the endpoints a golfer uses to manage it (change, cancel, the manage page): either the
 * signed-in owner (bearer token), or anyone with the signed link from the booking's emails (`token`, the ?t= of
 * /booking/<id>). Returns { supabase, booking, userId (who's acting, or null via a link), viaLink } or an error Response.
 */
export async function golferBooking(request, env, id, select, token = null) {
  if (token) {
    if (!await verifyLinkToken(env, 'booking', id, token)) {
      return json({ error: 'This link isn\'t valid. Use the link in your booking email, or call the pro shop.', code: 'BAD_LINK' }, 403)
    }
    const supabase = makeSupabase(env)
    const { data: booking, error } = await supabase.from('Booking').select(select).eq('id', id).maybeSingle()
    if (error) return json({ error: error.message }, 500)
    if (!booking) return json({ error: 'Booking not found' }, 404)
    return { supabase, booking, userId: null, viaLink: true }
  }

  const result = await authenticate(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result
  const { data: booking, error } = await supabase.from('Booking').select(select).eq('id', id).eq('userId', dbUser.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!booking) return json({ error: 'Booking not found' }, 404)
  return { supabase, booking, userId: dbUser.id, dbUser, viaLink: false }
}

/** The ?t= link token from the URL (or a JSON body's `t`). */
export function linkTokenFrom(request, body = null) {
  return new URL(request.url).searchParams.get('t') || (typeof body?.t === 'string' ? body.t : null)
}
