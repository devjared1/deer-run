<template>
  <div
    :class="[
      'relative bg-surface text-on-surface md:flex print:block print:h-auto print:min-h-0 print:overflow-visible',
      contained ? 'h-full overflow-hidden' : 'min-h-screen',
    ]"
  >
    <!-- Tablets (md–lg), and the register at every width from md: the rail. Its menu button opens everything. -->
    <NavRail
      tone="primary"
      label="Staff"
      :contained="contained"
      :items="railItems"
      show-menu
      menu-label="Open the staff menu"
      :menu-expanded="menuOpen"
      menu-controls="staff-menu-drawer"
      :class="registerMode ? 'hidden md:flex' : 'hidden md:flex lg:hidden'"
      @menu="menuOpen = true"
      @select="onSelect"
    >
      <template #header>
        <BrandLogo variant="mark" :size="40" eager alt="" />
      </template>
      <template #footer>
        <IconButton :icon="IconLogout" label="Sign out" variant="inherit" tooltip @click="signOut" />
      </template>
    </NavRail>

    <!-- Desktop (lg+): the standard drawer, except in register mode -->
    <NavDrawer
      v-if="!registerMode"
      variant="standard"
      tone="primary"
      label="Staff"
      :contained="contained"
      :sections="drawerSections"
      :footer-items="footerItems"
      class="hidden lg:flex"
      @select="onSelect"
    >
      <template #header>
        <DrawerBrand />
      </template>
      <template #footer>
        <DrawerAccount />
      </template>
    </NavDrawer>

    <div
      :class="[
        'flex-1 min-w-0 flex flex-col print:block print:h-auto print:min-h-0 print:overflow-visible',
        contained ? 'h-full overflow-y-auto' : 'min-h-screen',
      ]"
    >
      <TopAppBar :title="pageTitle" :title-tag="contained ? 'h4' : 'h1'">
        <template #actions>
          <RouterLink
            v-if="clockChip"
            to="/staff"
            :aria-label="clockChip.a11y"
            class="group inline-flex items-center h-12 px-1 rounded-shape-sm no-underline"
            @click="onSelect({ to: '/staff' }, $event)"
          >
            <StatusChip :tone="clockChip.tone" :icon="clockChip.icon" class="group-hover:shadow-elevation-1 transition-shadow">
              <!-- The space keeps "On the clock 2h 05m" one phrase, so the aria-label contains the visible text -->
              <span :class="clockChip.time ? 'hidden sm:inline' : ''">{{ clockChip.label }}{{ ' ' }}</span>
              <span v-if="clockChip.time" class="tabular-nums">{{ clockChip.time }}</span>
            </StatusChip>
          </RouterLink>
          <template v-if="authStore.canUseRegister">
            <AppButton variant="text" :icon="IconSwitchAccount" class="hidden sm:inline-flex" @click="signOut">
              Switch cashier
            </AppButton>
            <IconButton :icon="IconSwitchAccount" label="Switch cashier" class="sm:hidden" @click="signOut" />
          </template>
        </template>
      </TopAppBar>

      <main
        :class="[
          'flex-1 print:p-0 print:m-0',
          registerMode ? 'p-0' : 'p-4 md:p-6 lg:p-8',
          // Room for the bottom bar on phones (80px + the safe area)
          registerMode
            ? 'max-md:pb-[calc(80px+env(safe-area-inset-bottom))]'
            : 'max-md:pb-[calc(96px+env(safe-area-inset-bottom))]',
        ]"
      >
        <slot>
          <RouterView />
        </slot>
      </main>
    </div>

    <!-- Phones: the bottom bar (kept in register mode, so the register can always navigate) -->
    <BottomNavBar
      label="Staff"
      :contained="contained"
      :items="barItems"
      class="md:hidden"
      @select="onSelect"
      @more="menuOpen = true"
    />

    <!-- "More" (phones) and the rail's menu: every destination this person has -->
    <NavDrawer
      id="staff-menu-drawer"
      v-model:open="menuOpen"
      variant="modal"
      tone="primary"
      label="Staff menu"
      close-label="Close the staff menu"
      :contained="contained"
      :sections="drawerSections"
      :footer-items="footerItems"
      @select="onSelect"
    >
      <template #header>
        <DrawerBrand />
      </template>
      <template #footer>
        <DrawerAccount />
      </template>
    </NavDrawer>
  </div>
</template>

