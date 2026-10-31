import { json } from '../admin/_auth.js'
import { requireRegister } from './_auth.js'
import { openSession, DRAWER_REQUIRED_MESSAGE } from './_drawer.js'
import { startCardCheckout } from './_cardCheckout.js'
import { loadAccount, recordPayment, accountBalance } from '../admin/_houseAccounts.js'

const MAX_PAYMENT_CENTS = 1_000_000 // $10,000

// POST /api/staff/account-payments — a member pays toward their house account at the register.
//   { registerId, accountId, amountCents, method: 'CASH', tenderedCents }  → 201 { accountPayment, changeCents }
//   { registerId, accountId, amountCents, method: 'CARD' }                 → 202 { cardCheckout } (like a card sale;
//     the register polls /api/staff/card-checkouts/:id, which returns { accountPayment } once approved)
// Cash goes in this register's drawer (it must be open) and counts toward the drawer's expected cash.
export async function onRequestPost({ request, env }) {
  const result = await requireRegister(request, env)
  if (result instanceof Response) return result
  const { supabase, dbUser, employee } = result

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: register } = await supabase.from('Register').select('id, name, active, stripeReaderId').eq('id', body?.registerId ?? '').maybeSingle()
  if (!register?.active) return json({ error: 'Choose a register' }, 400)
  const account = await loadAccount(supabase, { id: String(body?.accountId ?? '') })
  if (!account) return json({ error: 'House account not found' }, 404)
  if (account.status === 'CLOSED') return json({ error: 'This house account is closed' }, 409)

  const amount = Number(body.amountCents)
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_PAYMENT_CENTS) return json({ error: 'Enter a payment amount' }, 400)

  if (body.method === 'CASH') {
    const tendered = Number(body.tenderedCents ?? amount)
    if (!Number.isInteger(tendered) || tendered < amount) return json({ error: 'The cash received is less than the payment' }, 400)
    if (!(await openSession(supabase, register.id))) return json({ error: DRAWER_REQUIRED_MESSAGE, code: 'DRAWER_CLOSED' }, 409)
    const paid = await recordPayment(supabase, {
      accountId: account.id, amountCents: amount, method: 'CASH', registerId: register.id, createdById: dbUser.id,
    })
    if (paid.error) return json({ error: paid.error }, paid.status)
    return json({
      accountPayment: { ...paid.entry, balanceCents: await accountBalance(supabase, account.id) },
      changeCents: tendered - amount,
    }, 201)
  }

  if (body.method === 'CARD') {
    if (!register.stripeReaderId) return json({ error: 'This register has no card reader. An admin can pair one in Admin → Registers.' }, 409)
    if (amount < 50) return json({ error: 'Card payments must be at least $0.50' }, 400)
    return startCardCheckout(supabase, env, {
      kind: 'account_payment',
      accountId: account.id,
      createdById: dbUser.id,
      registerId: register.id,
      registerName: register.name,
      cashierId: employee.id,
      readerId: register.stripeReaderId,
      cardCents: amount,
    })
  }

  return json({ error: "method must be 'CASH' or 'CARD'" }, 400)
}
