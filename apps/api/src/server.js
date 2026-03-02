import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
})
await app.register(sensible)

// Plugins
await app.register(import('./plugins/prisma.js'))
await app.register(import('./plugins/auth.js'))
await app.register(import('./plugins/stripe.js'))
await app.register(import('./plugins/email.js'))

// Routes
await app.register(import('./routes/auth.js'),      { prefix: '/api/auth' })
await app.register(import('./routes/teetimes.js'),  { prefix: '/api/teetimes' })
await app.register(import('./routes/bookings.js'),  { prefix: '/api/bookings' })
await app.register(import('./routes/events.js'),    { prefix: '/api/events' })
await app.register(import('./routes/inquiries.js'), { prefix: '/api/inquiries' })
await app.register(import('./routes/webhooks.js'),  { prefix: '/api/webhooks' })

// Health check
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

await app.listen({
  port: Number(process.env.PORT) || 3001,
  host: '0.0.0.0',
})
