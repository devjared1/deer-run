import fp from 'fastify-plugin'
import { Resend } from 'resend'

export default fp(async (fastify) => {
  const resend = new Resend(process.env.RESEND_API_KEY)
  fastify.decorate('email', resend)
})
