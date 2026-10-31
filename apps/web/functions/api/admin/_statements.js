import { fetchAll } from './_db.js'
import {
  ACCOUNT_SELECT, DUE_DAYS, buildStatement, previousMonth, recordPayment, sendStatement, accountBalance, addDays, localDate, money,
  loadAccount, openStatementsOwed, settleStatements, sendReminder,
} from './_houseAccounts.js'
import { formatLocalDate } from '../../../src/lib/timeclock.js'
import { makeStripe, stripeMessage } from '../staff/_stripe.js'

/**
 * Charges a statement to the member's saved card (autopay). Returns 'charged' or 'failed'. Idempotent per statement
 * (Stripe idempotency key), and charges no more than the account's current balance.
 */
export async function chargeAutopay(supabase, env, account, statement) {
  const stripe = makeStripe(env)
  const fail = async (message) => {
    await supabase.from('Statement').update({ status: 'AUTOPAY_FAILED', autopayError: message }).eq('id', statement.id)
    return 'failed'
  }
  if (!stripe) return fail('Stripe is not configured')

  const amount = Math.min(statement.closingCents, await accountBalance(supabase, account.id))
  if (amount <= 0) {
    await supabase.from('Statement').update({ status: 'PAID', paidAt: new Date().toISOString() }).eq('id', statement.id)
    return 'charged'
  }
  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: account.stripeCustomerId,
      payment_method: account.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      description: `Deer Run house account statement ${statement.periodStart} – ${statement.periodEnd}`,
      metadata: { kind: 'autopay', statementId: statement.id, houseAccountId: account.id },
    }, { idempotencyKey: `autopay-${statement.id}` })
    await supabase.from('Statement').update({ autopayPaymentIntentId: intent.id }).eq('id', statement.id)
    if (intent.status !== 'succeeded') return fail(`The card needs the member's approval (${intent.status})`)
    const paid = await recordPayment(supabase, { accountId: account.id, amountCents: amount, method: 'AUTOPAY', stripePaymentIntentId: intent.id })
    if (paid.error) return fail(`Charged, but the payment didn't save: ${paid.error}`)
    await supabase.from('Statement').update({ status: 'PAID', paidAt: new Date().toISOString(), autopayError: null }).eq('id', statement.id)
    return 'charged'
  } catch (e) {
    return fail(stripeMessage(e))
  }
}

/**
 * Closes the previous month for every account that had activity in it or carries a balance: saves the statement
 * (one per account per period, so re-running skips what's done), charges autopay, and emails it.
 * Returns a summary { period, created, skipped, autopay: { charged, failed }, emailed, errors }.
 */
export async function runMonthlyStatements(supabase, env, today = localDate()) {
  const { periodStart, periodEnd } = previousMonth(today)
  const [accounts, existing] = await Promise.all([
    fetchAll(() => supabase.from('HouseAccount').select(ACCOUNT_SELECT).order('createdAt', { ascending: true })),
    fetchAll(() => supabase.from('Statement').select('id, accountId').eq('periodStart', periodStart).order('id', { ascending: true })),
  ])
  const done = new Set(existing.map(s => s.accountId))
  const summary = { period: { periodStart, periodEnd }, created: 0, skipped: 0, autopay: { charged: 0, failed: 0 }, emailed: 0, errors: [] }

  for (const account of accounts) {
    if (done.has(account.id)) { summary.skipped++; continue }
    try {
      const built = await buildStatement(supabase, account.id, periodStart, periodEnd)
      if (!built.entries.length && built.openingCents === 0) continue // nothing happened and nothing owed

      const statement = {
        id: crypto.randomUUID(),
        accountId: account.id,
        periodStart, periodEnd,
        openingCents: built.openingCents,
        chargesCents: built.chargesCents,
        creditsCents: built.creditsCents,
        closingCents: built.closingCents,
        dueDate: addDays(periodEnd, DUE_DAYS),
        status: built.closingCents > 0 ? 'OPEN' : 'PAID',
        paidAt: built.closingCents > 0 ? null : new Date().toISOString(),
      }
      const { error } = await supabase.from('Statement').insert(statement)
      if (error?.code === '23505') { summary.skipped++; continue } // another run got there first
      if (error) throw new Error(error.message)
      summary.created++

      let autopay = null
      if (statement.closingCents > 0 && account.autopayEnabled && account.stripePaymentMethodId) {
        autopay = await chargeAutopay(supabase, env, account, statement)
        summary.autopay[autopay]++
      }
      const emailError = await sendStatement(env, account, { ...statement, entries: built.entries }, { autopay })
      if (emailError) summary.errors.push(`${account.user?.email ?? account.id}: email: ${emailError}`)
      else {
        summary.emailed++
        await supabase.from('Statement').update({ emailedAt: new Date().toISOString() }).eq('id', statement.id)
      }
    } catch (e) {
      summary.errors.push(`${account.user?.email ?? account.id}: ${e.message}`)
    }
  }
  return summary
}

