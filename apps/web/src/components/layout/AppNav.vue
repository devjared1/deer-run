<template>
  <div
    class="sticky hero-bg top-0 z-50 print:hidden"
    style="border-bottom:1px solid rgba(255,255,255,.07);"
  >
    <div class="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
      <!-- Logo -->
      <RouterLink
        to="/"
        class="flex items-center gap-3 cursor-pointer flex-shrink-0"
      >
        <img
          src="/images/deerrunlogo.svg"
          alt="Deer Run Golf Course — home"
          class="h-11 sm:h-12 w-auto"
          width="69"
          height="48"
        >
      </RouterLink>

      <!-- Desktop nav -->
      <nav class="hidden lg:flex items-center gap-7">
        <RouterLink
          v-for="p in pages"
          :key="p.to"
          :to="p.to"
          :class="['nav-link', route.path === p.to ? 'active' : '']"
        >
          {{ p.label }}
        </RouterLink>
      </nav>

      <!-- CTA + mobile toggle -->
      <div class="flex items-center gap-3">
        <RouterLink
          v-if="authStore.isStaff"
          to="/staff"
          class="btn-outline hidden sm:inline-flex"
          style="padding:9px 16px;font-size:12px;"
        >
          Staff
        </RouterLink>
        <RouterLink
          v-if="authStore.isAdmin"
          to="/admin"
          class="btn-outline hidden sm:inline-flex"
          style="padding:9px 16px;font-size:12px;"
        >
          Admin
        </RouterLink>
        <RouterLink
          v-else-if="authStore.isLoggedIn"
          to="/account"
          class="btn-outline hidden sm:inline-flex"
          style="padding:9px 16px;font-size:12px;"
        >
          My Account
        </RouterLink>
        <RouterLink
          v-else
          to="/login"
          class="btn-outline hidden sm:inline-flex"
          style="padding:9px 16px;font-size:12px;"
        >
          Sign In
        </RouterLink>
        <RouterLink
          to="/book"
          class="btn-amber hidden sm:inline-flex"
          style="padding:9px 20px;font-size:12px;"
        >
          Book Tee Time
        </RouterLink>
        <RouterLink
          to="/book"
          class="btn-amber sm:hidden"
          style="padding:10px 16px;font-size:12px;min-height:40px;"
        >
          Book
        </RouterLink>
        <button
          class="lg:hidden flex flex-col justify-center items-center gap-1.5 w-12 h-12"
          :aria-label="mobileOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="mobileOpen"
          aria-controls="mobile-menu"
          @click="mobileOpen = !mobileOpen"
        >
          <span :class="['block w-6 h-0.5 bg-parch/70 transition-all', mobileOpen ? 'rotate-45 translate-y-2' : '']" />
          <span :class="['block w-6 h-0.5 bg-parch/70 transition-all', mobileOpen ? 'opacity-0' : '']" />
          <span :class="['block w-6 h-0.5 bg-parch/70 transition-all', mobileOpen ? '-rotate-45 -translate-y-2' : '']" />
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <Transition name="slide-down">
      <div
        v-if="mobileOpen"
        id="mobile-menu"
        class="lg:hidden"
        style="background:#0D1F16;border-top:1px solid rgba(255,255,255,.07);"
      >
        <div class="max-w-7xl mx-auto px-5 py-2">
          <RouterLink
            v-for="p in pages"
            :key="p.to"
            :to="p.to"
            :class="['mobile-nav-link block', route.path === p.to ? 'active' : '']"
            @click="mobileOpen = false"
          >
            {{ p.label }}
          </RouterLink>
          <div class="py-4 flex flex-col gap-2">
            <RouterLink
              to="/book"
              class="btn-amber w-full justify-center"
              @click="mobileOpen = false"
            >
              Book Tee Time
            </RouterLink>
            <RouterLink
              v-if="authStore.isStaff"
              to="/staff"
              class="btn-outline w-full justify-center"
              @click="mobileOpen = false"
            >
              Staff
            </RouterLink>
            <RouterLink
              v-if="authStore.isAdmin"
              to="/admin"
              class="btn-outline w-full justify-center"
              @click="mobileOpen = false"
            >
              Admin
            </RouterLink>
            <RouterLink
              v-else-if="authStore.isLoggedIn"
              to="/account"
              class="btn-outline w-full justify-center"
              @click="mobileOpen = false"
            >
              My Account
            </RouterLink>
            <RouterLink
              v-else
              to="/login"
              class="btn-outline w-full justify-center"
              @click="mobileOpen = false"
            >
              Sign In
            </RouterLink>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route      = useRoute()
const authStore  = useAuthStore()
const mobileOpen = ref(false)

// The menu closes on navigation and on Esc
watch(() => route.fullPath, () => { mobileOpen.value = false })
function onKey(e) { if (e.key === 'Escape') mobileOpen.value = false }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

const pages = [
  { to: '/',            label: 'Home' },
  { to: '/scorecard',   label: 'The Course' },
  { to: '/rates',       label: 'Rates' },
  { to: '/memberships', label: 'Memberships' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/contact',     label: 'Contact' },
]
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active { transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-down-enter-from,
.slide-down-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
