<template>
  <div class="page-enter">
    <PageHero
      label="Get in Touch"
      title-html="Contact <em>Us</em>"
      description="Pro Shop staff are on-site daily. For the fastest response, call us at (256) 974-7384."
      bg-image="/images/course-5.jpg"
    />

    <section class="topo py-14">
      <div class="max-w-7xl mx-auto px-5">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">

          <!-- Contact form -->
          <div>
            <SectionLabel text="Send a Message" class="mb-5" />
            <div class="card rounded-lg p-8">
              <div v-if="sent" class="text-center py-6">
                <div class="text-4xl mb-4">✅</div>
                <h3 style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#1E3D2F;margin-bottom:8px;">Message Sent!</h3>
                <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.5);">We'll be in touch within one business day.</p>
                <button @click="sent = false" class="btn-outline-pine mt-5 inline-flex">Send Another</button>
              </div>

              <form v-else @submit.prevent="submit" class="space-y-4">
                <div v-if="error" class="p-3 rounded text-sm" style="background:rgba(140,74,47,.1);color:#6B3820;font-family:'Lato',sans-serif;">{{ error }}</div>
                <div>
                  <label class="field-label">Your Name</label>
                  <input v-model="form.name" type="text" placeholder="John Smith" class="field rounded-sm" required />
                </div>
                <div>
                  <label class="field-label">Email Address</label>
                  <input v-model="form.email" type="email" placeholder="john@example.com" class="field rounded-sm" required />
                </div>
                <div>
                  <label class="field-label">Phone (optional)</label>
                  <input v-model="form.phone" type="tel" placeholder="(256) 555-0100" class="field rounded-sm" />
                </div>
                <div>
                  <label class="field-label">Subject</label>
                  <select v-model="form.subject" class="field rounded-sm" required>
                    <option value="">Choose a subject…</option>
                    <option>Tee Time / Booking Question</option>
                    <option>Tournament Information</option>
                    <option>Group Outing / Corporate Event</option>
                    <option>Membership Inquiry</option>
                    <option>Pro Shop</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label class="field-label">Message</label>
                  <textarea v-model="form.message" rows="4" class="field rounded-sm resize-none" required></textarea>
                </div>
                <button
                  type="submit"
                  :disabled="loading"
                  class="btn-amber w-full justify-center"
                  :style="loading ? 'opacity:.6;cursor:not-allowed;' : ''"
                >
                  {{ loading ? 'Sending…' : 'Send Message' }}
                </button>
              </form>
            </div>
          </div>

          <!-- Info panel -->
          <div class="space-y-6">
            <div>
              <SectionLabel text="Pro Shop" class="mb-5" />
              <div class="card rounded-lg p-7 space-y-5">
                <div v-for="info in contactInfo" :key="info.label" class="flex items-start gap-4">
                  <div class="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style="background:rgba(30,61,47,.1);">
                    <span class="text-lg">{{ info.icon }}</span>
                  </div>
                  <div>
                    <div style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(61,43,26,.4);margin-bottom:3px;">{{ info.label }}</div>
                    <div style="font-family:'Lato',sans-serif;font-size:14px;color:#3D2B1A;" v-html="info.value"></div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <SectionLabel text="Hours of Operation" class="mb-5" />
              <div class="card rounded-lg p-7">
                <div
                  v-for="h in hours"
                  :key="h.day"
                  class="flex justify-between py-2.5"
                  style="border-bottom:1px solid rgba(61,43,26,.07);"
                >
                  <span style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.55);">{{ h.day }}</span>
                  <span style="font-family:'Lato',sans-serif;font-size:13px;font-weight:700;color:#1E3D2F;">{{ h.hours }}</span>
                </div>
                <p class="mt-4 text-xs" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.35);line-height:1.6;">
                  * Closed Christmas Eve and Christmas Day. Last tee time 5:00 PM daily. Hours subject to seasonal change.
                </p>
              </div>
            </div>

            <!-- Static map -->
            <div class="card rounded-lg overflow-hidden" style="height:230px;">
              <iframe
                title="Deer Run Golf Course"
                width="100%"
                height="100%"
                style="border:0;"
                loading="lazy"
                allowfullscreen
                referrerpolicy="no-referrer-when-downgrade"
                src="https://maps.google.com/maps?q=1175+County+Road+100+Moulton+AL+35650&output=embed"
              ></iframe>
            </div>
          </div>

        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import PageHero     from '@/components/layout/PageHero.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'

const sent    = ref(false)
const loading = ref(false)
const error   = ref('')

const form = reactive({ name: '', email: '', phone: '', subject: '', message: '' })

const contactInfo = [
  { icon: '📍', label: 'Address', value: '1175 County Road 100<br>Moulton, AL 35650' },
  { icon: '📞', label: 'Phone',   value: '<a href="tel:2569747384" style="color:#1E3D2F;text-decoration:none;">(256) 974-7384</a>' },
  { icon: '✉️', label: 'Email',   value: '<a href="mailto:proshop@deerrun.golf" style="color:#1E3D2F;text-decoration:none;">proshop@deerrun.golf</a>' },
]

const hours = [
  { day: 'Monday – Friday', hours: '7:30 AM – 5:00 PM' },
  { day: 'Saturday',        hours: '7:00 AM – 5:00 PM' },
  { day: 'Sunday',          hours: '7:30 AM – 5:00 PM' },
  { day: 'Holidays',        hours: '8:00 AM – 4:00 PM' },
]

async function submit() {
  error.value   = ''
  loading.value = true
  try {
    const res = await fetch('/api/inquiries/contact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    if (!res.ok) throw new Error()
    sent.value = true
    Object.assign(form, { name: '', email: '', phone: '', subject: '', message: '' })
  } catch {
    error.value = 'Something went wrong. Please call us at (256) 974-7384.'
  } finally {
    loading.value = false
  }
}
</script>
