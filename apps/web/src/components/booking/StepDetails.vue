<template>
  <section class="rounded-shape-md bg-surface-container-low shadow-elevation-1 px-4 sm:px-6 pt-3 sm:pt-4 pb-6" aria-labelledby="step-details-title">
    <div class="flex items-center gap-1 -ml-3">
      <IconButton :icon="IconArrowBack" label="Back to tee times" @click="emit('back')" />
      <h2
        id="step-details-title"
        data-step-heading
        tabindex="-1"
        class="font-display text-headline-s text-on-surface scroll-mt-24 focus:outline-none focus-visible:outline-none"
      >
        Your details
      </h2>
    </div>
    <p class="text-body-m text-on-surface-variant mt-1 mb-5">
      <span class="text-on-surface">{{ dateLabel }} · {{ timeLabel }}</span> · {{ plural(store.players, 'player') }}
    </p>

    <form novalidate class="space-y-6" @submit.prevent="proceed">
      <!-- Who is booking -->
      <div v-if="auth.isLoggedIn" class="flex items-start gap-3 rounded-shape-md bg-surface-container-lowest border border-outline-variant p-4">
        <IconPerson class="w-6 h-6 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="min-w-0">
          <p class="text-title-s text-on-surface">
            Booking as {{ auth.profile?.name || auth.profile?.email }}{{ auth.isMember ? ' (member)' : '' }}
          </p>
          <p class="text-body-s text-on-surface-variant break-words">
            The confirmation goes to {{ auth.profile?.email }}. Manage the booking from My Account.
          </p>
        </div>
      </div>

      <template v-else>
        <div>
          <p class="text-label-l text-on-surface mb-2" aria-hidden="true">Book as</p>
          <SegmentedButton v-model="mode" label="Book as" block size="lg" :options="MODE_OPTIONS" />
        </div>

        <div v-if="mode === 'guest'" class="space-y-4">
          <TextField
            ref="nameField"
            v-model="store.guestName"
            label="Full name"
            name="name"
            autocomplete="name"
            autocapitalize="words"
            required
            :error="showError('name')"
            @blur="touched.name = true"
          />
          <TextField
            ref="emailField"
            v-model="store.guestEmail"
            label="Email"
            type="email"
            name="email"
            autocomplete="email"
            inputmode="email"
            autocapitalize="off"
            spellcheck="false"
            required
            helper="Your confirmation and receipt go here"
            :error="showError('email')"
            @blur="touched.email = true"
          />
        </div>

        <div v-else class="rounded-shape-md bg-surface-container-lowest border border-outline-variant p-4 space-y-3">
          <p class="text-body-m text-on-surface">
            Sign in to book under your account: members book 14 days ahead and can cancel from My Account.
            Your selection is kept.
          </p>
          <AppButton variant="filled" :to="{ path: '/login', query: { redirect: '/book?resume=details' } }" :icon="IconLogin">
            Sign in to continue
          </AppButton>
        </div>
      </template>

      <!-- The round -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p class="text-label-l text-on-surface mb-2" aria-hidden="true">Holes</p>
          <SegmentedButton v-model="store.roundHoles" label="Holes" block size="lg" :options="HOLE_OPTIONS" />
        </div>
        <div>
          <p class="text-label-l text-on-surface mb-2" aria-hidden="true">Cart</p>
          <SegmentedButton v-model="store.cart" label="Cart" block size="lg" :options="CART_OPTIONS" />
        </div>
      </div>

      <!-- Price -->
      <dl class="rounded-shape-md bg-gold-container/40 border border-outline-variant p-4 space-y-2 text-body-m text-on-surface">
        <div class="flex justify-between gap-4">
          <dt>Greens fee, {{ store.roundHoles }} holes ({{ weekend ? 'weekend/holiday' : 'weekday' }}) · {{ store.players }} × {{ formatCents(store.price.greensCents) }}</dt>
          <dd class="tabular-nums">{{ formatCents(store.price.greensCents * store.players) }}</dd>
        </div>
        <div v-if="store.cart" class="flex justify-between gap-4">
          <dt>Cart · {{ store.players }} × {{ formatCents(store.price.cartCents) }}</dt>
          <dd class="tabular-nums">{{ formatCents(store.price.cartCents * store.players) }}</dd>
        </div>
        <div class="flex justify-between gap-4 pt-2 border-t border-outline-variant text-title-m">
          <dt>Total</dt>
          <dd class="tabular-nums">{{ formatCents(store.price.totalCents) }}</dd>
        </div>
      </dl>

      <AppButton
        type="submit"
        variant="gold"
        size="lg"
        block
        :disabled="!auth.isLoggedIn && mode === 'member'"
        :trailing-icon="IconArrowForward"
      >
        Continue to payment
      </AppButton>
    </form>
  </section>
</template>

<script setup>
// Booking step 3: who's booking (guest, or sign in and come back to this step), the round (9/18, riding/walking)
// and the price. No phone field: Booking has no phone column and POST /api/bookings doesn't take one.
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import TextField from '@/components/ui/TextField.vue'
import { formatCents } from '@/lib/money'
import { isWeekendRate } from '@/lib/rates'
import { teeTime } from '@/lib/teesheet'
import { formatLocalDate } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import IconGolfCart from '~icons/deer/golf-cart'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconLogin from '~icons/material-symbols/login-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'
import IconWalk from '~icons/material-symbols/directions-walk-rounded'
import { plural } from './bookingFlow'

const emit = defineEmits(['next', 'back'])
const store = useBookingStore()
const auth = useAuthStore()
onMounted(() => store.loadRates())

const MODE_OPTIONS = [{ value: 'guest', label: 'Guest' }, { value: 'member', label: 'Sign in' }]
const HOLE_OPTIONS = [{ value: 9, label: '9 holes' }, { value: 18, label: '18 holes' }]
const CART_OPTIONS = [{ value: true, label: 'Riding', icon: IconGolfCart }, { value: false, label: 'Walking', icon: IconWalk }]

const mode = ref('guest')
const touched = reactive({ name: false, email: false })
const submitted = ref(false)
const nameField = ref(null)
const emailField = ref(null)

const dateLabel = computed(() => (store.selectedDate ? formatLocalDate(store.selectedDate, { weekday: 'long', month: 'long', day: 'numeric' }) : ''))
const timeLabel = computed(() => (store.selectedSlot ? teeTime(store.selectedSlot.startTime) : ''))
const weekend = computed(() => !!store.selectedDate && isWeekendRate(store.selectedDate, store.holidayDates))

// Errors show once a field was left, or after Continue
const showError = key => ((touched[key] || submitted.value) ? store.guestErrors[key] : '')

function proceed() {
  submitted.value = true
  if (!auth.isLoggedIn) {
    if (mode.value !== 'guest') return
    if (store.guestErrors.name) return nextTick(() => nameField.value?.focus())
    if (store.guestErrors.email) return nextTick(() => emailField.value?.focus())
  }
  emit('next')
}
</script>
