<template>
  <div class="min-h-screen bg-surface text-on-surface flex print:block print:min-h-0">
    <!-- Navigation drawer: modal below lg (menu button in the app bar or the rail), standard at lg+ -->
    <NavDrawer
      id="admin-nav-drawer"
      v-model:open="drawerOpen"
      tone="primary"
      label="Admin"
      :sections="drawerSections"
      :footer-items="footerItems"
      @select="onNavSelect"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <BrandLogo variant="mark" :size="40" eager alt="" />
          <div class="min-w-0">
            <div class="font-display text-title-m truncate">Deer Run</div>
            <div class="text-body-s text-inverse-primary">Admin</div>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="email" class="px-4 pt-1 pb-2">
          <div class="text-body-s text-inverse-primary">Signed in as</div>
          <div class="text-body-m truncate">{{ email }}</div>
        </div>
      </template>
    </NavDrawer>

    <!-- Navigation rail: md to lg (tablets) -->
    <div class="hidden md:block lg:hidden flex-shrink-0 print:hidden">
      <NavRail
        tone="primary"
        label="Admin"
        show-menu
        :menu-expanded="drawerOpen"
        menu-controls="admin-nav-drawer"
        :items="railItems"
        @menu="drawerOpen = true"
        @select="onNavSelect"
      >
        <template #header>
          <BrandLogo variant="mark" :size="40" eager alt="" />
        </template>
        <template #footer>
          <IconButton :icon="IconArrowBack" label="Back to site" variant="inherit" to="/" tooltip />
          <IconButton :icon="IconLogout" label="Sign out" variant="inherit" tooltip @click="signOut" />
        </template>
      </NavRail>
    </div>

    <!-- Main column -->
    <div class="flex-1 min-w-0 flex flex-col min-h-screen print:min-h-0">
      <TopAppBar
        :title="pageTitle"
        show-nav
        nav-class="md:hidden"
        :nav-expanded="drawerOpen"
        nav-controls="admin-nav-drawer"
        @nav="drawerOpen = true"
      >
        <template v-if="breadcrumbs.length" #subtitle>
          <nav aria-label="Breadcrumb">
            <ol class="flex items-center gap-1 min-w-0">
              <li v-for="(crumb, i) in breadcrumbs" :key="i" class="flex items-center gap-1 min-w-0">
                <IconChevronRight v-if="i > 0" class="flex-none" aria-hidden="true" />
                <RouterLink
                  v-if="crumb.to && i < breadcrumbs.length - 1"
                  :to="crumb.to"
                  class="truncate underline-offset-2 hover:underline"
                >{{ crumb.label }}</RouterLink>
                <span v-else class="truncate" :aria-current="i === breadcrumbs.length - 1 ? 'page' : undefined">{{ crumb.label }}</span>
              </li>
            </ol>
          </nav>
        </template>

        <template #actions>
          <!--
            Page actions: a page puts its primary action in the app bar with
              <Teleport to="#admin-page-actions" defer><AppButton …>New event</AppButton></Teleport>
            `defer` (Vue 3.5+, installed: 3.5) waits until this layout has rendered the target, so the page can
            teleport into its own parent. Keep it to one or two actions; the rest stay in the page.
          -->
          <div id="admin-page-actions" class="flex items-center gap-2" />

          <!-- Account menu -->
          <Menu as="div" class="relative inline-flex">
            <MenuButton :as="IconButton" :icon="IconAccount" label="Account menu" />
            <Transition
              enter-active-class="transition duration-short-4 ease-emphasized-decelerate"
              enter-from-class="opacity-0 scale-95"
              leave-active-class="transition-opacity duration-short-2 ease-standard"
              leave-to-class="opacity-0"
            >
              <MenuItems
                class="absolute right-0 top-full mt-1 z-dialog min-w-[220px] max-w-[300px] py-2 origin-top-right rounded-shape-xs bg-surface-container text-on-surface shadow-elevation-2 focus:outline-none"
              >
                <div v-if="email" class="px-3 pt-1 pb-2 mb-1 border-b border-outline-variant">
                  <div class="text-body-s text-on-surface-variant">Signed in as</div>
                  <div class="text-body-m truncate">{{ email }}</div>
                </div>
                <MenuItem v-if="authStore.isStaff" v-slot="{ active }">
                  <RouterLink to="/staff" :class="[MENU_ITEM, active ? 'before:opacity-[.08]' : '']">
                    <IconPunchClock class="w-6 h-6 text-on-surface-variant" aria-hidden="true" />
                    <span class="truncate">Staff portal</span>
                  </RouterLink>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <RouterLink to="/" :class="[MENU_ITEM, active ? 'before:opacity-[.08]' : '']">
                    <IconArrowBack class="w-6 h-6 text-on-surface-variant" aria-hidden="true" />
                    <span class="truncate">Back to site</span>
                  </RouterLink>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button type="button" :class="[MENU_ITEM, 'w-full text-left', active ? 'before:opacity-[.08]' : '']" @click="signOut">
                    <IconLogout class="w-6 h-6 text-on-surface-variant" aria-hidden="true" />
                    <span class="truncate">Sign out</span>
                  </button>
                </MenuItem>
              </MenuItems>
            </Transition>
          </Menu>
        </template>
      </TopAppBar>

      <!-- Page content -->
      <main class="flex-1 min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 print:p-0">
        <!-- The slot is only for the /dev/ui shell preview; in the app the child route renders here -->
        <slot><RouterView /></slot>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { useAuthStore } from '@/stores/auth'
