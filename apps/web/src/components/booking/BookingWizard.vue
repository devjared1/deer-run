<template>
  <div class="w-full mx-auto">
    <!-- Step indicator -->
    <div class="card rounded-lg p-5 mb-3">
      <div class="flex items-center gap-2">
        <div
          v-for="(step, i) in steps"
          :key="step"
          class="flex items-center gap-2 flex-1"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all"
              :style="currentStep > i + 1
                ? 'background:#1E3D2F;color:#F2EBD9;font-family:Lato,sans-serif;'
                : currentStep === i + 1
                  ? 'background:#C4873A;color:#0D1F16;font-family:Lato,sans-serif;'
                  : 'background:rgba(61,43,26,.12);color:rgba(61,43,26,.4);font-family:Lato,sans-serif;'"
            >
              <svg
                v-if="currentStep > i + 1"
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                viewBox="0 0 24 24"
              ><path d="M5 13l4 4L19 7" /></svg>
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span
              class="hidden sm:block text-xs font-bold uppercase tracking-wider truncate"
              :style="currentStep === i + 1
                ? 'font-family:Lato,sans-serif;color:#C4873A;'
                : 'font-family:Lato,sans-serif;color:rgba(61,43,26,.4);'"
            >
              {{ step }}
            </span>
          </div>
          <div
            v-if="i < steps.length - 1"
            class="flex-1 h-px"
            style="background:rgba(61,43,26,.12);min-width:8px;"
          />
        </div>
      </div>
    </div>

    <!-- Step content -->
    <Transition
      name="step-fade"
      mode="out-in"
    >
      <component
        :is="currentStepComponent"
        :key="currentStep"
        @next="nextStep"
        @back="prevStep"
      />
    </Transition>
  </div>
</template>

<script setup>
import { addDays, isValidYmd, localDate } from '@/lib/timeclock'
import { useBookingStore } from '@/stores/booking'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import StepDate from './StepDate.vue'
import StepDetails from './StepDetails.vue'
import StepPayment from './StepPayment.vue'
import StepTime from './StepTime.vue'

const steps = ['Date', 'Tee Time', 'Details', 'Payment']
const bookingStore = useBookingStore()
const route = useRoute()

// Prefill from the Home tee time search: /book?date=YYYY-MM-DD&players=N&time=morning|midday|afternoon.
// A valid date (today through the public booking window) starts the wizard on the tee time step.
const PUBLIC_BOOK_DAYS = 7
const TIMES_OF_DAY = ['morning', 'midday', 'afternoon']
function applyQuery(q) {
  const players = Number(q.players)
  if (Number.isInteger(players) && players >= 1 && players <= 4) bookingStore.players = players
  if (q.time !== undefined) bookingStore.timeOfDay = TIMES_OF_DAY.includes(q.time) ? q.time : null
  const today = localDate()
  const date = typeof q.date === 'string' ? q.date : ''
  if (!isValidYmd(date) || date < today || date > addDays(today, PUBLIC_BOOK_DAYS)) return false
  if (bookingStore.selectedDate !== date) bookingStore.selectedSlot = null
  bookingStore.selectedDate = date
  return true
}

// Back from signing in (StepDetails → /login?redirect=/book?resume=details): pick up at Details if a time is still chosen
const currentStep = ref(
  route.query.resume === 'details' && bookingStore.selectedSlot ? 3
    : applyQuery(route.query) ? 2
      : 1,
)

const stepMap = { 1: StepDate, 2: StepTime, 3: StepDetails, 4: StepPayment }
const currentStepComponent = computed(() => stepMap[currentStep.value])

function nextStep() {
  if (currentStep.value < steps.length) currentStep.value++
}
function prevStep() {
  if (currentStep.value > 1) currentStep.value--
}
</script>

<style scoped>
.step-fade-enter-active,
.step-fade-leave-active { transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.step-fade-enter-from { opacity: 0; transform: translateX(16px); }
.step-fade-leave-to  { opacity: 0; transform: translateX(-16px); }
</style>
