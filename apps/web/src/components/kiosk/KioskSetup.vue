<template>
  <section aria-labelledby="kiosk-setup-title" class="flex-1 flex items-start justify-center pt-4 md:pt-12">
    <div class="w-full max-w-xl rounded-shape-xl bg-surface-container-low shadow-elevation-1 p-6 md:p-8">
      <IconTablet class="w-12 h-12 text-primary" aria-hidden="true" />
      <h2 id="kiosk-setup-title" class="mt-3 font-display text-headline-m text-on-surface">Set up this device as a time clock</h2>

      <ErrorBanner v-if="notice" class="mt-4" tone="warning" :message="notice" />

      <template v-if="isAdmin">
        <p class="mt-2 text-body-l text-on-surface-variant">
          Employees will tap their name here and clock in with their PIN. You'll be signed out once it's set up, so
          nobody is left signed in on this device.
        </p>
        <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
          <TextField
            v-model="name"
            label="Name for this time clock"
            helper="Shown in Admin → Settings → Payroll, where you can remove it later"
            maxlength="60"
            required
            :error="error"
          />
          <AppButton type="submit" size="xl" block :icon="IconCheck" :loading="busy">
            Set up this device
          </AppButton>
        </form>
      </template>

      <template v-else>
        <p class="mt-2 text-body-l text-on-surface-variant">
          An admin signs in once on this device to turn it into the time clock. After that nobody needs to be signed in:
          employees use their own time clock PIN.
        </p>
        <AppButton :to="{ path: '/login', query: { redirect: '/timeclock' } }" size="xl" block :icon="IconLogin" class="mt-6">
          Admin sign in
        </AppButton>
        <p v-if="signedInAs" class="mt-3 text-body-m text-on-surface-variant">
          Signed in as {{ signedInAs }}, who isn't an admin.
        </p>
      </template>
    </div>
  </section>
</template>

<script setup>
// Time clock kiosk before it's set up: an admin names the device and it gets a kiosk token (POST /api/admin/kiosks,
// done by the page). Emits setup(name).
import { ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import TextField from '@/components/ui/TextField.vue'
import IconTablet from '~icons/material-symbols/tablet-mac-rounded'
import IconCheck from '~icons/material-symbols/check-rounded'
import IconLogin from '~icons/material-symbols/login-rounded'

const props = defineProps({
  isAdmin:    { type: Boolean, default: false },
  signedInAs: { type: String, default: '' },
  busy:       { type: Boolean, default: false },
  error:      { type: String, default: '' },
  // e.g. "This device was removed as a time clock"
  notice:     { type: String, default: '' },
})
const emit = defineEmits(['setup'])

const name = ref('Pro shop iPad')
function submit() {
  if (!props.busy) emit('setup', name.value.trim())
}
</script>
