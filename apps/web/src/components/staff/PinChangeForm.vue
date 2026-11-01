<template>
  <div class="flex flex-col items-center">
    <ErrorBanner v-if="error" class="mb-4 w-full max-w-[22rem]" :message="error" @dismiss="error = null" />
    <p class="w-full max-w-[22rem] mb-2 text-label-l text-on-surface-variant" aria-live="polite">
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
</template>

<script setup>
// Set or change one of the signed-in employee's PINs in steps on a keypad: current PIN (when one is set), new PIN,
// the new PIN again. PUTs { currentPin, newPin } to `endpoint` (/api/staff/pin: manager PIN; /api/staff/clock-pin: time
// clock PIN). Emits saved({ changed }) after it's saved.
import { ref, reactive, computed } from 'vue'
import { apiFetch } from '@/lib/api'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import IconBack from '~icons/material-symbols/arrow-back-rounded'

const props = defineProps({
  endpoint: { type: String, required: true },
  hasPin:   { type: Boolean, default: false },
})
const emit = defineEmits(['saved'])

const saving    = ref(false)
const error     = ref(null)
const pins      = reactive({ current: '', new: '', confirm: '' })
const stepIndex = ref(0)
// A message for the step being shown (e.g. "The PINs don't match")
const stepError = ref('')

const PIN = /^\d{4,6}$/

const steps = computed(() => [
  ...(props.hasPin ? [{ key: 'current', title: 'Current PIN', label: 'Current PIN', help: 'Enter the PIN you use now' }] : []),
  { key: 'new', title: props.hasPin ? 'New PIN' : 'Choose a PIN', label: props.hasPin ? 'New PIN' : 'PIN', help: '4 to 6 digits' },
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
    await apiFetch(props.endpoint, { method: 'PUT', body: { currentPin: pins.current, newPin: pins.new } })
    const changed = props.hasPin
    reset()
    emit('saved', { changed })
  } catch (e) {
    error.value = e.message
    reset()
  } finally {
    saving.value = false
  }
}

defineExpose({ reset })
</script>