// Overdue statements whose due date passed more than this many days ago are left alone (so turning the feature on,
// or a long email outage, doesn't send a backlog of old reminders or fees)
export const OVERDUE_WINDOW_DAYS = 45

/**
 * Overdue statements: an OPEN / AUTOPAY_FAILED statement past its due date with something still owed on it (see
 * openStatementsOwed) gets the course late fee (CourseSettings.lateFeeCents; 0 = off) as an ADJUSTMENT, once
 * (Statement.lateFeeAt), and one reminder email with the statement PDF (Statement.reminderSentAt). Both are
 * claimed with a conditional update first, so re-running (or two runs at once) never repeats them. Statements that
 * turn out to be covered are marked PAID. Without RESEND_API_KEY reminders are skipped silently (and sent once it's
 * set, within the window). Returns { reminded, lateFees, settled, errors }.
 */
export async function runOverdueStatements(supabase, env, today = localDate()) {
  const summary = { reminded: 0, lateFees: 0, settled: 0, errors: [] }
  const [{ data: settings, error: settingsError }, candidates] = await Promise.all([
    supabase.from('CourseSettings').select('*').eq('id', 'singleton').maybeSingle(),
    fetchAll(() => supabase.from('Statement').select('id, accountId').in('status', ['OPEN', 'AUTOPAY_FAILED'])
      .lt('dueDate', today).gte('dueDate', addDays(today, -OVERDUE_WINDOW_DAYS)).is('reminderSentAt', null)
      .order('id', { ascending: true })),
  ])
  if (settingsError) throw new Error(settingsError.message)
  const lateFeeCents = Number.isInteger(settings?.lateFeeCents) && settings.lateFeeCents > 0 ? settings.lateFeeCents : 0
  const due = new Set(candidates.map(s => s.id))

  for (const accountId of new Set(candidates.map(s => s.accountId))) {
    let account = null
    try {
      account = await loadAccount(supabase, { id: accountId })
      if (!account) continue
      const owed = await openStatementsOwed(supabase, accountId)
      summary.settled += await settleStatements(supabase, accountId)

      for (const { statement, owedCents } of owed) {
        if (!due.has(statement.id) || owedCents <= 0) continue
        const now = new Date().toISOString()
        const month = formatLocalDate(statement.periodStart, { month: 'long', year: 'numeric' })

        let feeAdded = 0
        if (lateFeeCents && !statement.lateFeeAt) {
          const { data: claimed, error } = await supabase.from('Statement').update({ lateFeeAt: now })
            .eq('id', statement.id).is('lateFeeAt', null).select('id')
          if (error) throw new Error(error.message)
          if (claimed?.length) {
            const { error: feeError } = await supabase.from('HouseAccountEntry').insert({
              id: crypto.randomUUID(), accountId, type: 'ADJUSTMENT', amountCents: lateFeeCents,
              description: `Late fee — ${month} statement`, createdById: null,
            })
            if (feeError) {
              await supabase.from('Statement').update({ lateFeeAt: null }).eq('id', statement.id)
              throw new Error(`late fee: ${feeError.message}`)
            }
            feeAdded = lateFeeCents
            summary.lateFees++
          }
        }

        if (!env.RESEND_API_KEY || !account.user?.email) continue
        const { data: claimed, error } = await supabase.from('Statement').update({ reminderSentAt: now })
          .eq('id', statement.id).is('reminderSentAt', null).select('id')
        if (error) throw new Error(error.message)
        if (!claimed?.length) continue // another run sent it
        const built = await buildStatement(supabase, accountId, statement.periodStart, statement.periodEnd)
        const emailError = await sendReminder(env, account, { ...statement, entries: built.entries },
          { owedCents, balanceCents: await accountBalance(supabase, accountId), lateFeeCents: feeAdded })
        if (emailError) {
          await supabase.from('Statement').update({ reminderSentAt: null }).eq('id', statement.id)
          summary.errors.push(`${account.user.email}: reminder: ${emailError}`)
        } else {
          summary.reminded++
        }
      }
    } catch (e) {
      summary.errors.push(`${account?.user?.email ?? accountId}: ${e.message}`)
    }
  }
  return summary
}

export { money }
