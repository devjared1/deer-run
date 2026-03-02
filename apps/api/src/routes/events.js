export default async function eventsRoutes(fastify) {
  fastify.get('/', async () => {
    return fastify.prisma.tournamentEvent.findMany({
      orderBy: { eventDate: 'asc' },
    })
  })

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { supabaseId: request.user.sub },
    })
    if (user?.role !== 'ADMIN') return reply.forbidden()

    const { name, description, eventDate, startTime, format, entryCents, spotsTotal, memberOnly, featured } = request.body
    if (!name || !description || !eventDate || !startTime || !format) {
      return reply.badRequest('name, description, eventDate, startTime, and format are required')
    }

    return fastify.prisma.tournamentEvent.create({
      data: {
        name,
        description,
        eventDate: new Date(eventDate),
        startTime,
        format,
        entry:      entryCents  ?? null,
        spotsTotal: spotsTotal  ?? null,
        memberOnly: memberOnly  ?? false,
        featured:   featured    ?? false,
        past:       false,
      },
    })
  })
}
