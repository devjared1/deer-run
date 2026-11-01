import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const profile = ref(null)
  let initPromise = null

  const isLoggedIn  = computed(() => !!session.value)
  const isMember    = computed(() => profile.value?.role === 'MEMBER')
  const isAdmin     = computed(() => profile.value?.role === 'ADMIN')
  const employee    = computed(() => profile.value?.employee ?? null)
  const isStaff     = computed(() => !!employee.value?.active)
  const canUseRegister    = computed(() => !!profile.value?.canUseRegister)
  const isRegisterManager = computed(() => !!profile.value?.isRegisterManager)
  const canTrackCourse    = computed(() => !!profile.value?.canTrackCourse)
  const maxBookDays = computed(() => (isMember.value || isAdmin.value) ? 14 : 7)

  async function fetchProfile() {
    const token = getToken()
    if (!token) {
      profile.value = null
      return
    }
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok && !res.headers.get('content-type')?.includes('application/json')) {
        // Vite answers unknown URLs with index.html, so this means the Functions aren't running
        console.warn('Couldn\'t load your profile: /api/auth/me returned a page, not the API. ' +
          'Run `npm run dev:pages` so the Functions are running.')
        profile.value = null
        return
      }
      if (!res.ok) {
        // 5xx here with `npm run dev` means the Functions aren't running (Vite's /api proxy has nothing to reach)
        console.warn(`Couldn't load your profile: /api/auth/me returned ${res.status}`, await res.text().catch(() => ''))
      }
      profile.value = res.ok ? await res.json() : null
    } catch (e) {
      console.warn('Couldn\'t load your profile from /api/auth/me:', e)
      profile.value = null
    }
  }

  // Restores the session and profile once per page load. Safe to call repeatedly:
  // the router guard awaits it before checking roles, and App.vue calls it on mount.
  function init() {
    if (!initPromise) {
      initPromise = (async () => {
        const { data } = await supabase.auth.getSession()
        session.value = data.session
        if (data.session) await fetchProfile()
        supabase.auth.onAuthStateChange((_event, s) => {
          session.value = s
          if (!s) profile.value = null
        })
      })()
    }
    return initPromise
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
    await fetchProfile()
  }

  // Create an account. The name goes into the Supabase user metadata (user_metadata.name). Returns
  // { needsConfirmation: true } when the project requires an email confirmation (no session yet).
  async function signUp({ email, password, name, emailRedirectTo }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo },
    })
    if (error) throw error
    if (!data.session) return { needsConfirmation: true }
    session.value = data.session
    await fetchProfile()
    return { needsConfirmation: false }
  }

  // Email a password reset link that comes back to `redirectTo` with a recovery session
  async function requestPasswordReset(email, redirectTo) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }

  // Set a new password for the signed-in (or recovering) user
  async function updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    await fetchProfile()
  }

  async function logout() {
    await supabase.auth.signOut()
    session.value = null
    profile.value = null
  }

  function getToken() {
    return session.value?.access_token ?? null
  }

  return {
    session, profile, isLoggedIn, isMember, isAdmin, employee, isStaff, canUseRegister, isRegisterManager, canTrackCourse, maxBookDays,
    init, fetchProfile, login, signUp, requestPasswordReset, updatePassword, logout, getToken,
  }
})
