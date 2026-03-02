// TODO: implement webhooks route (Phase 4)
export default async function webhooksRoutes(fastify) {
  fastify.get('/', async () => ({ message: 'webhooks route — coming in Phase 4' }))
}
