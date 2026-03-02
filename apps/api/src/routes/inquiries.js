export default async function inquiriesRoutes(fastify) {
  // Membership inquiry
  fastify.post('/membership', async (request, reply) => {
    const { firstName, lastName, email, phone, tier, message } = request.body
    if (!firstName || !email || !tier) {
      return reply.badRequest('firstName, email, and tier are required')
    }

    await fastify.prisma.inquiry.create({
      data: { firstName, lastName: lastName || '', email, phone: phone || null, tier, message: message || null },
    })

    try {
      await fastify.email.emails.send({
        from:    'Deer Run Golf <noreply@deerrun.golf>',
        to:      process.env.CONTACT_EMAIL_TO,
        subject: `Membership Inquiry — ${tier} — ${firstName} ${lastName || ''}`,
        text:    [
          `New membership inquiry received via the website.`,
          ``,
          `Tier:    ${tier}`,
          `Name:    ${firstName} ${lastName || ''}`,
          `Email:   ${email}`,
          `Phone:   ${phone || 'Not provided'}`,
          `Message: ${message || 'None'}`,
        ].join('\n'),
      })
    } catch (e) {
      fastify.log.error(e, 'Failed to send membership inquiry email')
    }

    return { success: true }
  })

  // General contact message
  fastify.post('/contact', async (request, reply) => {
    const { name, email, phone, subject, message } = request.body
    if (!name || !email || !subject || !message) {
      return reply.badRequest('name, email, subject, and message are required')
    }

    await fastify.prisma.contactMessage.create({
      data: { name, email, phone: phone || null, subject, message },
    })

    try {
      await fastify.email.emails.send({
        from:    'Deer Run Golf <noreply@deerrun.golf>',
        to:      process.env.CONTACT_EMAIL_TO,
        subject: `Contact Form: ${subject} — ${name}`,
        text:    [
          `New contact message received via the website.`,
          ``,
          `Name:    ${name}`,
          `Email:   ${email}`,
          `Phone:   ${phone || 'Not provided'}`,
          `Subject: ${subject}`,
          ``,
          `Message:`,
          message,
        ].join('\n'),
      })
    } catch (e) {
      fastify.log.error(e, 'Failed to send contact email')
    }

    return { success: true }
  })
}
