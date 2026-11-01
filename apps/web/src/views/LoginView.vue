<template>
  <div class="bg-surface min-h-[70vh]">
    <div class="max-w-md mx-auto px-4 sm:px-6 py-10 md:py-16">
      <!-- Compact header -->
      <div class="flex flex-col items-center text-center mb-6">
        <RouterLink to="/" class="inline-flex rounded-shape-sm mb-4" aria-label="Deer Run Golf Course, home">
          <BrandLogo :size="72" eager alt="" />
        </RouterLink>
        <h1 ref="heading" tabindex="-1" class="font-display text-headline-l text-on-surface">{{ titles[mode] }}</h1>
        <p v-if="subtitles[mode]" class="mt-2 text-body-m text-on-surface-variant">{{ subtitles[mode] }}</p>
      </div>

      <Card padding="none">
        <div class="p-6 md:p-8">
          <!-- Sign in / Create account switch -->
          <SegmentedButton
            v-if="mode === 'signin' || mode === 'signup'"
            :model-value="mode"
            :options="[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]"
            label="Sign in or create an account"
            block
            class="mb-6"
            @update:model-value="switchMode"
          />

          <ErrorBanner v-if="error" class="mb-5" :message="error" @dismiss="error = ''" />

          <!-- Sign in -->
          <form v-if="mode === 'signin'" ref="formEl" novalidate class="space-y-4" aria-label="Sign in" @submit.prevent="signIn">
            <TextField
              v-model.trim="email"
              label="Email"
              type="email"
              name="username"
              autocomplete="username"
              inputmode="email"
              required
              :error="shown('email')"
              @blur="touch('email')"
            />
            <TextField
              v-model="password"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              required
              :error="shown('password')"
              @blur="touch('password')"
            >
              <template #trailing>
                <IconButton
                  :icon="showPassword ? IconVisibilityOff : IconVisibility"
                  :label="showPassword ? 'Hide password' : 'Show password'"
                  toggle
                  :selected="showPassword"
                  class="-mr-2"
                  @click="showPassword = !showPassword"
                />
              </template>
            </TextField>
            <div class="flex justify-end -mt-2">
              <AppButton variant="text" @click="switchMode('forgot')">Forgot password?</AppButton>
            </div>
            <AppButton type="submit" variant="gold" size="lg" block :loading="loading" :icon="IconLogin">
              {{ loading ? 'Signing in…' : 'Sign in' }}
            </AppButton>
          </form>

          <!-- Create account -->
          <form v-else-if="mode === 'signup'" ref="formEl" novalidate class="space-y-4" aria-label="Create an account" @submit.prevent="createAccount">
            <TextField
              v-model.trim="name"
              label="Full name"
              name="name"
              autocomplete="name"
              required
              :error="shown('name')"
              @blur="touch('name')"
            />
            <TextField
              v-model.trim="email"
              label="Email"
              type="email"
              name="username"
              autocomplete="username"
              inputmode="email"
              required
              :error="shown('email')"
              @blur="touch('email')"
            />
            <TextField
              v-model="password"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              name="new-password"
              autocomplete="new-password"
              :helper="`At least ${MIN_PASSWORD} characters`"
              required
              :error="shown('newPassword')"
              @blur="touch('newPassword')"
            >
              <template #trailing>
                <IconButton
                  :icon="showPassword ? IconVisibilityOff : IconVisibility"
                  :label="showPassword ? 'Hide password' : 'Show password'"
                  toggle
                  :selected="showPassword"
                  class="-mr-2"
                  @click="showPassword = !showPassword"
                />
              </template>
            </TextField>
            <AppButton type="submit" variant="gold" size="lg" block :loading="loading" :icon="IconPersonAdd">
              {{ loading ? 'Creating account…' : 'Create account' }}
            </AppButton>
            <p class="text-body-s text-on-surface-variant">
              A new account isn’t a membership. Members get the 14-day booking window once the Pro Shop adds their plan.
            </p>
          </form>

          <!-- Forgot password -->
          <form v-else-if="mode === 'forgot'" ref="formEl" novalidate class="space-y-4" aria-label="Reset your password" @submit.prevent="sendReset">
            <TextField
              v-model.trim="email"
              label="Email"
              type="email"
              name="username"
              autocomplete="username"
              inputmode="email"
              required
              :error="shown('email')"
              @blur="touch('email')"
            />
            <AppButton type="submit" variant="gold" size="lg" block :loading="loading" :icon="IconSend">
              {{ loading ? 'Sending…' : 'Send reset link' }}
            </AppButton>
            <AppButton variant="text" block :icon="IconArrowBack" @click="switchMode('signin')">Back to sign in</AppButton>
          </form>

          <!-- Set a new password (from the emailed link: /login?reset=1 with a recovery session) -->
          <form v-else-if="mode === 'reset'" ref="formEl" novalidate class="space-y-4" aria-label="Set a new password" @submit.prevent="saveNewPassword">
            <!-- Lets password managers save the new password against the right account -->
            <input type="text" name="username" autocomplete="username" :value="authStore.session?.user?.email || ''" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
            <TextField
              v-model="password"
              label="New password"
              :type="showPassword ? 'text' : 'password'"
              name="new-password"
              autocomplete="new-password"
              :helper="`At least ${MIN_PASSWORD} characters`"
              required
              :error="shown('newPassword')"
              @blur="touch('newPassword')"
            >
              <template #trailing>
                <IconButton
                  :icon="showPassword ? IconVisibilityOff : IconVisibility"
                  :label="showPassword ? 'Hide password' : 'Show password'"
                  toggle
                  :selected="showPassword"
                  class="-mr-2"
                  @click="showPassword = !showPassword"
                />
              </template>
            </TextField>
            <TextField
              v-model="confirmPassword"
              label="Confirm new password"
              :type="showPassword ? 'text' : 'password'"
              name="confirm-password"
              autocomplete="new-password"
              required
              :error="shown('confirm')"
              @blur="touch('confirm')"
            />
            <AppButton type="submit" variant="gold" size="lg" block :loading="loading" :icon="IconLockReset">
              {{ loading ? 'Saving…' : 'Save new password' }}
            </AppButton>
          </form>

          <!-- Checking the reset link -->
          <div v-else-if="mode === 'checking'" class="flex justify-center py-6" role="status">
            <ProgressIndicator :size="32" />
            <span class="sr-only">Checking your reset link…</span>
          </div>

          <!-- Confirmation messages -->
          <div v-else class="text-center" role="status">
            <span
              :class="[
                'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
                mode === 'resetExpired' ? 'bg-warning-container text-on-warning-container' : 'bg-success-container text-on-success-container',
              ]"
              aria-hidden="true"
            >
              <IconLinkOff v-if="mode === 'resetExpired'" class="w-9 h-9" />
              <IconMarkEmailRead v-else class="w-9 h-9" />
            </span>
            <p class="text-body-l text-on-surface">
              <template v-if="mode === 'checkEmail'">
                We sent a confirmation link to <strong class="break-all">{{ sentTo }}</strong>. Open it to finish creating your account, then sign in.
              </template>
              <template v-else-if="mode === 'resetSent'">
                If an account exists for <strong class="break-all">{{ sentTo }}</strong>, we sent it a link to reset the password.
                The link works once and expires after a while.
              </template>
              <template v-else>
                This reset link has expired or was already used. Request a new one and use the newest email.
              </template>
            </p>
            <p v-if="mode !== 'resetExpired'" class="mt-2 text-body-m text-on-surface-variant">Don’t see it? Check your spam folder.</p>
            <div class="mt-6 flex flex-col gap-2">
              <AppButton v-if="mode === 'resetExpired'" variant="gold" size="lg" block @click="switchMode('forgot')">Send a new link</AppButton>
              <AppButton :variant="mode === 'resetExpired' ? 'text' : 'outlined'" block :icon="IconArrowBack" @click="switchMode('signin')">Back to sign in</AppButton>
            </div>
          </div>
        </div>
      </Card>

      <p class="mt-6 text-center text-body-m text-on-surface-variant">
        Looking for a membership?
        <RouterLink to="/memberships" class="inline-flex items-center gap-1 min-h-[48px] text-primary font-bold underline-offset-4 hover:underline">
          View membership plans <IconArrowForward class="w-4 h-4" aria-hidden="true" />
        </RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
