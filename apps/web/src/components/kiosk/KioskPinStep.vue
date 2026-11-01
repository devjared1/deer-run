<template>
  <section aria-labelledby="kiosk-pin-title" class="flex-1 flex flex-col md:flex-row items-center md:items-start justify-center gap-8 md:gap-16 pt-2 md:pt-8">
    <div class="text-center md:text-left md:pt-6 max-w-sm">
      <span
        class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary-container text-on-secondary-container text-headline-s"
        aria-hidden="true"
      >{{ initials(employee) }}</span>
      <h2 id="kiosk-pin-title" class="mt-4 font-display text-headline-l text-on-surface break-words">{{ fullName(employee) }}</h2>
      <p class="mt-1 text-body-l text-on-surface-variant">{{ positionLabel(employee.position) }}</p>
      <AppButton variant="text" size="lg" :icon="IconArrowBack" class="mt-6 -ml-3" @click="emit('back')">
        Not you? Back to the names
      </AppButton>
    </div>

    <div class="w-full max-w-[22rem]">
      <!-- No PIN yet, or locked: say how to fix it instead of a keypad that can't work -->
      <div v-if="!employee.hasPin || employee.pinLocked" class="rounded-shape-lg bg-surface-container-high p-6" role="status">
        <component :is="employee.pinLocked ? IconLock : IconPin" class="w-10 h-10 text-primary" aria-hidden="true" />
        <h3 class="mt-3 text-title-l text-on-surface">
          {{ employee.pinLocked ? 'Your PIN is locked' : 'You need a time clock PIN' }}
        </h3>
        <p class="mt-2 text-body-l text-on-surface-variant">
          <template v-if="employee.pinLocked">
            Too many wrong tries. Wait 15 minutes and try again, or ask a manager to set a new PIN.
          </template>
          <template v-else>
            Set one in the staff portal (Time Clock page) on your phone, or ask a manager to set one for you in
            Admin → Employees.
          </template>
        </p>
      </div>

      <template v-else>
        <!-- Big enough to read from a step back (the keypad's own hint line is small) -->
        <ErrorBanner v-if="error" class="mb-3" :message="error" />
        <NumericKeypad
          ref="keypad"
          :model-value="pin"
          label="Your PIN"
          masked
          left-key="clear"
          :max-length="6"
          hint="4 to 6 digits"
          submit-label="Continue"
          :loading="busy"
          :disabled="busy"
          autofocus
          @update:model-value="v => emit('update:pin', v)"
          @submit="emit('submit')"
        />
      </template>
    </div>
  </section>
</template>

<script setup>
// Time clock kiosk, step 2: the employee who was tapped, and a PIN keypad (or why they can't sign in: no PIN yet, or
// locked). v-model:pin; emits submit and back. The page checks the PIN (POST /api/kiosk/clock).
import { ref, watch } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import { positionLabel } from '@/data/employeePositions'
import { fullName, initials } from './kioskDisplay'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconLock from '~icons/material-symbols/lock-rounded'
import IconPin from '~icons/material-symbols/pin-rounded'

const props = defineProps({
  employee: { type: Object, required: true },
  pin:      { type: String, default: '' },
  error:    { type: String, default: '' },
  busy:     { type: Boolean, default: false },
})
const emit = defineEmits(['update:pin', 'submit', 'back'])

// After a wrong PIN the keypad clears; keep focus on it so a hardware keyboard works too
const keypad = ref(null)
watch(() => props.error, (e) => { if (e) keypad.value?.focus() })
</script>
