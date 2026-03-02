<template>
  <div>
    <!-- Step indicator -->
    <div class="card rounded-lg p-5 mb-6">
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
              <svg v-if="currentStep > i + 1" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
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
          <div v-if="i < steps.length - 1" class="flex-1 h-px" style="background:rgba(61,43,26,.12);min-width:8px;"></div>
        </div>
      </div>
    </div>

    <!-- Step content -->
    <Transition name="step-fade" mode="out-in">
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
import { ref, computed, shallowRef } from 'vue'
import { useBookingStore } from '@/stores/booking'
import StepDate from './StepDate.vue'
import StepTime from './StepTime.vue'
import StepDetails from './StepDetails.vue'
import StepPayment from './StepPayment.vue'

const steps = ['Date', 'Tee Time', 'Details', 'Payment']
const currentStep = ref(1)
const bookingStore = useBookingStore()

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