// Sign in, create an account, forgot password (Supabase emails a link back to /login?reset=1) and set a new
// password from that link. ?redirect=<path> is where to go after signing in (default /account).
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import AppButton from '@/components/ui/AppButton.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import Card from '@/components/ui/Card.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import TextField from '@/components/ui/TextField.vue'
import { phone as coursePhone } from '@/data/site.js'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconLinkOff from '~icons/material-symbols/link-off-rounded'
import IconLockReset from '~icons/material-symbols/lock-reset-rounded'
import IconLogin from '~icons/material-symbols/login-rounded'
import IconMarkEmailRead from '~icons/material-symbols/mark-email-read-rounded'
import IconPersonAdd from '~icons/material-symbols/person-add-rounded'
import IconSend from '~icons/material-symbols/send-rounded'
import IconVisibility from '~icons/material-symbols/visibility-rounded'
import IconVisibilityOff from '~icons/material-symbols/visibility-off-rounded'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const MIN_PASSWORD = 8

// signin | signup | forgot | resetSent | checking | reset | resetExpired | checkEmail
const mode = ref(route.query.reset ? 'checking' : 'signin')
const titles = {
  signin: 'Sign in',
  signup: 'Create an account',
  forgot: 'Reset your password',
  resetSent: 'Check your email',
  checking: 'Set a new password',
  reset: 'Set a new password',
  resetExpired: 'Link expired',
  checkEmail: 'Check your email',
}
const subtitles = {
  signin: 'See your bookings and account. Staff sign in here too.',
  signup: 'Book tee times faster and keep your bookings in one place.',
  forgot: 'Enter the email you sign in with and we’ll send you a link to choose a new password.',
  reset: 'Choose a new password for your account.',
}

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const sentTo = ref('')
const formEl = ref(null)
const heading = ref(null)
const touched = reactive({})
const submitted = ref(false)