import { usePendingTimeOff } from '@/composables/usePendingTimeOff'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import TopAppBar from '@/components/ui/TopAppBar.vue'
import NavDrawer from '@/components/ui/NavDrawer.vue'
import NavRail from '@/components/ui/NavRail.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { groupItems } from '@/components/ui/navItems.js'
import IconDashboard from '~icons/material-symbols/dashboard-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconBookOnline from '~icons/material-symbols/book-online-rounded'
// emoji_events has no rounded variant in the icon set; trophy-rounded is the same glyph
import IconTrophy from '~icons/material-symbols/trophy-rounded'
import IconBadge from '~icons/material-symbols/badge-rounded'
import IconPunchClock from '~icons/material-symbols/punch-clock-rounded'
import IconCalendar from '~icons/material-symbols/calendar-month-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'
import IconInventory from '~icons/material-symbols/inventory-2-rounded'
import IconMonitoring from '~icons/material-symbols/monitoring-rounded'
import IconPointOfSale from '~icons/material-symbols/point-of-sale-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'
import IconGroup from '~icons/material-symbols/group-rounded'
import IconSettings from '~icons/material-symbols/settings-rounded'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconChevronRight from '~icons/material-symbols/chevron-right-rounded'
import IconLogout from '~icons/material-symbols/logout-rounded'
import IconAccount from '~icons/material-symbols/account-circle-rounded'

const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()
const drawerOpen = ref(false)

const email = computed(() => authStore.profile?.email ?? '')

async function signOut() {
  await authStore.logout()
  router.push('/')
}

// Pending time off badge, refreshed on every admin page change
const { pending: pendingTimeOff, refresh: refreshPendingTimeOff } = usePendingTimeOff()
watch(() => route.path, refreshPendingTimeOff, { immediate: true })

