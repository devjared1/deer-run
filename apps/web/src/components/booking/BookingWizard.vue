<template>
  <div class="w-full mx-auto">
    <!-- Progress: completed steps link back, the current one is aria-current="step" -->
    <nav aria-label="Booking steps" class="mb-4">
      <p class="sm:hidden text-label-l text-on-surface-variant mb-2">
        Step {{ stepIndex + 1 }} of {{ STEPS.length }}: <span class="text-on-surface">{{ STEPS[stepIndex].label }}</span>
      </p>
      <ol class="flex items-center gap-1 sm:gap-2">
        <li
          v-for="(s, i) in STEPS"
          :key="s.key"
          :class="['flex items-center gap-1 sm:gap-2', i < STEPS.length - 1 ? 'flex-1' : '']"
          :aria-current="i === stepIndex ? 'step' : undefined"
        >
          <component
            :is="i < stepIndex ? 'button' : 'span'"
            :type="i < stepIndex ? 'button' : undefined"
            :class="[
              'inline-flex items-center gap-2 rounded-full min-h-12 sm:pr-3 no-underline',
              i < stepIndex ? 'state-layer cursor-pointer' : '',
            ]"
            :aria-label="i < stepIndex ? `${s.label}, done. Go back to this step` : undefined"
            @click="i < stepIndex ? goTo(s.key) : undefined"
          >
            <span
              :class="[
                'inline-flex items-center justify-center w-8 h-8 rounded-full text-label-l flex-shrink-0 transition-colors duration-short-4 ease-standard',
                i < stepIndex ? 'bg-primary text-on-primary'
                : i === stepIndex ? 'bg-gold text-on-gold'
                  : 'bg-surface-container-highest text-on-surface-variant',
              ]"
              aria-hidden="true"
            >
              <IconCheck v-if="i < stepIndex" class="w-5 h-5" />
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span
              :class="[
                'hidden sm:inline text-label-l',
                i === stepIndex ? 'text-on-surface' : 'text-on-surface-variant',
              ]"
            >{{ s.label }}</span>
            <span v-if="i >= stepIndex" class="sr-only sm:hidden">{{ s.label }}{{ i === stepIndex ? ', current step' : '' }}</span>
          </component>
          <span
            v-if="i < STEPS.length - 1"
            :class="['flex-1 h-0.5 min-w-2 rounded-full', i < stepIndex ? 'bg-primary' : 'bg-outline-variant']"
            aria-hidden="true"
          />
        </li>
      </ol>
    </nav>

    <!-- Step content -->
    <Transition :name="direction === 'back' ? 'step-back' : 'step-forward'" mode="out-in" @after-enter="focusHeading">
      <component
        :is="STEP_COMPONENTS[step]"
        :key="step"
        ref="stepRef"
        @next="next"
        @back="back"
        @go="goTo"
      />
    </Transition>
  </div>
</template>

<script setup>
// Booking wizard. The step lives in the URL (/book, /book?step=time|details|payment), so browser Back/Forward move
// between steps; a step whose prerequisites aren't set falls back to the first missing one. Also handles:
//   /book?date=YYYY-MM-DD&players=N&time=morning|midday|afternoon  — the Home tee time search (starts on Time)
//   /book?resume=details                                          — back from signing in (StepDetails)
import { addDays, isValidYmd, localDate } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconCheck from '~icons/material-symbols/check-rounded'
import { STEPS } from './bookingFlow'
import StepDate from './StepDate.vue'
import StepDetails from './StepDetails.vue'
import StepPayment from './StepPayment.vue'
import StepTime from './StepTime.vue'

const STEP_COMPONENTS = { date: StepDate, time: StepTime, details: StepDetails, payment: StepPayment }
const KEYS = STEPS.map(s => s.key)
const TIMES_OF_DAY = ['morning', 'midday', 'afternoon']

const store = useBookingStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const stepRef = ref(null)
const direction = ref('forward')

