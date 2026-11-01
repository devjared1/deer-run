<template>
  <Card padding="none" class="max-w-2xl mx-auto">
    <div class="p-6 md:p-8">
      <!-- Success -->
      <div v-if="sent" class="text-center py-4" role="status">
        <span class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-container text-on-success-container mb-4" aria-hidden="true">
          <IconCheckCircle class="w-9 h-9" />
        </span>
        <h2 ref="successHeading" tabindex="-1" class="font-display text-headline-s text-on-surface">Inquiry received</h2>
        <p class="mt-2 text-body-l text-on-surface-variant max-w-md mx-auto">
          Thanks, {{ sentName }}. Our Pro Shop staff will contact you within one business day.
          We look forward to welcoming you to Deer Run.
        </p>
        <AppButton variant="outlined" class="mt-6" @click="reset">Send another inquiry</AppButton>
      </div>

      <!-- Form -->
      <form v-else novalidate aria-labelledby="membership-inquiry-title" @submit.prevent="submit">
        <p class="text-label-l uppercase tracking-[.2em] text-gold-text mb-2">Get started</p>
        <h2 id="membership-inquiry-title" class="font-display text-headline-m text-on-surface">Membership inquiry</h2>
        <p class="mt-2 mb-6 text-body-m text-on-surface-variant">
          Tell us a little about you and our Pro Shop staff will contact you within one business day.
          Fields marked * are required.
        </p>

        <ErrorBanner v-if="error" class="mb-5" :message="error" @dismiss="error = ''" />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
          <TextField
            ref="firstField"
            v-model.trim="form.firstName"
            label="First name"
            name="firstName"
            autocomplete="given-name"
            required
            :error="shown('firstName')"
            @blur="touch('firstName')"
          />
          <TextField
            v-model.trim="form.lastName"
            label="Last name"
            name="lastName"
            autocomplete="family-name"
            required
            :error="shown('lastName')"
            @blur="touch('lastName')"
          />
          <TextField
            v-model.trim="form.email"
            class="sm:col-span-2"
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
            class="sm:col-span-2"
            label="Phone"
            type="tel"
            name="phone"
            autocomplete="tel"
            inputmode="tel"
            helper="Optional, if you'd rather we call"
            :error="shown('phone')"
            @blur="touch('phone')"
          />
          <SelectField
            v-model="form.tier"
            class="sm:col-span-2"
            label="Membership plan"
            name="tier"
            placeholder="Choose a plan"
            :options="tierOptions"
            required
            :error="shown('tier')"
            @blur="touch('tier')"
          />
          <TextArea
            v-model="form.message"
            class="sm:col-span-2"
            label="Message"
            name="message"
            helper="Optional: questions, family plan needs, a good time to call"
            :rows="3"
            :maxlength="2000"
            auto-grow
          />
        </div>

        <AppButton type="submit" variant="gold" size="lg" block class="mt-6" :loading="loading" :icon="IconSend">
          {{ loading ? 'Sending…' : 'Send inquiry' }}
        </AppButton>
      </form>
    </div>
  </Card>
</template>

<script setup>
// Membership inquiry → POST /api/inquiries/membership { firstName, lastName, email, phone, tier, message }
// (firstName, lastName, email and tier are required by the API). Validates inline (after a field is left, and all
// at once on submit, focusing the first problem). The parent preselects a tier with `preSelectedTier` and calls
// the exposed focus() after scrolling here.
import { computed, nextTick, reactive, ref, watch } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextArea from '@/components/ui/TextArea.vue'
import TextField from '@/components/ui/TextField.vue'
import { membershipTiers } from '@/data/membershipTiers'
import { phone as coursePhone } from '@/data/site.js'
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded'
import IconSend from '~icons/material-symbols/send-rounded'

const props = defineProps({
  preSelectedTier: { type: String, default: '' },
})

const tierOptions = membershipTiers.map(t => ({
  value: t.name,
  label: `${t.name} · $${t.annual.toLocaleString('en-US')}/yr`,
}))

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', tier: null, message: '' }
const form = reactive({ ...EMPTY })
const touched = reactive({})
const submitted = ref(false)
const sent = ref(false)
const sentName = ref('')
const loading = ref(false)
const error = ref('')
const firstField = ref(null)
const successHeading = ref(null)

watch(() => props.preSelectedTier, (val) => {
  if (val) form.tier = val
}, { immediate: true })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const errors = computed(() => ({
  firstName: form.firstName ? '' : 'Enter your first name.',
  lastName:  form.lastName ? '' : 'Enter your last name.',
  email:     !form.email ? 'Enter your email address.' : EMAIL_RE.test(form.email) ? '' : 'Enter an email address like name@example.com.',
  phone:     !form.phone || form.phone.replace(/\D/g, '').length >= 10 ? '' : 'Enter a 10-digit phone number, or leave it blank.',
  tier:      form.tier ? '' : 'Choose the plan you’re interested in.',
}))
const ORDER = ['firstName', 'lastName', 'email', 'phone', 'tier']

function touch(field) { touched[field] = true }
function shown(field) { return (touched[field] || submitted.value) ? errors.value[field] : '' }

async function submit() {
  submitted.value = true
  error.value = ''
  const firstBad = ORDER.find(f => errors.value[f])
  if (firstBad) {
    // aria-invalid fields in DOM order: focus the first one so screen readers hear its message
    await nextTick()
    document.querySelector('[aria-labelledby="membership-inquiry-title"] [aria-invalid="true"]')?.focus()
    return
  }
  loading.value = true
  try {
    const res = await fetch('/api/inquiries/membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, phone: form.phone || null, message: form.message.trim() || null }),
    })
    // A non-JSON answer (e.g. the SPA's index.html) is a failure too, not a success
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`)
    sentName.value = form.firstName
    sent.value = true
    await nextTick()
    successHeading.value?.focus()
  } catch {
    error.value = `We couldn’t send your inquiry. Please try again, or call the Pro Shop at ${coursePhone.display}.`
  } finally {
    loading.value = false
  }
}

function reset() {
  Object.assign(form, EMPTY, { tier: props.preSelectedTier || null })
  for (const k of Object.keys(touched)) delete touched[k]
  submitted.value = false
  sent.value = false
  nextTick(() => firstField.value?.focus())
}

defineExpose({
  focus: () => (sent.value ? successHeading.value?.focus() : firstField.value?.focus()),
})
</script>