// Admin pages. When adding one, add it here (group, label, a short rail label, Material Symbol) and to `titles`.
const navItems = [
  { group: 'Overview', to: '/admin',                label: 'Dashboard',      short: 'Dashboard',   icon: IconDashboard },
  { group: 'Golf',     to: '/admin/teetimes',       label: 'Tee Times',      short: 'Tee times',   icon: IconSchedule },
  { group: 'Golf',     to: '/admin/bookings',       label: 'Bookings',       short: 'Bookings',    icon: IconBookOnline },
  { group: 'Golf',     to: '/admin/tournaments',    label: 'Tournaments',    short: 'Events',      icon: IconTrophy },
  { group: 'Staff',    to: '/admin/employees',      label: 'Employees',      short: 'Employees',   icon: IconBadge },
  { group: 'Staff',    to: '/admin/timesheets',     label: 'Timesheets',     short: 'Timesheets',  icon: IconPunchClock },
  { group: 'Staff',    to: '/admin/schedule',       label: 'Schedule',       short: 'Schedule',    icon: IconCalendar },
  { group: 'Staff',    to: '/admin/time-off',       label: 'Time Off',       short: 'Time off',    icon: IconBeach },
  { group: 'Pro Shop', to: '/admin/products',       label: 'Products',       short: 'Products',    icon: IconInventory },
  { group: 'Pro Shop', to: '/admin/sales',          label: 'Sales',          short: 'Sales',       icon: IconMonitoring },
  { group: 'Pro Shop', to: '/admin/registers',      label: 'Registers',      short: 'Registers',   icon: IconPointOfSale },
  { group: 'Pro Shop', to: '/admin/house-accounts', label: 'House Accounts', short: 'Accounts',    icon: IconWallet },
  { group: 'Admin',    to: '/admin/users',          label: 'Users',          short: 'Users',       icon: IconGroup },
  { group: 'Admin',    to: '/admin/settings',       label: 'Settings',       short: 'Settings',    icon: IconSettings },
]

// Fallback page titles, used when the route has no meta.title
const titles = {
  '/admin':                'Dashboard',
  '/admin/teetimes':       'Tee Time Management',
  '/admin/bookings':       'Booking Management',
  '/admin/tournaments':    'Tournament Scheduling',
  '/admin/settings':       'Course Settings',
  '/admin/users':          'User Management',
  '/admin/employees':      'Employee Management',
  '/admin/timesheets':     'Timesheets',
  '/admin/schedule':       'Schedule',
  '/admin/time-off':       'Time Off Requests',
  '/admin/products':       'Products & Inventory',
  '/admin/sales':          'Sales & Reports',
  '/admin/house-accounts': 'House Accounts',
  '/admin/registers':      'Registers',
}

const footerItems = [
  { to: '/', label: 'Back to site', icon: IconArrowBack, exact: true },
  { label: 'Sign out', icon: IconLogout, action: 'sign-out' },
]

// The time off item carries the pending count
const itemsWithBadges = computed(() => navItems.map(item => {
  if (item.to !== '/admin/time-off' || !pendingTimeOff.value) return item
  const n = pendingTimeOff.value
  return { ...item, badge: n, badgeLabel: `${n} pending request${n === 1 ? '' : 's'}` }
}))
const drawerSections = computed(() => groupItems(itemsWithBadges.value))
// The rail has no room for group headings or long labels: a flat list with the short labels
const railItems = computed(() => itemsWithBadges.value.map(item => ({ ...item, label: item.short })))

function onNavSelect(item) {
  if (item.action === 'sign-out') signOut()
}

const pageTitle = computed(() =>
  route.meta?.title
  || titles[route.path]
  || (route.path.startsWith('/admin/house-accounts/') ? 'House Account' : 'Admin'))

// route.meta.breadcrumbs: [{ label, to? }] or plain strings; the last one is the current page
const breadcrumbs = computed(() => {
  const list = route.meta?.breadcrumbs
  if (!Array.isArray(list)) return []
  return list
    .map(c => (typeof c === 'string' ? { label: c } : { label: c?.label ?? c?.title ?? '', to: c?.to ?? null }))
    .filter(c => c.label)
})

const MENU_ITEM = 'state-layer flex items-center gap-3 w-full min-h-12 px-3 text-body-l text-on-surface no-underline whitespace-nowrap cursor-pointer'
</script>
