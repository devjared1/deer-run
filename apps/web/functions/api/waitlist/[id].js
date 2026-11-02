import { json, makeSupabase } from '../admin/_auth.js'
import { verifyLinkToken } from '../_links.js'

// GET    /api/waitlist/:id?t=<token> → { id, date, players, notified, left }   (the leave link's page)
// DELETE /api/waitlist/:id?t=<token> → { left: true }  takes the golfer off the waitlist for that day
// The token is the signed link from the waitlist email (_links.js).
async function load({ request, env, params }) {
  const token = new URL(request.url).searchParams.get('t')
  if (!await verifyLinkToken(env, 'waitlist', params.id, token)) return json({ error: 'This link isn\'t valid.' }, 403)
  const supabase = makeSupabase(env)
  const { data: entry, error } = await supabase.from('WaitlistEntry').select('*').eq('id', params.id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!entry) return json({ error: 'Not found' }, 404)
  return { supabase, entry }
}

const view = e => ({
  id: e.id, date: String(e.date).slice(0, 10), players: e.players, notified: !!e.notifiedAt, left: !!e.cancelledAt,
})

export async function onRequestGet(context) {
  const r = await load(context)
  if (r instanceof Response) return r
  return json(view(r.entry))
}

export async function onRequestDelete(context) {
  const r = await load(context)
  if (r instanceof Response) return r
  if (!r.entry.cancelledAt) {
    const { error } = await r.supabase.from('WaitlistEntry').update({ cancelledAt: new Date().toISOString() }).eq('id', r.entry.id)
    if (error) return json({ error: error.message }, 500)
  }
  return json({ ...view(r.entry), left: true })
}
