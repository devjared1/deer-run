import { requireAdmin, json } from '../_auth.js'
import { stopPendingPayment } from '../../bookings/_holds.js'

// PUT /api/admin/bookings/:id — update status (cancel, refund, confirm)
export async function onRequestPut({ request, env, params }) {
  const result = await requireAdmin(request, env)
  if (result instanceof Response) return result
  const { supabase } = result

  const { status } = await request.json()
  const allowed = ['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED']
  if (!allowed.includes(status)) return json({ error: `status must be one of: ${allowed.join(', ')}` }, 400)

  // Cancelling an unpaid online booking cancels its PaymentIntent first, so the payment can't go through later.
  // (Paid bookings: changing the status moves no money; refunds are made in Stripe.)
  if (status === 'CANCELLED' || status === 'REFUNDED') {
    const { data: current } = await supabase.from('Booking').select('*').eq('id', params.id).maybeSingle()
    if (current?.status === 'PENDING' && current.stripePaymentId && (!current.source || current.source === 'ONLINE')) {
      const stopped = await stopPendingPayment(env, current, supabase)
      if (stopped) return stopped
    }
  }

  const { data, error } = await supabase
    .from('Booking')
    .update({ status })
    .eq('id', params.id)
    .select('id, status, totalCents, TeeTimeSlot(date, startTime), User(name, email), guestName, guestEmail')
    .single()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ error: 'Booking not found' }, 404)

  return json(data)
}
