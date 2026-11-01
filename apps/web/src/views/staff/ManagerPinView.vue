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
      <ErrorBanner
        v-if="error"
        class="mt-4"
        :message="error"
        @dismiss="error = null"
      />

      <div class="mt-6 flex flex-col items-center">
        <p
          class="w-full max-w-[22rem] mb-2 text-label-l text-on-surface-variant"
          aria-live="polite"
        >
          Step {{ stepIndex + 1 }} of {{ steps.length }}: {{ step.title }}
        </p>
        <NumericKeypad
          :key="step.key"
          v-model="pins[step.key]"
          :label="step.label"
          masked
          autofocus
          :max-length="6"
          :hint="hint.text"
          :error="hint.error"
          :submit-label="isLast ? (hasPin ? 'Change PIN' : 'Set PIN') : 'Next'"
          :loading="saving"
          @submit="next"
        />
        <AppButton
          v-if="stepIndex > 0"
          variant="text"
          :icon="IconBack"
          class="mt-2"
          :disabled="saving"
          @click="back"
        >
          Back
        </AppButton>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatClockTime } from '@/lib/timeclock'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import IconBack from '~icons/material-symbols/arrow-back-rounded'
import IconLock from '~icons/material-symbols/lock-rounded'

const snackbar = useSnackbar()

const loading     = ref(true)
const loadError   = ref(null)
const hasPin      = ref(false)
const lockedUntil = ref(null)
const saving      = ref(false)
const error       = ref(null)
const pins        = reactive({ current: '', new: '', confirm: '' })
const stepIndex   = ref(0)
// A message for the step being shown (e.g. "The PINs don't match")
const stepError   = ref('')

const PIN = /^\d{4,6}$/

const steps = computed(() => [
  ...(hasPin.value ? [{ key: 'current', title: 'Current PIN', label: 'Current PIN', help: 'Enter the PIN you use now' }] : []),
  { key: 'new', title: hasPin.value ? 'New PIN' : 'Choose a PIN', label: hasPin.value ? 'New PIN' : 'PIN', help: '4 to 6 digits' },
  { key: 'confirm', title: 'Confirm', label: 'Enter it again', help: 'The same digits once more' },
])
const step   = computed(() => steps.value[stepIndex.value])
const isLast = computed(() => stepIndex.value === steps.value.length - 1)
const hint   = computed(() => (stepError.value ? { text: stepError.value, error: true } : { text: step.value.help, error: false }))

function reset() {
  pins.current = pins.new = pins.confirm = ''
  stepIndex.value = 0
  stepError.value = ''
}

function back() {
  stepError.value = ''
  pins[step.value.key] = ''
  stepIndex.value = Math.max(0, stepIndex.value - 1)
}

async function next() {
  const value = pins[step.value.key]
  if (!PIN.test(value)) {
    stepError.value = 'Use 4 to 6 digits'
    return
  }
  stepError.value = ''
  if (step.value.key === 'confirm' && pins.confirm !== pins.new) {
    pins.new = pins.confirm = ''
    stepIndex.value = steps.value.findIndex(s => s.key === 'new')
    stepError.value = "The PINs don't match. Enter the new PIN again."
    return
  }
  if (!isLast.value) {
    stepIndex.value++
    return
  }
  await save()
}

async function save() {
  saving.value = true
  error.value  = null
  try {
    await apiFetch('/api/staff/pin', { method: 'PUT', body: { currentPin: pins.current, newPin: pins.new } })
    const changed = hasPin.value
    hasPin.value = true
    lockedUntil.value = null
    reset()
    snackbar.show(changed ? 'PIN changed' : 'PIN set')
  } catch (e) {
    error.value = e.message
    reset()
  } finally {
    saving.value = false
  }
}

async function init() {
  loading.value   = true
  loadError.value = null
  try {
    const data = await apiFetch('/api/staff/pin')
    hasPin.value = data.hasPin
    lockedUntil.value = data.lockedUntil
    reset()
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(init)
</script>
