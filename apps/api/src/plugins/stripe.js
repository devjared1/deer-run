import fp from 'fastify-plugin'
import Stripe from 'stripe'

export default fp(async (fastify) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  })
  fastify.decorate('stripe', stripe)
})
