// TODO: implement events route (Phase 4)
export default async function eventsRoutes(fastify) {
  fastify.get('/', async () => ({ message: 'events route — coming in Phase 4' }))
}
