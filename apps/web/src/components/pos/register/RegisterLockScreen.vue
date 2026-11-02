<template>
  <div
    ref="root"
    role="dialog"
    aria-modal="true"
    aria-labelledby="register-lock-title"
    :class="[contained ? 'absolute' : 'fixed', 'inset-0 z-dialog flex flex-col bg-surface text-on-surface print:hidden']"
  >
    <header class="flex-none flex items-center gap-3 px-4 md:px-8 h-16 border-b border-outline-variant">
      <IconLock class="w-6 h-6 text-primary" aria-hidden="true" />
      <h1 id="register-lock-title" class="flex-1 min-w-0 truncate text-title-l">Register locked</h1>
      <AppButton variant="text" :icon="IconPassword" @click="emit('password')">
        <span class="sm:hidden">Password</span><span class="hidden sm:inline">Sign in with a password</span>
      </AppButton>
    </header>

    <div class="flex-1 min-h-0 flex flex-col px-4 md:px-8 pt-6 overflow-y-auto">
      <Skeleton v-if="!employees && !loadError" variant="text" :lines="4" label="Loading cashiers" />
      <ErrorBanner v-else-if="loadError" :message="loadError" @retry="load" />

      <!-- Picked someone who signs in with a password: say so instead of a keypad -->
      <section v-else-if="picked?.needsPassword" class="max-w-md mx-auto pt-8 text-center" aria-live="polite">
        <IconPassword class="w-12 h-12 mx-auto text-primary" aria-hidden="true" />
        <h2 class="mt-4 font-display text-headline-s">{{ picked.firstName }} signs in with a password</h2>
        <p class="mt-2 text-body-l text-on-surface-variant">Admin accounts can't be opened with a PIN.</p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <AppButton variant="text" :icon="IconArrowBack" @click="back">Back to the names</AppButton>
          <AppButton variant="gold" :icon="IconPassword" @click="emit('password')">Sign in with a password</AppButton>
        </div>
      </section>

      <KioskPinStep
        v-else-if="picked"
        v-model:pin="pin"
        :employee="picked"
        :error="error"
        :busy="busy"
        @submit="submit"
        @back="back"
      />

      <template v-else>
        <p v-if="currentName" class="mb-4 text-body-l text-on-surface-variant">
          {{ currentName }} was signed in. Tap your name to carry on, or someone else's to take over the register.
        </p>
        <KioskEmployeePicker v-model:search="search" :employees="employees" @pick="pick" />
      </template>
    </div>
  </div>
</template>

<script setup>
// The register PC's lock screen (Switch cashier, or REGISTER_IDLE_LOCK_MINUTES without a touch): whoever is next
// taps their name and enters their time clock PIN. The same cashier just unlocks; someone else is signed in on this PC
// with a one-time token (POST /api/staff/register/switch → authStore.signInWithTokenHash). Admin accounts, and anyone
// who'd rather, use "Sign in with a password". The rest of the page is inert while this is up.
// Props: contained (the /dev/ui preview: covers its box instead of the window). Emits: unlocked(name), password.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import KioskEmployeePicker from '@/components/kiosk/KioskEmployeePicker.vue'
import KioskPinStep from '@/components/kiosk/KioskPinStep.vue'
import IconLock from '~icons/material-symbols/lock-rounded'
import IconPassword from '~icons/material-symbols/password-rounded'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'

defineProps({
  contained: { type: Boolean, default: false },
})
const emit = defineEmits(['unlocked', 'password'])

const authStore = useAuthStore()
const root = ref(null)

const employees = ref(null)
const currentId = ref(null)
const loadError = ref(null)
const search    = ref('')
const picked    = ref(null)
const pin       = ref('')
const error     = ref('')
const busy      = ref(false)

const currentName = computed(() => {
  const e = employees.value?.find(x => x.id === currentId.value)
  return e ? `${e.firstName} ${e.lastName}`.trim() : ''
})

async function load() {
  loadError.value = null
  try {
    const res = await apiFetch('/api/staff/register/cashiers')
    employees.value = res.employees
    currentId.value = res.currentEmployeeId
  } catch (e) {
    loadError.value = e.message
  }
}

function pick(e) {
  picked.value = e
  pin.value = ''
  error.value = ''
}

function back() {
  picked.value = null
  pin.value = ''
  error.value = ''
}

async function submit() {
  if (!picked.value || busy.value || !pin.value) return
  busy.value = true
  error.value = ''
  const who = picked.value
  try {
    const res = await apiFetch('/api/staff/register/switch', { method: 'POST', body: { employeeId: who.id, pin: pin.value } })
    if (!res.same) await authStore.signInWithTokenHash(res.tokenHash)
    emit('unlocked', who.firstName)
  } catch (e) {
    error.value = e.message
    pin.value = ''
    // The PIN may have just locked: refresh the tile
    if (e.code === 'PIN_LOCKED') picked.value = { ...who, pinLocked: true }
  } finally {
    busy.value = false
  }
}

// Everything else on the page is inert (no clicks, focus or screen reader) while the register is locked
let inerted = []
onMounted(() => {
  load()
  const el = root.value
  inerted = [...(el?.parentElement?.children ?? [])].filter(sib => sib !== el && !sib.hasAttribute('inert'))
  inerted.forEach(sib => sib.setAttribute('inert', ''))
})
onBeforeUnmount(() => {
  inerted.forEach(sib => sib.removeAttribute('inert'))
})
</script>