// The first step that can't be shown yet: a date in the booking window, then a time, then the golfer's details
function firstMissing() {
  const today = localDate()
  if (store.selectedDate && (store.selectedDate < today || store.selectedDate > addDays(today, auth.maxBookDays))) {
    store.selectedDate = null
    store.selectedSlot = null
  }
  if (!store.selectedDate) return 'date'
  if (!store.selectedSlot) return 'time'
  if (!store.detailsComplete) return 'details'
  return null
}
function allowedStep(requested) {
  const missing = firstMissing()
  if (!missing) return requested
  return KEYS.indexOf(requested) <= KEYS.indexOf(missing) ? requested : missing
}
const queryFor = key => (key === 'date' ? {} : { step: key })

// Home prefill: a valid date in the booking window starts on the Time step
function applyPrefill(q) {
  const players = Number(q.players)
  if (Number.isInteger(players) && players >= 1 && players <= 4) store.players = players
  if (q.time !== undefined) store.timeOfDay = TIMES_OF_DAY.includes(q.time) ? q.time : null
  const today = localDate()
  const date = typeof q.date === 'string' ? q.date : ''
  if (!isValidYmd(date) || date < today || date > addDays(today, auth.maxBookDays)) return false
  if (store.selectedDate !== date) store.selectedSlot = null
  store.selectedDate = date
  return true
}

// Normalize the first URL: prefill / resume become a plain ?step=
const q = route.query
let initial = KEYS.includes(q.step) ? q.step : 'date'
if (q.resume === 'details') initial = 'details'
else if (q.date || q.players || q.time) initial = applyPrefill(q) ? 'time' : 'date'
initial = allowedStep(initial)
const needsReplace = q.resume || q.date || q.players || q.time || (q.step || 'date') !== initial
if (needsReplace) router.replace({ query: queryFor(initial) })

const step = ref(initial)
const stepIndex = computed(() => KEYS.indexOf(step.value))

// Back/Forward (or a typed URL) changes the query: show that step, or the first one still missing
watch(() => route.query.step, (s) => {
  if (route.path !== '/book') return
  const requested = KEYS.includes(s) ? s : 'date'
  const allowed = allowedStep(requested)
  if (allowed !== requested) {
    router.replace({ query: queryFor(allowed) })
    return
  }
  if (allowed === step.value) return
  direction.value = KEYS.indexOf(allowed) < KEYS.indexOf(step.value) ? 'back' : 'forward'
  step.value = allowed
})

function goTo(key) {
  if (key === step.value) return
  router.push({ query: queryFor(key) })
}
function next() {
  const i = stepIndex.value
  if (i < KEYS.length - 1) goTo(KEYS[i + 1])
}
// The in-page Back: a history step when the previous entry is the previous step (so Forward still works), else a push
function back() {
  const i = stepIndex.value
  if (i === 0) return
  const prev = KEYS[i - 1]
  const prevHref = router.resolve({ path: '/book', query: queryFor(prev) }).fullPath
  if (window.history.state?.back === prevHref) router.back()
  else router.push({ query: queryFor(prev) })
}

// Focus the new step's heading (tabindex=-1) once it's in; not on the first render
function focusHeading(el) {
  nextTick(() => {
    const h = el?.querySelector?.('[data-step-heading]')
    h?.focus({ preventScroll: true })
    if (!h) return
    const top = h.getBoundingClientRect().top
    // Below the sticky header (64/72px) or off screen: bring it into view
    if (top < 80 || top > window.innerHeight - 120) h.scrollIntoView({ block: 'start' })
  })
}
</script>

<style scoped>
.step-forward-enter-active,
.step-forward-leave-active,
.step-back-enter-active,
.step-back-leave-active {
  transition: opacity var(--md-sys-motion-duration-short4, 200ms) var(--md-sys-motion-easing-standard, ease),
    transform var(--md-sys-motion-duration-short4, 200ms) var(--md-sys-motion-easing-standard, ease);
}
.step-forward-enter-from, .step-back-leave-to { opacity: 0; transform: translateX(16px); }
.step-forward-leave-to, .step-back-enter-from { opacity: 0; transform: translateX(-16px); }
@media (prefers-reduced-motion: reduce) {
  .step-forward-enter-active, .step-forward-leave-active, .step-back-enter-active, .step-back-leave-active { transition: none; }
  .step-forward-enter-from, .step-forward-leave-to, .step-back-enter-from, .step-back-leave-to { transform: none; }
}
</style>
