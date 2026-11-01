<template>
  <!-- First stop for keyboard users: jumps past the header to <main id="main"> (App.vue) -->
  <a
    href="#main"
    class="sr-only-focusable fixed left-4 top-3 z-snackbar inline-flex items-center h-12 px-6 rounded-full bg-gold text-on-gold text-label-l shadow-elevation-3 no-underline print:hidden"
  >
    Skip to main content
  </a>

  <header class="sticky top-0 z-app-bar bg-primary text-on-primary shadow-elevation-1 print:hidden">
    <div class="max-w-7xl mx-auto h-16 md:h-[72px] pl-4 pr-2 md:px-5 flex items-center gap-2">
      <RouterLink to="/" class="flex-shrink-0 inline-flex items-center rounded-shape-sm" aria-label="Deer Run Golf Course, home">
        <BrandLogo :size="40" eager alt="" class="md:hidden" />
        <BrandLogo :size="48" eager alt="" class="hidden md:inline-block" />
      </RouterLink>

      <!-- Desktop links (lg+) -->
      <nav aria-label="Main" class="hidden lg:block ml-4 xl:ml-8">
        <ul class="flex items-center gap-1">
          <li v-for="p in pages" :key="p.to">
            <RouterLink
              :to="p.to"
              :aria-current="isActive(p) ? 'page' : undefined"
              class="group relative inline-flex items-center h-12 px-3 xl:px-4 rounded-full text-label-l text-on-primary no-underline state-layer"
            >
              {{ p.label }}
              <!-- MD3 active indicator: a rounded bar under the label -->
              <span
                :class="[
                  'absolute left-3 right-3 xl:left-4 xl:right-4 bottom-1 h-[3px] rounded-full bg-gold-container transition-opacity duration-short-4 ease-standard',
                  isActive(p) ? 'opacity-100' : 'opacity-0',
                ]"
                aria-hidden="true"
              />
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div class="flex-1" />

      <!-- Account links: icons at lg, labeled from xl; below lg they're in the drawer -->
      <div class="hidden lg:flex items-center gap-1">
        <template v-for="a in accountLinks" :key="a.to">
          <IconButton :to="a.to" :icon="a.icon" :label="a.label" variant="inherit" tooltip class="xl:hidden" />
          <RouterLink
            :to="a.to"
            :aria-current="route.path === a.to ? 'page' : undefined"
            class="hidden xl:inline-flex items-center gap-2 h-10 px-3 rounded-full text-label-l text-on-primary no-underline state-layer"
          >
            <component :is="a.icon" class="w-5 h-5" aria-hidden="true" />
            {{ a.label }}
          </RouterLink>
        </template>
      </div>

      <AppButton variant="gold" to="/book" :icon="IconEventAvailable" class="hidden md:inline-flex ml-2">
        Book a tee time
      </AppButton>
      <AppButton variant="gold" to="/book" class="md:hidden !px-4" aria-label="Book a tee time">
        Book
      </AppButton>

      <IconButton
        :icon="IconMenu"
        label="Open menu"
        variant="inherit"
        class="lg:hidden"
        aria-haspopup="dialog"
        :aria-expanded="String(menuOpen)"
        aria-controls="site-nav-drawer"
        @click="menuOpen = true"
      />
    </div>
  </header>

  <!-- Full-screen navigation drawer below lg (focus trap, Esc, scroll lock, closes on route change) -->
  <NavDrawer
    id="site-nav-drawer"
    v-model:open="menuOpen"
    variant="modal"
    tone="primary"
    label="Main"
    close-label="Close menu"
    :items="drawerItems"
    :footer-items="drawerAccountItems"
    class="!w-full !max-w-none !rounded-none"
  >
    <template #header>
      <BrandLogo :size="48" alt="Deer Run Golf Course" />
    </template>
    <template #footer="{ close }">
      <AppButton variant="gold" size="lg" block to="/book" :icon="IconEventAvailable" class="mb-2" @click="close">
        Book a tee time
      </AppButton>
    </template>
  </NavDrawer>

  <!-- Phones: sticky "Book a tee time" bar, above the safe area. App.vue pads the page by its height. -->
  <div
    v-if="showBookBar"
    ref="bookBar"
    class="md:hidden fixed inset-x-0 bottom-0 z-app-bar bg-surface-container-low shadow-elevation-2 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] print:hidden"
  >
    <AppButton variant="gold" size="lg" block to="/book" :icon="IconEventAvailable">
      Book a tee time
    </AppButton>
  </div>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import IconButton from '@/components/ui/IconButton.vue'