<script setup>
// The staff portal shell: bottom navigation bar on phones (3–5 destinations by role + More), navigation rail on
// tablets, standard drawer on desktop; a top app bar with the page title, a clock-status chip and Switch cashier.
//
// Route meta: `title` (top bar title; falls back to `titles` below), `registerMode` (full-bleed content, no padding,
// the rail instead of the drawer at lg+, the bottom bar kept on phones).
// When adding a staff page, add it to `navItems` and `titles`.
//
// Dev-only preview props (the /dev/ui gallery; the app never passes them):
//   contained    — render inside the parent box (no viewport-fixed/teleported parts; the content column scrolls).
//   previewPath  — the "current page" instead of the route; nav clicks change it (emits update:previewPath)
//                  instead of navigating.
//   registerMode — force register mode on/off (default: route meta).
//   clock        — a GET /api/staff/clock response to show instead of fetching it.
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiFetch } from '@/lib/api'
import { workedMinutes, toUtcIso } from '@/lib/timeclock'
import { positionLabel } from '@/data/employeePositions'
import { groupItems, isActiveRoute } from '@/components/ui/navItems.js'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import TopAppBar from '@/components/ui/TopAppBar.vue'
import NavDrawer from '@/components/ui/NavDrawer.vue'
import NavRail from '@/components/ui/NavRail.vue'
import BottomNavBar from '@/components/ui/BottomNavBar.vue'
import IconButton from '@/components/ui/IconButton.vue'
import AppButton from '@/components/ui/AppButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import IconTimer from '~icons/material-symbols/timer-rounded'
import IconTimerOff from '~icons/material-symbols/timer-off-rounded'
import IconCoffee from '~icons/material-symbols/coffee-rounded'
import IconFactCheck from '~icons/material-symbols/fact-check-rounded'
import IconCalendar from '~icons/material-symbols/calendar-month-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'
import IconGolfCourse from '~icons/material-symbols/golf-course-rounded'
import IconPointOfSale from '~icons/material-symbols/point-of-sale-rounded'
import IconSportsGolf from '~icons/material-symbols/sports-golf-rounded'
import IconPassword from '~icons/material-symbols/password-rounded'
import IconAdmin from '~icons/material-symbols/admin-panel-settings-rounded'
import IconBack from '~icons/material-symbols/arrow-back-rounded'
import IconLogout from '~icons/material-symbols/logout-rounded'
import IconSwitchAccount from '~icons/material-symbols/switch-account-rounded'
import IconMore from '~icons/material-symbols/more-horiz-rounded'

const props = defineProps({
  contained:    { type: Boolean, default: false },
  previewPath:  { type: String, default: null },
  registerMode: { type: Boolean, default: null },
  clock:        { type: Object, default: null },
})

const emit = defineEmits(['update:previewPath'])

const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()
const menuOpen  = ref(false)

// ── Current page (the route, or the gallery's preview path) ──
const previewAt = ref(props.previewPath)
watch(() => props.previewPath, p => { previewAt.value = p })
const current = computed(() => (previewAt.value ? router.resolve(previewAt.value) : route))
const currentPath = computed(() => current.value.path)

const registerMode = computed(() => props.registerMode ?? current.value.meta?.registerMode === true)

// On a shared register PC the next person signs in and lands back on the same page
async function signOut() {
  if (previewAt.value) return
  const back = route.fullPath
  await authStore.logout()
  router.push({ path: '/login', query: { redirect: back } })
}

