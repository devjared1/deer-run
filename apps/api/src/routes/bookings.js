// TODO: implement bookings route (Phase 4)
export default async function bookingsRoutes(fastify) {
  fastify.get('/', async () => ({ message: 'bookings route — coming in Phase 4' }))
}
