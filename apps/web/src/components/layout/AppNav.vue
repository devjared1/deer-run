<template>
  <div class="hero-bg sticky top-0 z-50" style="border-bottom:1px solid rgba(255,255,255,.07);">
    <div class="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
      <!-- Logo -->
      <RouterLink to="/" class="flex items-center gap-3 cursor-pointer flex-shrink-0">
        <DeerLogo :size="36" />
        <div class="hidden sm:block">
          <div class="logo-text">Deer Run</div>
          <div class="logo-sub">Golf Course</div>
        </div>
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
        <RouterLink v-if="authStore.isLoggedIn" to="/account"
          class="btn-outline hidden sm:inline-flex" style="padding:9px 16px;font-size:12px;">
          My Account
        </RouterLink>
        <RouterLink to="/book" class="btn-amber hidden sm:inline-flex" style="padding:9px 20px;font-size:12px;">
          Book Tee Time
        </RouterLink>
        <button
          @click="mobileOpen = !mobileOpen"
          class="lg:hidden flex flex-col gap-1.5 p-2"
          aria-label="Menu"
        >
          <span :class="['block w-6 h-0.5 bg-parch/70 transition-all', mobileOpen ? 'rotate-45 translate-y-2' : '']"></span>
          <span :class="['block w-6 h-0.5 bg-parch/70 transition-all', mobileOpen ? 'opacity-0' : '']"></span>
          <span :class="['block w-6 h-0.5 bg-parch/70 transition-all', mobileOpen ? '-rotate-45 -translate-y-2' : '']"></span>
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <Transition name="slide-down">
      <div v-if="mobileOpen" class="lg:hidden" style="background:#0D1F16;border-top:1px solid rgba(255,255,255,.07);">
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
            <RouterLink to="/book" class="btn-amber w-full justify-center" @click="mobileOpen = false">
              Book Tee Time
            </RouterLink>
            <RouterLink v-if="authStore.isLoggedIn" to="/account" class="btn-outline w-full justify-center" @click="mobileOpen = false">
              My Account
            </RouterLink>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DeerLogo from '@/components/ui/DeerLogo.vue'

const route      = useRoute()
const authStore  = useAuthStore()
const mobileOpen = ref(false)

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
