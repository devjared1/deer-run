// TODO: implement teetimes route (Phase 4)
export default async function teetimesRoutes(fastify) {
  fastify.get('/', async () => ({ message: 'teetimes route — coming in Phase 4' }))
}
