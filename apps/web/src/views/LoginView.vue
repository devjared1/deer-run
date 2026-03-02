<template>
  <div class="page-enter">
    <PageHero
      label="Member Access"
      title-html="Sign <em>In</em>"
    />

    <section class="topo py-12">
      <div class="max-w-md mx-auto px-5">
        <div class="card rounded-lg p-8">
          <h2 style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#1E3D2F;margin-bottom:6px;">Member Sign In</h2>
          <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-bottom:24px;">
            Access advance booking and your booking history.
          </p>

          <div v-if="error" class="mb-4 p-3 rounded text-sm" style="background:rgba(140,74,47,.1);color:#6B3820;font-family:'Lato',sans-serif;">
            {{ error }}
          </div>

          <form @submit.prevent="submit" class="space-y-4">
            <div>
              <label class="field-label">Email Address</label>
              <input v-model="email" type="email" placeholder="john@example.com" class="field rounded-sm" required />
            </div>
            <div>
              <label class="field-label">Password</label>
              <input v-model="password" type="password" placeholder="••••••••" class="field rounded-sm" required />
            </div>
            <button
              type="submit"
              :disabled="loading"
              class="btn-amber w-full justify-center"
              :style="loading ? 'opacity:.6;cursor:not-allowed;' : ''"
            >
              {{ loading ? 'Signing In…' : 'Sign In' }}
            </button>
          </form>

          <div class="mt-6 pt-5 text-center" style="border-top:1px solid rgba(61,43,26,.1);">
            <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.45);">
              Not a member yet?
              <RouterLink to="/memberships" style="color:#1E3D2F;font-weight:700;text-decoration:none;"> View Membership Plans →</RouterLink>
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref }   from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PageHero from '@/components/layout/PageHero.vue'

const router    = useRouter()
const route     = useRoute()
const authStore = useAuthStore()

const email    = ref('')
const password = ref('')
const loading  = ref(false)
const error    = ref('')

async function submit() {
  error.value   = ''
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    const redirect = route.query.redirect || '/account'
    router.push(String(redirect))
  } catch (e) {
    error.value = e.message || 'Invalid email or password.'
  } finally {
    loading.value = false
  }
}
</script>
