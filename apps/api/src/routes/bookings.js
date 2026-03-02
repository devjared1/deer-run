export default async function bookingsRoutes(fastify) {
  // GET /my — current user's bookings (register before /:id to avoid route conflict)
  fastify.get('/my', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { supabaseId: request.user.sub },
    })
    if (!user) return []
    return fastify.prisma.booking.findMany({
      where: { userId: user.id },
      include: { teeTimeSlot: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  // GET /by-session/:sessionId — look up booking by Stripe session
  fastify.get('/by-session/:sessionId', async (request, reply) => {
    const booking = await fastify.prisma.booking.findUnique({
      where:   { stripeSessionId: request.params.sessionId },
      include: { teeTimeSlot: true },
    })
    if (!booking) return reply.notFound()
    return booking
  })

  // GET /:id — booking detail (auth required)
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const booking = await fastify.prisma.booking.findUnique({
      where:   { id: request.params.id },
      include: { teeTimeSlot: true, user: true },
    })
    if (!booking) return reply.notFound()
    return booking
  })

  // POST / — create booking + Stripe Checkout session
  fastify.post('/', { preHandler: [fastify.optionalAuth] }, async (request, reply) => {
    const { teeTimeSlotId, players, guestName, guestEmail } = request.body

    if (!teeTimeSlotId || !players) {
      return reply.badRequest('teeTimeSlotId and players are required')
    }

    const settings = await fastify.prisma.courseSettings.findUnique({
      where: { id: 'singleton' },
    })
    const totalCents = players * settings.pricePerPlayerCents

    const slot = await fastify.prisma.teeTimeSlot.findUnique({
      where:   { id: teeTimeSlotId },
      include: {
        bookings: {
          where:  { status: { in: ['PENDING', 'CONFIRMED'] } },
          select: { players: true },
        },
      },
    })
    if (!slot) return reply.notFound('Tee time slot not found')

    const booked    = slot.bookings.reduce((sum, b) => sum + b.players, 0)
    const available = slot.maxPlayers - booked
    if (players > available) {
      return reply.badRequest(`Only ${available} spot${available === 1 ? '' : 's'} remaining`)
    }
    if (slot.memberOnly && !request.user) {
      return reply.forbidden('This tee time is for members only')
    }

    let userId = null
    if (request.user) {
      const user = await fastify.prisma.user.upsert({
        where:  { supabaseId: request.user.sub },
        update: {},
        create: { supabaseId: request.user.sub, email: request.user.email, role: 'MEMBER' },
      })
      userId = user.id
    }

    const booking = await fastify.prisma.booking.create({
      data: {
        teeTimeSlotId,
        userId,
        guestName:  userId ? null : (guestName || null),
        guestEmail: userId ? null : (guestEmail || null),
        players,
        totalCents,
        status: 'PENDING',
      },
    })

    const slotDate = new Date(slot.date)
    const dateStr  = slotDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    })
    const [h, m] = slot.startTime.split(':').map(Number)
    const timeStr = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`

    const session = await fastify.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency:     'usd',
          unit_amount:  totalCents,
          product_data: {
            name:        `Deer Run Golf — ${dateStr} at ${timeStr}`,
            description: `${players} player${players > 1 ? 's' : ''} · Cart included`,
          },
        },
      }],
      success_url:    `${process.env.FRONTEND_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:     `${process.env.FRONTEND_URL}/book`,
      metadata:       { bookingId: booking.id },
      customer_email: userId ? undefined : (guestEmail || undefined),
    })

    await fastify.prisma.booking.update({
      where: { id: booking.id },
      data:  { stripeSessionId: session.id },
    })

    return { bookingId: booking.id, checkoutUrl: session.url }
  })

  // DELETE /:id — cancel booking
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { supabaseId: request.user.sub },
    })
    const booking = await fastify.prisma.booking.findUnique({
      where: { id: request.params.id },
    })
    if (!booking) return reply.notFound()
    if (booking.userId !== user?.id) return reply.forbidden()
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return reply.badRequest('Booking cannot be cancelled in its current state')
    }
    return fastify.prisma.booking.update({
      where: { id: request.params.id },
      data:  { status: 'CANCELLED' },
    })
  })
}
