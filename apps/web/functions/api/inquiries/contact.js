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

  const { name, email, phone, subject, message } = body

  if (!name || !email || !subject || !message) {
    return json({ error: 'name, email, subject, and message are required' }, 400)
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { error: dbError } = await supabase.from('ContactMessage').insert({
    id: crypto.randomUUID(),
    name,
    email,
    phone: phone ?? null,
    subject,
    message,
  })

  if (dbError) return json({ error: dbError.message }, 500)

  if (env.RESEND_API_KEY && env.CONTACT_EMAIL_TO) {
    const resend = new Resend(env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'noreply@deerrun.golf',
      to: env.CONTACT_EMAIL_TO,
      subject: `Contact Message — ${subject} (${name})`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || 'N/A'}`,
        `Subject: ${subject}`,
        `Message: ${message}`,
      ].join('\n'),
    })
  }

  return json({ success: true })
}
