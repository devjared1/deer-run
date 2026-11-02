<template>
  <div class="w-full max-w-md mx-auto rounded-shape-md border border-outline-variant bg-surface-container-lowest p-4 text-left">
    <!-- Joined -->
    <div v-if="joined" role="status" class="flex items-start gap-3">
      <IconCheck class="w-6 h-6 flex-none text-success" aria-hidden="true" />
      <div>
        <p class="text-title-s text-on-surface">You're on the waitlist</p>
        <p class="text-body-m text-on-surface-variant">
          We'll email {{ joined.email }} if a time for {{ plural(joined.players, 'player') }} opens up on {{ dayLabel }}.
          Times go to whoever books first.
        </p>
      </div>
    </div>

    <form v-else class="space-y-3" @submit.prevent="submit">
      <div class="flex items-start gap-3">
        <IconNotify class="w-6 h-6 flex-none text-primary" aria-hidden="true" />
        <div>
          <p class="text-title-s text-on-surface">Tell me if a time opens up</p>
          <p class="text-body-m text-on-surface-variant">
            One email if someone cancels and there's room for {{ plural(players, 'player') }} on {{ dayLabel }}.
          </p>
        </div>
      </div>
      <template v-if="!auth.isLoggedIn">
        <TextField v-model="name" label="Your name" autocomplete="name" required />
        <TextField v-model="email" label="Email" type="email" autocomplete="email" inputmode="email" required />
      </template>
      <ErrorBanner v-if="error" :message="error" />
      <AppButton type="submit" variant="tonal" :icon="IconNotify" :loading="busy" class="w-full">Join the waitlist</AppButton>
    </form>
  </div>
</template>

<script setup>
// "Tell me if a time opens up" for a day with no room for the group (booking Time step): POST /api/waitlist.
// Signed-in golfers join with one tap (their account's name and email); guests type both.
// Props: date ("YYYY-MM-DD"), players.
import { computed, ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatLocalDate } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import TextField from '@/components/ui/TextField.vue'
import { plural } from './bookingFlow'
import IconNotify from '~icons/material-symbols/notifications-active-rounded'
import IconCheck from '~icons/material-symbols/check-circle-rounded'

const props = defineProps({
  date:    { type: String, required: true },
  players: { type: Number, required: true },
})

const auth = useAuthStore()
const name   = ref('')
const email  = ref('')
const busy   = ref(false)
const error  = ref(null)
const joined = ref(null) // { email, players } once on the list

const dayLabel = computed(() => formatLocalDate(props.date, { weekday: 'long', month: 'short', day: 'numeric' }))

// Another day or group size is another waitlist entry
watch(() => [props.date, props.players], () => { joined.value = null; error.value = null })

async function submit() {
  busy.value = true
  error.value = null
  try {
    const res = await apiFetch('/api/waitlist', {
      method: 'POST',
      body: { date: props.date, players: props.players, name: name.value.trim(), email: email.value.trim() },
    })
    joined.value = { email: res.email, players: res.players }
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>
