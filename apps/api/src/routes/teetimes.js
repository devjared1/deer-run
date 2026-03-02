export default async function teetimesRoutes(fastify) {
  fastify.addHook('preHandler', fastify.optionalAuth)

  fastify.get('/', async (request, reply) => {
    const { date } = request.query
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.badRequest('?date=YYYY-MM-DD is required')
    }

    const settings = await fastify.prisma.courseSettings.findUnique({
      where: { id: 'singleton' },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [y, m, d] = date.split('-').map(Number)
    const requestedDate = new Date(y, m - 1, d)

    const isMember = !!request.user
    const maxDays  = isMember ? settings.memberBookingDays : settings.publicBookingDays

    const cutoff = new Date(today)
    cutoff.setDate(today.getDate() + maxDays)

    if (requestedDate < today || requestedDate > cutoff) {
      return reply.badRequest('Date is outside the booking window')
    }

    const slots = await fastify.prisma.teeTimeSlot.findMany({
      where: { date: requestedDate },
      include: {
        bookings: {
          where: { status: { in: ['PENDING', 'CONFIRMED'] } },
          select: { players: true },
        },
      },
      orderBy: { startTime: 'asc' },
    })

    return slots
      .filter((s) => !s.memberOnly || isMember)
      .map((s) => {
        const booked    = s.bookings.reduce((sum, b) => sum + b.players, 0)
        const available = Math.max(0, s.maxPlayers - booked)
        return {
          id:         s.id,
          startTime:  s.startTime,
          maxPlayers: s.maxPlayers,
          memberOnly: s.memberOnly,
          available,
          full: available === 0,
        }
      })
  })
}