// ── Destinations ──
// label: drawer / More menu; short: rail and bottom bar (labels sit under the icon there)
const navItems = computed(() => [
  { to: '/staff',           label: 'Time Clock',   short: 'Clock',     icon: IconTimer,     group: 'My time' },
  { to: '/staff/timesheet', label: 'My Timesheet', short: 'Timesheet', icon: IconFactCheck, group: 'My time' },
  { to: '/staff/schedule',  label: 'My Schedule',  short: 'Schedule',  icon: IconCalendar,  group: 'My time' },
  { to: '/staff/time-off',  label: 'Time Off',     short: 'Time off',  icon: IconBeach,     group: 'My time' },
  ...(authStore.canUseRegister ? [
    { to: '/staff/teesheet', label: 'Tee Sheet', short: 'Tee sheet', icon: IconGolfCourse,  group: 'Golf operations' },
    { to: '/staff/register', label: 'Register',  short: 'Register',  icon: IconPointOfSale, group: 'Golf operations' },
  ] : []),
  ...(authStore.canTrackCourse
    ? [{ to: '/staff/oncourse', label: 'On Course', short: 'On course', icon: IconSportsGolf, group: 'Golf operations' }]
    : []),
  ...(authStore.isRegisterManager
    ? [{ to: '/staff/pin', label: 'Manager PIN', short: 'PIN', icon: IconPassword, group: 'Golf operations', rail: false }]
    : []),
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

const pageTitle = computed(() => current.value.meta?.title || titles[currentPath.value] || 'Staff')

// Active state from the current page (the route, or the preview path)
function withActive(item) {
  return item.to ? { ...item, active: isActiveRoute(currentPath.value, item) } : item
}

// Pages by group, then the ways out of the portal (in the scrolling list, so the pinned footer stays short)
const drawerSections = computed(() => [
  ...groupItems(navItems.value.map(withActive)),
  { title: null, items: [
    ...(authStore.isAdmin ? [{ to: '/admin', label: 'Admin panel', icon: IconAdmin }] : []),
    { to: '/', label: 'Back to site', icon: IconBack },
  ] },
])

const footerItems = computed(() => [
  { label: authStore.canUseRegister ? 'Switch cashier / Sign out' : 'Sign out', icon: IconLogout, action: 'sign-out' },
])

// Rail: every page but Manager PIN (≤ 7); the menu button has the rest
const railItems = computed(() => navItems.value
  .filter(i => i.rail !== false)
  .map(i => withActive({ ...i, label: i.short })))

// Bottom bar: 3 destinations by role + More
const barItems = computed(() => {
  const byPath = Object.fromEntries(navItems.value.map(i => [i.to, i]))
  const paths = authStore.canUseRegister
    ? ['/staff', '/staff/teesheet', '/staff/register']
    : authStore.canTrackCourse
      ? ['/staff', '/staff/oncourse', '/staff/schedule']
      : ['/staff', '/staff/schedule', '/staff/time-off']
  const items = paths.filter(p => byPath[p]).map(p => withActive({ ...byPath[p], label: byPath[p].short }))
  const onOverflowPage = !items.some(i => i.active)
  return [...items, { label: 'More', icon: IconMore, action: 'more', expanded: menuOpen.value, active: onOverflowPage }]
})

function onSelect(item, event) {
  if (item.action === 'sign-out') {
    signOut()
    return
  }
  if (previewAt.value && item.to) {
    event?.preventDefault()
    previewAt.value = typeof item.to === 'string' ? item.to : item.to.path
    emit('update:previewPath', previewAt.value)
    menuOpen.value = false
  }
}

// ── Drawer header / footer ──
const DrawerBrand = defineComponent({
  setup() {
    return () => h('div', { class: 'flex items-center gap-3' }, [
      h(BrandLogo, { variant: 'mark', size: 40, eager: true, alt: '' }),
      h('div', { class: 'min-w-0' }, [
        h('div', { class: 'font-display text-title-m truncate' }, 'Deer Run'),
        h('div', { class: 'text-body-s text-inverse-primary' }, 'Staff'),
      ]),
    ])
  },
})

const DrawerAccount = defineComponent({
  setup() {
    return () => {
      const emp = authStore.employee
      if (!emp) return null
      return h('div', { class: 'px-4 pt-1 pb-2' }, [
        h('div', { class: 'text-body-m truncate' }, `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim()),
        h('div', { class: 'text-body-s text-inverse-primary truncate' }, positionLabel(emp.position)),
      ])
    }
  },
})

// ── Clock-status chip ──
const clockData = ref(props.clock)
const clockSkew = ref(0)      // server time − client time, so the chip ticks with the server's clock
const now = ref(Date.now())
let ticker = null
let requestId = 0

watch(() => props.clock, c => { clockData.value = c; clockSkew.value = c?.serverTime ? Date.parse(c.serverTime) - Date.now() : 0 })

async function loadClock() {
  if (props.clock || previewAt.value) return
  const id = ++requestId
  try {
    const data = await apiFetch('/api/staff/clock')
    if (id !== requestId) return
    clockData.value = data
    clockSkew.value = data?.serverTime ? Date.parse(data.serverTime) - Date.now() : 0
    now.value = Date.now()
  } catch {
    // Quietly hide the chip; the time clock page shows the real error
    if (id === requestId) clockData.value = null
  }
}

function hm(minutes) {
  const total = Math.max(0, Math.floor(minutes))
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

const clockChip = computed(() => {
  const c = clockData.value
  // Not on the time clock page itself: it shows the live state (and the chip would lag its buttons)
  if (!c?.status || currentPath.value === '/staff') return null
  const serverNow = new Date(now.value + clockSkew.value)

  if (c.status === 'on' && c.openEntry) {
    const time = hm(workedMinutes(c.openEntry, serverNow))
    return { tone: 'success', icon: IconTimer, label: 'On the clock', time, a11y: `On the clock ${time}. Open the time clock` }
  }
  if (c.status === 'break' && c.openEntry) {
    const open = c.openEntry.breaks?.find(b => !b.endedAt)
    const started = open ? Date.parse(toUtcIso(open.startedAt)) : serverNow.getTime()
    const time = hm((serverNow.getTime() - started) / 60000)
    return { tone: 'warning', icon: IconCoffee, label: 'On break', time, a11y: `On break ${time}. Open the time clock` }
  }
  return { tone: 'neutral', icon: IconTimerOff, label: 'Off the clock', time: '', a11y: 'Off the clock. Open the time clock' }
})

function onVisibility() {
  if (document.visibilityState === 'visible') {
    now.value = Date.now()
    loadClock()
  }
}

watch(() => route.path, loadClock)

onMounted(() => {
  if (props.clock?.serverTime) clockSkew.value = Date.parse(props.clock.serverTime) - Date.now()
  loadClock()
  ticker = setInterval(() => { now.value = Date.now() }, 30_000)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  clearInterval(ticker)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>
