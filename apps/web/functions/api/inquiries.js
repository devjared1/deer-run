import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function json(data, status = 200) {
  return Response.json(data, { status })
}

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { firstName, lastName, email, phone, tier, message } = body

  if (!firstName || !lastName || !email || !tier) {
    return json({ error: 'firstName, lastName, email, and tier are required' }, 400)
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { error: dbError } = await supabase.from('Inquiry').insert({
    id: crypto.randomUUID(),
    firstName,
    lastName,
    email,
    phone: phone ?? null,
    tier,
    message: message ?? null,
  })

  if (dbError) return json({ error: dbError.message }, 500)

  // Send notification email to pro shop
  if (env.RESEND_API_KEY && env.CONTACT_EMAIL_TO) {
    const resend = new Resend(env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'noreply@deerrun.golf',
      to: env.CONTACT_EMAIL_TO,
      subject: `Membership Inquiry — ${tier} (${firstName} ${lastName})`,
      text: [
        `Name: ${firstName} ${lastName}`,
        `Email: ${email}`,
        `Phone: ${phone || 'N/A'}`,
        `Tier: ${tier}`,
        `Message: ${message || 'N/A'}`,
      ].join('\n'),
    })
  }

  return json({ success: true })
}
