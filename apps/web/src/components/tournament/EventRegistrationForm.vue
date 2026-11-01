<template>
  <div>
    <!-- Sent -->
    <div v-if="sent" class="flex flex-col items-center text-center gap-3 py-4" role="status">
      <span class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-container text-on-success-container" aria-hidden="true">
        <IconTaskAlt class="w-8 h-8" />
      </span>
      <h3 class="text-title-l text-on-surface">Request sent</h3>
      <p class="text-body-m text-on-surface-variant max-w-xs">
        Thanks, {{ firstName }}. Your request for {{ event.name }} went to the pro shop, and they'll follow up at
        <span class="text-on-surface break-all">{{ sentTo }}</span> to confirm your spot.
      </p>
      <AppButton variant="text" :icon="IconAdd" @click="sent = false">Send another request</AppButton>
    </div>

    <form v-else novalidate class="space-y-4" @submit.prevent="submit">
      <TextField
        ref="nameField"
        v-model="form.name"
        label="Your name"
        name="name"
        autocomplete="name"
        required
        :error="errors.name"
      />
      <TextField
        ref="emailField"
        v-model="form.email"
        label="Email"
        type="email"
        name="email"
        autocomplete="email"
        inputmode="email"
        required
        :error="errors.email"
      />
      <TextField
        v-model="form.phone"
        label="Phone (optional)"
        type="tel"
        name="phone"
        autocomplete="tel"
        inputmode="tel"
      />
      <TextField
        v-model="form.players"
        label="Players or team (optional)"
        name="players"
        autocomplete="off"
        helper="How many are playing, and names or a team name"
        maxlength="200"
      />
      <TextArea
        v-model="form.message"
        label="Message (optional)"
        name="message"
        :rows="3"
        :maxlength="1000"
        auto-grow
      />

      <ErrorBanner v-if="submitError" :message="submitError" @dismiss="submitError = ''" />

      <AppButton type="submit" variant="gold" size="lg" block :loading="sending" :icon="IconSend">
        Send registration request
      </AppButton>
      <p class="text-body-s text-on-surface-variant">
        Sending this doesn't take a payment. The pro shop confirms your spot{{ event.entryLabel ? ' and how to pay the entry fee' : '' }}.
      </p>
    </form>
  </div>
</template>

<script setup>
// Registration / inquiry for one event. Posts to the existing contact endpoint (POST /api/inquiries/contact,
// subject "Tournament Information") with the event's name, date and link in the message; the pro shop follows up.
//   <EventRegistrationForm :event="event" />   (a normalizeEvent() object)
import { computed, nextTick, reactive, ref, watch } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import TextArea from '@/components/ui/TextArea.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAuthStore } from '@/stores/auth'
import { phone } from '@/data/site'
import { eventUrl } from './eventDisplay'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconSend from '~icons/material-symbols/send-rounded'
import IconTaskAlt from '~icons/material-symbols/task-alt-rounded'

const props = defineProps({
  event: { type: Object, required: true },
})

const auth = useAuthStore()
const form = reactive({ name: '', email: '', phone: '', players: '', message: '' })
const errors = reactive({ name: '', email: '' })
const sending = ref(false)
const sent = ref(false)
const sentTo = ref('')
const submitError = ref('')
const nameField = ref(null)
const emailField = ref(null)

// Signed in: start with the account's name and email (only into empty fields)
watch(() => auth.profile, (p) => {
  if (!p) return
  if (!form.name && p.name) form.name = p.name
  if (!form.email && p.email) form.email = p.email
}, { immediate: true })

const firstName = computed(() => form.name.trim().split(/\s+/)[0] || 'there')

// Clear a field's message as soon as it's fixed
watch(() => form.name, () => { if (errors.name && form.name.trim()) errors.name = '' })
watch(() => form.email, () => { if (errors.email && validEmail(form.email)) errors.email = '' })

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())
}

function validate() {
  errors.name = form.name.trim() ? '' : 'Enter your name'
  errors.email = !form.email.trim() ? 'Enter your email so the pro shop can reply' : validEmail(form.email) ? '' : 'Enter an email like name@example.com'
  return !errors.name && !errors.email
}

async function submit() {
  submitError.value = ''
  if (!validate()) {
    await nextTick()
    ;(errors.name ? nameField : emailField).value?.focus()
    return
  }
  const e = props.event
  const when = [e.dateLabel, e.timeLabel].filter(Boolean).join(', ')
  const message = [
    `Tournament registration request: ${e.name}${when ? ` (${when})` : ''}`,
    `Players / team: ${form.players.trim() || 'not given'}`,
    form.message.trim() ? `\n${form.message.trim()}` : '',
    `\nEvent page: ${eventUrl(e)}`,
  ].filter(Boolean).join('\n')

  sending.value = true
  try {
    const res = await fetch('/api/inquiries/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: 'Tournament Information',
        message,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    sentTo.value = form.email.trim()
    sent.value = true
    form.players = ''
    form.message = ''
  } catch {
    submitError.value = `Your request didn't go through. Please try again, or call the pro shop at ${phone.display}.`
  } finally {
    sending.value = false
  }
}
</script>
