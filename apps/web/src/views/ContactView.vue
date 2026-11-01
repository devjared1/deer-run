<template>
  <div>
    <PageHero
      label="Get in touch"
      title-html="Contact <em>Us</em>"
      description="Pro Shop staff are on-site daily. For the fastest answer, give us a call."
      photo="course-5"
      height="360px"
    >
      <div class="mt-6 flex flex-col sm:flex-row gap-3">
        <AppButton variant="gold" size="lg" :href="`tel:${site.phone.tel}`" :icon="IconCall">
          Call {{ site.phone.display }}
        </AppButton>
        <AppButton
          variant="outlined"
          size="lg"
          :href="site.mapsDirectionsUrl"
          target="_blank"
          rel="noopener"
          :icon="IconDirections"
          class="!text-on-primary !border-inverse-primary"
        >
          Get directions<span class="sr-only"> in Google Maps (opens in a new tab)</span>
        </AppButton>
      </div>
    </PageHero>

    <div class="bg-surface">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
        <!-- Contact form -->
        <section class="lg:col-span-7" aria-labelledby="contact-form-title">
          <Card padding="none">
            <div class="p-6 md:p-8">
              <div v-if="sent" class="text-center py-4" role="status">
                <span class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-container text-on-success-container mb-4" aria-hidden="true">
                  <IconCheckCircle class="w-9 h-9" />
                </span>
                <h2 id="contact-form-title" ref="successHeading" tabindex="-1" class="font-display text-headline-s text-on-surface">Message sent</h2>
                <p class="mt-2 text-body-l text-on-surface-variant">Thanks, {{ sentName }}. We’ll be in touch within one business day.</p>
                <AppButton variant="outlined" class="mt-6" @click="reset">Send another message</AppButton>
              </div>

              <form v-else ref="formEl" novalidate aria-labelledby="contact-form-title" @submit.prevent="submit">
                <h2 id="contact-form-title" class="font-display text-headline-m text-on-surface">Send a message</h2>
                <p class="mt-2 mb-6 text-body-m text-on-surface-variant">Fields marked * are required.</p>

                <ErrorBanner v-if="error" class="mb-5" :message="error" @dismiss="error = ''" />

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    ref="firstField"
                    v-model.trim="form.name"
                    class="sm:col-span-2"
                    label="Your name"
                    name="name"
                    autocomplete="name"
                    required
                    :error="shown('name')"
                    @blur="touch('name')"
                  />
                  <TextField
                    v-model.trim="form.email"
                    label="Email"
                    type="email"
                    name="email"
                    autocomplete="email"
                    inputmode="email"
                    required
                    :error="shown('email')"
                    @blur="touch('email')"
                  />
                  <TextField
                    v-model.trim="form.phone"
                    label="Phone"
                    type="tel"
                    name="phone"
                    autocomplete="tel"
                    inputmode="tel"
                    helper="Optional"
                    :error="shown('phone')"
                    @blur="touch('phone')"
                  />
                  <SelectField
                    v-model="form.subject"
                    class="sm:col-span-2"
                    label="Subject"
                    name="subject"
                    placeholder="Choose a subject"
                    :options="subjectOptions"
                    required
                    :error="shown('subject')"
                    @blur="touch('subject')"
                  />
                  <TextArea
                    v-model="form.message"
                    class="sm:col-span-2"
                    label="Message"
                    name="message"
                    :rows="5"
                    :maxlength="5000"
                    auto-grow
                    required
                    :error="shown('message')"
                    @blur="touch('message')"
                  />
                </div>

                <AppButton type="submit" variant="gold" size="lg" block class="mt-6" :loading="loading" :icon="IconSend">
                  {{ loading ? 'Sending…' : 'Send message' }}
                </AppButton>
              </form>
            </div>
          </Card>
        </section>

        <!-- Visit -->
        <section class="lg:col-span-5 space-y-6" aria-labelledby="visit-title">
          <h2 id="visit-title" class="font-display text-headline-m text-on-surface">Pro Shop</h2>

          <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <li class="sm:col-span-2 lg:col-span-1">
              <Card variant="outlined">
                <div class="flex items-start gap-4">
                  <span class="tile-icon" aria-hidden="true"><IconLocation class="w-6 h-6" /></span>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-label-l text-on-surface-variant">Address</h3>
                    <address class="not-italic text-body-l text-on-surface">
                      <span v-for="line in site.addressLines" :key="line" class="block">{{ line }}</span>
                    </address>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <AppButton variant="tonal" :href="site.mapsDirectionsUrl" target="_blank" rel="noopener" :icon="IconDirections">
                        Google Maps<span class="sr-only"> directions (opens in a new tab)</span>
                      </AppButton>
                      <AppButton variant="outlined" :href="site.appleMapsUrl" target="_blank" rel="noopener" :icon="IconMap">
                        Apple Maps<span class="sr-only"> directions (opens in a new tab)</span>
                      </AppButton>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
            <li>
              <Card variant="outlined" class="h-full">
                <div class="flex items-start gap-4">
                  <span class="tile-icon" aria-hidden="true"><IconCall class="w-6 h-6" /></span>
                  <div class="min-w-0">
                    <h3 class="text-label-l text-on-surface-variant">Phone</h3>
                    <a :href="`tel:${site.phone.tel}`" class="tile-link">{{ site.phone.display }}</a>
                  </div>
                </div>
              </Card>
            </li>
            <li>
              <Card variant="outlined" class="h-full">
                <div class="flex items-start gap-4">
                  <span class="tile-icon" aria-hidden="true"><IconMail class="w-6 h-6" /></span>
                  <div class="min-w-0">
                    <h3 class="text-label-l text-on-surface-variant">Email</h3>
                    <a :href="`mailto:${site.email}`" class="tile-link break-all">{{ site.email }}</a>
                  </div>
                </div>
              </Card>
            </li>
            <li class="sm:col-span-2 lg:col-span-1">
              <Card variant="outlined">
                <div class="flex items-start gap-4">
                  <span class="tile-icon" aria-hidden="true"><IconSchedule class="w-6 h-6" /></span>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-label-l text-on-surface-variant">Hours</h3>
                    <dl class="mt-1">
                      <div
                        v-for="h in site.hoursByDay"
                        :key="h.days"
                        class="flex items-baseline justify-between gap-x-3 py-2 border-b border-outline-variant last:border-b-0"
                      >
                        <dt class="text-body-m text-on-surface-variant">{{ h.days }}</dt>
                        <dd class="text-body-m font-bold text-on-surface text-right whitespace-nowrap">{{ h.hours }}</dd>
                      </div>
                    </dl>
                    <ul class="mt-3 space-y-1 text-body-s text-on-surface-variant">
                      <li v-for="n in site.hoursNotes" :key="n">{{ n }}</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </li>
          </ul>

          <!-- Map: only with a Maps Embed API key; otherwise the directions buttons above do the job -->
          <div v-if="mapEmbedUrl" class="rounded-shape-md overflow-hidden border border-outline-variant aspect-[4/3]">
            <iframe
              :title="`Map: ${site.courseName}`"
              class="w-full h-full border-0"
              loading="lazy"
              allowfullscreen
              referrerpolicy="no-referrer-when-downgrade"
              :src="mapEmbedUrl"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
