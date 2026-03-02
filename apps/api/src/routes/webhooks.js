export default async function webhooksRoutes(fastify) {
  fastify.post('/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature']
    if (!sig) return reply.badRequest('Missing stripe-signature header')

    let event
    try {
      event = fastify.stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      fastify.log.warn({ err: err.message }, 'Stripe webhook signature verification failed')
      return reply.badRequest('Invalid webhook signature')
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      try {
        await fastify.prisma.booking.update({
          where: { stripeSessionId: session.id },
          data:  {
            status:         'CONFIRMED',
            stripePaymentId: session.payment_intent ?? null,
          },
        })
        fastify.log.info({ sessionId: session.id }, 'Booking confirmed via Stripe webhook')
      } catch (err) {
        fastify.log.error({ err: err.message, sessionId: session.id }, 'Failed to confirm booking')
      }
    }

    return { received: true }
  })
}
