import { authenticate, json } from '../../admin/_auth.js'
import { loadAccount, buildStatement } from '../../admin/_houseAccounts.js'
import { statementPdfBase64, statementPdfFilename } from '../../admin/_statementPdf.js'

// GET /api/account/statements/:id — one of the signed-in member's saved statements, with its entries (printable)
//   → { statement: { ...Statement, entries }, member: { name, email } }
// GET /api/account/statements/:id?format=pdf — the same statement as the PDF that's emailed
//   (application/pdf, Content-Disposition attachment; filename from statementPdfFilename())
export async function onRequestGet({ request, env, params }) {
  const result = await authenticate(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser } = result

  const account = await loadAccount(supabase, { userId: dbUser.id })
  if (!account) return json({ error: 'Statement not found' }, 404)
  const { data: statement } = await supabase.from('Statement').select('*').eq('id', params.id).eq('accountId', account.id).maybeSingle()
  if (!statement) return json({ error: 'Statement not found' }, 404)

  const built = await buildStatement(supabase, account.id, statement.periodStart, statement.periodEnd)
  const full = { ...statement, entries: built.entries }
  const member = { name: account.user?.name, email: account.user?.email }

  if (new URL(request.url).searchParams.get('format') === 'pdf') {
    let bytes
    try {
      const binary = atob(statementPdfBase64(full, member))
      bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    } catch (e) {
      console.error('Statement PDF failed:', e)
      return json({ error: 'The PDF couldn\'t be made. Please try again, or print the statement instead.' }, 500)
    }
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${statementPdfFilename(statement)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }

  return json({ statement: full, member })
}
