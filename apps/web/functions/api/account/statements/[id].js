import { authenticate, json } from '../../admin/_auth.js'
import { loadAccount, buildStatement } from '../../admin/_houseAccounts.js'

// GET /api/account/statements/:id — one of the signed-in member's saved statements, with its entries (printable)
export async function onRequestGet({ request, env, params }) {
  const result = await authenticate(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  const account = await loadAccount(supabase, { userId: dbUser.id })
  if (!account) return json({ error: 'Statement not found' }, 404)
  const { data: statement } = await supabase.from('Statement').select('*').eq('id', params.id).eq('accountId', account.id).maybeSingle()
  if (!statement) return json({ error: 'Statement not found' }, 404)

  const built = await buildStatement(supabase, account.id, statement.periodStart, statement.periodEnd)
  return json({
    statement: { ...statement, entries: built.entries },
    member: { name: account.user?.name, email: account.user?.email },
  })
}