// Contact form → POST /api/inquiries/contact { name, email, phone, subject, message } (all but phone required).
// Prefills: ?event=<name> (tournament registration until events have their own form) and ?subject=<key>
// (group | membership | tournament | teetime | proshop).
import { computed, nextTick, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import PageHero    from '@/components/layout/PageHero.vue'
import AppButton   from '@/components/ui/AppButton.vue'
import Card        from '@/components/ui/Card.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextArea    from '@/components/ui/TextArea.vue'
import TextField   from '@/components/ui/TextField.vue'
import * as site   from '@/data/site.js'
import IconCall from '~icons/material-symbols/call-rounded'
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded'
import IconDirections from '~icons/material-symbols/directions-rounded'
import IconLocation from '~icons/material-symbols/location-on-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconMap from '~icons/material-symbols/map-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconSend from '~icons/material-symbols/send-rounded'

const route = useRoute()

const SUBJECTS = {
  teetime:    'Tee Time / Booking Question',
  tournament: 'Tournament Information',
  group:      'Group Outing / Corporate Event',
  membership: 'Membership Inquiry',
  proshop:    'Pro Shop',
  other:      'Other',
}
const subjectOptions = Object.values(SUBJECTS).map(s => ({ value: s, label: s }))

const EMPTY = { name: '', email: '', phone: '', subject: null, message: '' }
const form = reactive({ ...EMPTY })
const touched = reactive({})
const submitted = ref(false)
const sent = ref(false)
const sentName = ref('')
const loading = ref(false)
const error = ref('')
const firstField = ref(null)
const formEl = ref(null)
const successHeading = ref(null)

function prefill() {
  // Tournament "Register" links here with ?event=<name> until events have their own registration form
  if (route.query.event) {
    form.subject = SUBJECTS.tournament
    form.message = `I'd like to register for ${String(route.query.event).slice(0, 200)}.\n\nPlayers / team: `
  } else if (SUBJECTS[route.query.subject]) {
    form.subject = SUBJECTS[route.query.subject]
  }
}
prefill()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const errors = computed(() => ({
  name:    form.name ? '' : 'Enter your name.',
  email:   !form.email ? 'Enter your email address.' : EMAIL_RE.test(form.email) ? '' : 'Enter an email address like name@example.com.',
  phone:   !form.phone || form.phone.replace(/\D/g, '').length >= 10 ? '' : 'Enter a 10-digit phone number, or leave it blank.',
  subject: form.subject ? '' : 'Choose a subject.',
  message: form.message.trim() ? '' : 'Enter your message.',
}))

function touch(field) { touched[field] = true }
function shown(field) { return (touched[field] || submitted.value) ? errors.value[field] : '' }

// Only embed the map with a real key (the .env.example placeholder starts with "your")
const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const mapEmbedUrl = mapsKey && !/^your/i.test(mapsKey)
  ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${encodeURIComponent(site.mapsQuery)}`
  : ''

async function submit() {
  submitted.value = true
  error.value = ''
  if (Object.values(errors.value).some(Boolean)) {
    await nextTick()
    formEl.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }
  loading.value = true
  try {
    const res = await fetch('/api/inquiries/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, phone: form.phone || null, message: form.message.trim() }),
    })
    // A non-JSON answer (e.g. the SPA's index.html) is a failure too, not a success
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`)
    sentName.value = form.name.split(/\s+/)[0]
    sent.value = true
    await nextTick()
    successHeading.value?.focus()
  } catch {
    error.value = `We couldn’t send your message. Please try again, or call the Pro Shop at ${site.phone.display}.`
  } finally {
    loading.value = false
  }
}

function reset() {
  Object.assign(form, EMPTY)
  for (const k of Object.keys(touched)) delete touched[k]
  submitted.value = false
  sent.value = false
  nextTick(() => firstField.value?.focus())
}
</script>

<style scoped>
.tile-icon {
  @apply w-12 h-12 flex-shrink-0 inline-flex items-center justify-center rounded-full bg-primary-container text-on-primary-container;
}
.tile-link {
  @apply inline-flex items-center min-h-[48px] text-title-m text-primary underline-offset-4 rounded-shape-xs;
}
.tile-link:hover { @apply underline; }
</style>
