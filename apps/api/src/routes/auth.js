export default async function authRoutes(fastify) {
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const { sub: supabaseId, email } = request.user
    return fastify.prisma.user.upsert({
      where: { supabaseId },
      update: {},
      create: { supabaseId, email, role: 'MEMBER' },
    })
  })
}
