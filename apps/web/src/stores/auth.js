import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const profile = ref(null)

  const isLoggedIn  = computed(() => !!session.value)
  const isMember    = computed(() => profile.value?.role === 'MEMBER')
  const maxBookDays = computed(() => isMember.value ? 14 : 7)

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    supabase.auth.onAuthStateChange((_event, s) => {
      session.value = s
      if (!s) profile.value = null
    })
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
    const res = await fetch(`/api/auth/me`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    })
    profile.value = await res.json()
  }

  async function logout() {
    await supabase.auth.signOut()
    session.value = null
    profile.value = null
  }

  function getToken() {
    return session.value?.access_token ?? null
  }

  return { session, profile, isLoggedIn, isMember, maxBookDays, init, login, logout, getToken }
})
