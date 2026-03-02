import fp from 'fastify-plugin'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export default fp(async (fastify) => {
  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
  )

  fastify.decorate('authenticate', async (request, reply) => {
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return reply.unauthorized('Missing bearer token')
    }
    try {
      const { payload } = await jwtVerify(header.slice(7), JWKS)
      request.user = payload
    } catch {
      return reply.unauthorized('Token verification failed')
    }
  })

  // Optional auth — attaches user if token present, but doesn't block if missing
  fastify.decorate('optionalAuth', async (request) => {
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) return
    try {
      const { payload } = await jwtVerify(header.slice(7), JWKS)
      request.user = payload
    } catch {
      // silently ignore
    }
  })
})
