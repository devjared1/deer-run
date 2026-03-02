// TODO: implement inquiries route (Phase 4)
export default async function inquiriesRoutes(fastify) {
  fastify.get('/', async () => ({ message: 'inquiries route — coming in Phase 4' }))
}
