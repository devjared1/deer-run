<template>
  <div class="min-h-screen bg-gray-50 flex">
    <!-- Sidebar -->
    <aside
      :class="['fixed inset-y-0 left-0 z-40 w-60 bg-pine text-parch flex flex-col transition-transform duration-200 print:hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0']"
    >
      <div class="h-16 flex items-center gap-3 px-5 border-b border-white/10 flex-shrink-0">
        <DeerLogo :size="28" />
        <div>
          <div class="font-display text-sm font-bold leading-tight">Deer Run</div>
          <div class="text-parch/50 text-xs">Staff</div>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="['flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body transition-colors',
            isActive(item.to)
              ? 'bg-gold text-bark font-semibold'
              : 'text-parch/80 hover:bg-white/10 hover:text-parch']"
          @click="sidebarOpen = false"
        >
          <span class="text-base w-5 text-center">{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="p-4 border-t border-white/10">
        <div class="text-parch text-sm font-body truncate">
          {{ authStore.employee?.firstName }} {{ authStore.employee?.lastName }}
        </div>
        <div class="text-parch/50 text-xs font-body truncate">{{ positionLabel(authStore.employee?.position) }}</div>
        <RouterLink
          v-if="authStore.isAdmin"
          to="/admin"
          class="mt-3 flex items-center gap-2 text-parch/60 hover:text-parch text-xs font-body transition-colors"
        >
          Admin panel →
        </RouterLink>
        <RouterLink to="/" class="mt-2 flex items-center gap-2 text-parch/60 hover:text-parch text-xs font-body transition-colors">
          ← Back to site
        </RouterLink>
        <button
          type="button"
          class="mt-2 flex items-center gap-2 text-parch/60 hover:text-parch text-xs font-body transition-colors"
          @click="signOut"
        >
          Sign out
        </button>
      </div>
    </aside>

    <!-- Overlay (mobile) -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 bg-black/40 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Main content -->
    <div class="flex-1 lg:ml-60 flex flex-col min-h-screen print:ml-0">
      <header class="sticky top-0 z-20 h-16 bg-white border-b border-gray-200 flex items-center gap-4 px-5 print:hidden">
        <button
          class="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          aria-label="Open menu"
          @click="sidebarOpen = !sidebarOpen"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="font-display text-bark font-bold text-lg">{{ pageTitle }}</h1>
      </header>

      <main class="flex-1 p-5 md:p-8 print:p-0">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { positionLabel } from '@/data/employeePositions'
import DeerLogo from '@/components/ui/DeerLogo.vue'

const route       = useRoute()
const router      = useRouter()
const authStore   = useAuthStore()
const sidebarOpen = ref(false)

// On a shared register PC the next person signs in and lands back on the same page
async function signOut() {
  const back = route.fullPath
  await authStore.logout()
  router.push({ path: '/login', query: { redirect: back } })
}

const navItems = computed(() => [
  { to: '/staff',           label: 'Time Clock',   icon: '⏱' },
  { to: '/staff/timesheet', label: 'My Timesheet', icon: '🗓' },
  { to: '/staff/schedule',  label: 'My Schedule',  icon: '📅' },
  { to: '/staff/time-off',  label: 'Time Off',     icon: '🏖' },
  ...(authStore.canUseRegister ? [
    { to: '/staff/teesheet', label: 'Tee Sheet', icon: '⛳' },
    { to: '/staff/register', label: 'Register', icon: '🧾' },
  ] : []),
  ...(authStore.canTrackCourse ? [{ to: '/staff/oncourse', label: 'On Course', icon: '🏌' }] : []),
  ...(authStore.isRegisterManager ? [{ to: '/staff/pin', label: 'Manager PIN', icon: '🔑' }] : []),
])

const titles = {
  '/staff':           'Time Clock',
  '/staff/timesheet': 'My Timesheet',
  '/staff/schedule':  'My Schedule',
  '/staff/time-off':  'Time Off',
  '/staff/register':  'Register',
  '/staff/teesheet':  'Tee Sheet',
  '/staff/oncourse':  'On Course',
  '/staff/pin':       'Manager PIN',
}

const pageTitle = computed(() => titles[route.path] || 'Staff')

function isActive(to) {
  if (to === '/staff') return route.path === '/staff'
  return route.path.startsWith(to)
}
</script>
