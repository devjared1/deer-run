<template>
  <div class="max-w-md space-y-4">
    <Skeleton
      v-if="loading"
      variant="card"
      label="Loading"
    />
    <ErrorBanner
      v-else-if="loadError"
      :message="loadError"
      @retry="init"
    />

    <Card
      v-else
      padding="lg"
    >
      <p class="text-body-m text-on-surface-variant">
        Your manager PIN approves discounts, No Sale, voids and refunds when someone else is signed in at the
        register. Keep it private. If you forget it, an admin can reset it on the Employees page.
      </p>
      <ErrorBanner
        v-if="lockedUntil"
        class="mt-4"
        tone="warning"
        :icon="IconLock"
        :message="`Your PIN is locked after too many wrong tries until ${formatClockTime(lockedUntil)}.`"
      />

      <PinChangeForm class="mt-6" endpoint="/api/staff/pin" :has-pin="hasPin" @saved="onSaved" />
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatClockTime } from '@/lib/timeclock'
import { useSnackbar } from '@/composables/useSnackbar'
import Card from '@/components/ui/Card.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import PinChangeForm from '@/components/staff/PinChangeForm.vue'
import IconLock from '~icons/material-symbols/lock-rounded'

const snackbar = useSnackbar()

const loading     = ref(true)
const loadError   = ref(null)
const hasPin      = ref(false)
const lockedUntil = ref(null)

function onSaved({ changed }) {
  hasPin.value = true
  lockedUntil.value = null
  snackbar.show(changed ? 'PIN changed' : 'PIN set')
}

async function init() {
  loading.value   = true
  loadError.value = null
  try {
    const data = await apiFetch('/api/staff/pin')
    hasPin.value = data.hasPin
    lockedUntil.value = data.lockedUntil
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(init)
</script>