// Only same-site paths, so ?redirect= can't send people to another site
const redirectPath = computed(() => {
  const r = String(route.query.redirect || '')
  return r.startsWith('/') && !r.startsWith('//') ? r : '/account'
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const errors = computed(() => ({
  name:        name.value ? '' : 'Enter your name.',
  email:       !email.value ? 'Enter your email address.' : EMAIL_RE.test(email.value) ? '' : 'Enter an email address like name@example.com.',
  password:    password.value ? '' : 'Enter your password.',
  newPassword: password.value.length >= MIN_PASSWORD ? '' : `Use at least ${MIN_PASSWORD} characters.`,
  confirm:     !confirmPassword.value ? 'Enter the new password again.' : confirmPassword.value === password.value ? '' : 'The passwords don’t match.',
}))
const FIELDS = {
  signin: ['email', 'password'],
  signup: ['name', 'email', 'newPassword'],
  forgot: ['email'],
  reset: ['newPassword', 'confirm'],
}

function touch(field) { touched[field] = true }
function shown(field) { return (touched[field] || submitted.value) ? errors.value[field] : '' }

/** Validate the current form; on a problem focus the first invalid field and return false */
async function valid() {
  submitted.value = true
  error.value = ''
  if (!FIELDS[mode.value].some(f => errors.value[f])) return true
  await nextTick()
  formEl.value?.querySelector('[aria-invalid="true"]')?.focus()
  return false
}

function switchMode(next) {
  mode.value = next
  error.value = ''
  submitted.value = false
  password.value = ''
  confirmPassword.value = ''
  showPassword.value = false
  for (const k of Object.keys(touched)) delete touched[k]
  nextTick(() => heading.value?.focus())
}

// Supabase's messages → plain language
function friendly(e) {
  const msg = String(e?.message || e || '')
  const min = msg.match(/at least (\d+) characters/i)
  if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match an account. Check them and try again, or reset your password.'
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first: open the link we sent when you created your account.'
  if (/already registered|already exists/i.test(msg)) return 'There’s already an account with this email. Sign in instead, or reset your password.'
  if (min) return `Use a password with at least ${min[1]} characters.`
  if (/different from the old password/i.test(msg)) return 'Choose a password that’s different from your current one.'
  if (/weak|pwned|easy to guess/i.test(msg)) return 'That password is too easy to guess. Choose a longer or less common one.'
  if (/signups? not allowed|signup is disabled/i.test(msg)) return `New accounts can’t be created online right now. Please call the Pro Shop at ${coursePhone.display}.`
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.'
  if (/session|jwt|expired/i.test(msg)) return 'Your reset link has expired. Request a new one.'
  if (/fetch|network|load failed/i.test(msg)) return 'We couldn’t reach the sign-in service. Check your connection and try again.'
  return `Something went wrong. Please try again, or call the Pro Shop at ${coursePhone.display}.`
}

async function run(fn) {
  loading.value = true
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = friendly(e)
  } finally {
    loading.value = false
  }
}

async function signIn() {
  if (!(await valid())) return
  await run(async () => {
    await authStore.login(email.value, password.value)
    router.push(redirectPath.value)
  })
}

async function createAccount() {
  if (!(await valid())) return
  await run(async () => {
    const back = `${location.origin}/login${route.query.redirect ? `?redirect=${encodeURIComponent(redirectPath.value)}` : ''}`
    const { needsConfirmation } = await authStore.signUp({ email: email.value, password: password.value, name: name.value, emailRedirectTo: back })
    if (needsConfirmation) {
      sentTo.value = email.value
      switchMode('checkEmail')
    } else {
      router.push(redirectPath.value)
    }
  })
}

async function sendReset() {
  if (!(await valid())) return
  await run(async () => {
    await authStore.requestPasswordReset(email.value, `${location.origin}/login?reset=1`)
    sentTo.value = email.value
    switchMode('resetSent')
  })
}

async function saveNewPassword() {
  if (!(await valid())) return
  await run(async () => {
    await authStore.updatePassword(password.value)
    router.replace(redirectPath.value)
  })
}

onMounted(async () => {
  await authStore.init()
  if (route.query.reset) {
    // The Supabase client reads the recovery token from the link when it starts; a session means it worked
    const { data } = await supabase.auth.getSession()
    mode.value = data.session ? 'reset' : 'resetExpired'
    return
  }
  // Already signed in (e.g. back from the confirmation email): carry on
  if (authStore.isLoggedIn) router.replace(redirectPath.value)
})
</script>