import NavDrawer from '@/components/ui/NavDrawer.vue'
import { isActiveRoute } from '@/components/ui/navItems.js'
import { useAuthStore } from '@/stores/auth'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import IconAccount from '~icons/material-symbols/account-circle-rounded'
import IconAdmin from '~icons/material-symbols/admin-panel-settings-rounded'
import IconBadge from '~icons/material-symbols/badge-rounded'
import IconContact from '~icons/material-symbols/contact-support-rounded'
import IconEventAvailable from '~icons/material-symbols/event-available-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconHome from '~icons/material-symbols/home-rounded'
import IconLogin from '~icons/material-symbols/login-rounded'
import IconMembership from '~icons/material-symbols/workspace-premium-rounded'
import IconMenu from '~icons/material-symbols/menu-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconTrophy from '~icons/material-symbols/trophy-rounded'

const route = useRoute()
const auth  = useAuthStore()
const menuOpen = ref(false)

const pages = [
  { to: '/',            label: 'Home',        icon: IconHome },
  { to: '/scorecard',   label: 'The Course',  icon: IconGolf },
  { to: '/rates',       label: 'Rates',       icon: IconPayments },
  { to: '/memberships', label: 'Memberships', icon: IconMembership },
  { to: '/tournaments', label: 'Tournaments', icon: IconTrophy },
  { to: '/contact',     label: 'Contact',     icon: IconContact },
]
const drawerItems = pages

function isActive(item) {
  return isActiveRoute(route, item)
}

// Sign in, or My Account plus Staff / Admin for the roles that have them
const accountLinks = computed(() => {
  if (!auth.isLoggedIn) return [{ to: '/login', label: 'Sign in', icon: IconLogin }]
  const links = []
  if (auth.isStaff) links.push({ to: '/staff', label: 'Staff', icon: IconBadge })
  if (auth.isAdmin) links.push({ to: '/admin', label: 'Admin', icon: IconAdmin })
  links.push({ to: '/account', label: 'My Account', icon: IconAccount })
  return links
})
const drawerAccountItems = computed(() => accountLinks.value.map(a => ({ ...a, exact: true })))

// ── Sticky bottom booking bar (phones) ──
const HIDE_BOOK_BAR = ['/book', '/confirmation', '/login']
const showBookBar = computed(() => !HIDE_BOOK_BAR.includes(route.path))
const bookBar = ref(null)
let resizeObserver = null

// While the bar is on screen: --snackbar-offset lifts snackbars over it, --bottom-bar-height pads the page
// (App.vue) so the footer isn't hidden behind it. Hidden by md:hidden, its height is 0 and both are removed.
function setOffset(height) {
  const style = document.documentElement.style
  if (height > 0) {
    style.setProperty('--snackbar-offset', `${Math.ceil(height) + 16}px`)
    style.setProperty('--bottom-bar-height', `${Math.ceil(height)}px`)
  } else {
    style.removeProperty('--snackbar-offset')
    style.removeProperty('--bottom-bar-height')
  }
}

watch(bookBar, async (el) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  await nextTick()
  if (!el) { setOffset(0); return }
  setOffset(el.offsetHeight)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => setOffset(el.offsetHeight))
    resizeObserver.observe(el)
  }
}, { flush: 'post' })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  setOffset(0)
})
</script>
