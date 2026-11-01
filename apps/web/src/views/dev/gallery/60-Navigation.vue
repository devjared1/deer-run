<template>
  <div class="space-y-10">
    <!-- ── Top app bar ── -->
    <div>
      <h3 class="text-title-m mb-1">Top app bar</h3>
      <p class="text-body-m text-on-surface-variant mb-3">
        Scroll inside the first box: the bar picks up surface-container and elevation once content passes under it.
      </p>
      <div class="grid gap-4 lg:grid-cols-2">
        <div :class="FRAME">
          <div class="h-64 overflow-y-auto">
            <TopAppBar title="Bookings" title-tag="h4" subtitle="Golf · 42 this week" show-nav>
              <template #actions>
                <IconButton :icon="IconSearch" label="Search bookings" />
                <IconButton :icon="IconMoreVert" label="More actions" />
              </template>
            </TopAppBar>
            <DemoLines :count="14" />
          </div>
        </div>
        <div :class="FRAME">
          <div class="h-64 overflow-y-auto">
            <TopAppBar title="Time Clock" title-tag="h4" tone="primary" show-nav>
              <template #actions>
                <IconButton :icon="IconLogout" label="Sign out" />
              </template>
            </TopAppBar>
            <DemoLines :count="14" />
          </div>
        </div>
        <div :class="FRAME">
          <TopAppBar title="Smith, Jordan — a long house account name that truncates" title-tag="h4" :scrolled="true" show-nav :nav-icon="IconBack" nav-label="Back to house accounts">
            <template #subtitle>House Accounts › Smith, Jordan</template>
            <template #actions>
              <IconButton :icon="IconEdit" label="Edit account" />
            </template>
          </TopAppBar>
        </div>
        <div :class="FRAME">
          <TopAppBar title="Register" title-tag="h4" tone="primary" :scrolled="true">
            <template #leading>
              <BrandLogo variant="mark" :size="40" class="ml-3" alt="" />
            </template>
            <template #actions>
              <IconButton :icon="IconSearch" label="Search products" />
            </template>
          </TopAppBar>
        </div>
      </div>
    </div>

    <!-- ── Standard drawer ── -->
    <div>
      <h3 class="text-title-m mb-1">Navigation drawer: standard</h3>
      <p class="text-body-m text-on-surface-variant mb-3">Admin sections, a pending-requests badge, footer items. Click to move the active indicator.</p>
      <div class="grid gap-4 xl:grid-cols-2">
        <div v-for="tone in ['surface', 'primary']" :key="tone" :class="[FRAME, 'h-[560px] flex']">
          <NavDrawer
            variant="standard"
            contained
            :tone="tone"
            label="Admin"
            :sections="demoSections(adminSections, state.drawer)"
            :footer-items="footerItems"
            @select="(item, e) => pick('drawer', item, e)"
          >
            <template #header>
              <div class="flex items-center gap-3">
                <BrandLogo variant="mark" :size="40" alt="" />
                <div class="min-w-0">
                  <div class="font-display text-title-m truncate">Deer Run</div>
                  <div :class="['text-body-s', tone === 'primary' ? 'text-inverse-primary' : 'text-on-surface-variant']">Admin</div>
                </div>
              </div>
            </template>
            <template #footer>
              <div class="px-4 pt-1 pb-2">
                <div :class="['text-body-s', tone === 'primary' ? 'text-inverse-primary' : 'text-on-surface-variant']">Signed in as</div>
                <div class="text-body-m truncate">gm@example.com</div>
              </div>
            </template>
          </NavDrawer>
          <div class="hidden sm:flex flex-1 min-w-0 flex-col">
            <TopAppBar :title="titleOf(state.drawer)" title-tag="h4" :scrolled="false" />
            <DemoLines :count="6" />
          </div>
        </div>
      </div>
    </div>

    <!-- ── Modal drawer ── -->
    <div>
      <h3 class="text-title-m mb-1">Navigation drawer: modal</h3>
      <p class="text-body-m text-on-surface-variant mb-3">
        Below lg. Open it with the menu button; Esc, the scrim, the close button or picking an item closes it, and
        focus returns to the menu button. (Here it's contained in the box, so the page doesn't lock.)
      </p>
      <div class="grid gap-4 lg:grid-cols-2">
        <div v-for="tone in ['surface', 'primary']" :key="tone" :class="[FRAME, 'h-[520px] max-w-[360px] w-full']">
          <TopAppBar
            :title="titleOf(state.modal)"
            title-tag="h4"
            :tone="tone"
            :scrolled="false"
            show-nav
            :nav-expanded="modalOpen[tone]"
            :nav-controls="`demo-modal-drawer-${tone}`"
            @nav="modalOpen[tone] = true"
          />
          <DemoLines :count="8" />
          <NavDrawer
            :id="`demo-modal-drawer-${tone}`"
            v-model:open="modalOpen[tone]"
            variant="modal"
            contained
            :tone="tone"
            label="Admin"
            :sections="demoSections(adminSections, state.modal)"
            :footer-items="footerItems"
            @select="(item, e) => pick('modal', item, e)"
          >
            <template #header>
              <BrandLogo variant="emblem" :size="48" alt="Deer Run Golf Course" />
            </template>
          </NavDrawer>
        </div>
      </div>
    </div>

    <!-- ── Navigation rail ── -->
    <div>
      <h3 class="text-title-m mb-1">Navigation rail</h3>
      <p class="text-body-m text-on-surface-variant mb-3">Tablets: menu button, FAB slot, badges (number and dot).</p>
      <div class="flex flex-wrap gap-4">
        <div v-for="tone in ['surface', 'primary']" :key="tone" :class="[FRAME, 'h-[600px] w-full max-w-[420px] flex']">
          <NavRail
            :tone="tone"
            contained
            show-menu
            label="Staff"
            :items="demoItems(staffItems, state.rail)"
            @menu="railMenu = tone"
            @select="(item, e) => pick('rail', item, e)"
          >
            <template #fab>
              <button
                type="button"
                aria-label="Request time off"
                class="state-layer w-14 h-14 rounded-shape-lg inline-flex items-center justify-center bg-gold-container text-on-gold-container shadow-elevation-3 cursor-pointer"
              >
                <IconAdd class="w-6 h-6" aria-hidden="true" />
              </button>
            </template>
          </NavRail>
          <div class="flex-1 min-w-0 flex flex-col border-l border-outline-variant">
            <TopAppBar :title="titleOf(state.rail)" title-tag="h4" :scrolled="false" />
            <p class="px-4 text-body-m text-on-surface-variant">
              {{ railMenu === tone ? 'The menu button was pressed (it would open a modal drawer).' : 'Destinations show a label under the icon.' }}
            </p>
            <DemoLines :count="5" />
          </div>
        </div>
      </div>
    </div>

    <!-- ── Bottom navigation bar ── -->
    <div>
      <h3 class="text-title-m mb-1">Bottom navigation bar</h3>
      <p class="text-body-m text-on-surface-variant mb-3">
        Phones, 3–5 destinations by role. "More" is a button that opens a drawer with the rest. While the real bar is
        mounted it sets --snackbar-offset on :root (not here: contained).
      </p>
      <div class="flex flex-wrap gap-4">
        <div v-for="demo in bottomDemos" :key="demo.key" :class="[FRAME, 'h-[480px] w-full max-w-[360px]']">
          <TopAppBar :title="titleOf(state[demo.key])" title-tag="h4" :subtitle="demo.role" :tone="demo.tone" :scrolled="false" />
          <DemoLines :count="7" />
          <BottomNavBar
            :tone="demo.tone"
            contained
            label="Staff"
            :items="demoItems(demo.items, state[demo.key], moreOpen[demo.key])"
            @select="(item, e) => pick(demo.key, item, e)"
            @more="moreOpen[demo.key] = true"
          />
          <NavDrawer
            v-model:open="moreOpen[demo.key]"
            variant="modal"
            contained
            :tone="demo.tone"
            label="More"
            :items="demoItems(moreItems, state[demo.key])"
            @select="(item, e) => pick(demo.key, item, e)"
          >
            <template #header>
              <span class="text-title-m">More</span>
            </template>
          </NavDrawer>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default { galleryTitle: 'Navigation', galleryNote: 'TopAppBar, NavDrawer, NavRail and BottomNavBar in surface and primary (pine) tones. Demos are contained in boxes; in the app they attach to the viewport.' }
</script>

<script setup>
import { defineComponent, h, reactive, ref } from 'vue'
import TopAppBar from '@/components/ui/TopAppBar.vue'
import NavDrawer from '@/components/ui/NavDrawer.vue'
import NavRail from '@/components/ui/NavRail.vue'
import BottomNavBar from '@/components/ui/BottomNavBar.vue'
import IconButton from '@/components/ui/IconButton.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import IconDashboard from '~icons/material-symbols/dashboard-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconBookOnline from '~icons/material-symbols/book-online-rounded'
import IconTrophy from '~icons/material-symbols/trophy-rounded'
import IconBadge from '~icons/material-symbols/badge-rounded'
import IconTimer from '~icons/material-symbols/timer-rounded'
import IconCalendar from '~icons/material-symbols/calendar-month-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'
import IconSell from '~icons/material-symbols/sell-rounded'
import IconPointOfSale from '~icons/material-symbols/point-of-sale-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'
import IconGroup from '~icons/material-symbols/group-rounded'
import IconSettings from '~icons/material-symbols/settings-rounded'
import IconMoreHoriz from '~icons/material-symbols/more-horiz-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconFlag from '~icons/material-symbols/flag-rounded'
import IconPunchClock from '~icons/material-symbols/punch-clock-rounded'
import IconKey from '~icons/material-symbols/key-rounded'
import IconLogout from '~icons/material-symbols/logout-rounded'
import IconHome from '~icons/material-symbols/home-rounded'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconMoreVert from '~icons/material-symbols/more-vert-rounded'
import IconBack from '~icons/material-symbols/arrow-back-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconAdd from '~icons/material-symbols/add-rounded'

const FRAME = 'relative isolate overflow-hidden rounded-shape-md border border-outline-variant bg-surface'

// Placeholder page content
const DemoLines = defineComponent({
  props: { count: { type: Number, default: 6 } },
  setup(props) {
    return () => h('div', { class: 'p-4 space-y-3', 'aria-hidden': 'true' },
      Array.from({ length: props.count }, (_, i) =>
        h('div', { class: ['h-4 rounded-full bg-surface-container-highest', i % 3 === 2 ? 'w-2/3' : 'w-full'] })))
  },
})

const adminSections = [
  { title: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: IconDashboard }] },
  { title: 'Golf', items: [
    { to: '/admin/teetimes', label: 'Tee Times', icon: IconSchedule },
    { to: '/admin/bookings', label: 'Bookings', icon: IconBookOnline },
    { to: '/admin/tournaments', label: 'Tournaments', icon: IconTrophy },
  ] },
  { title: 'Staff', items: [
    { to: '/admin/employees', label: 'Employees', icon: IconBadge },
    { to: '/admin/timesheets', label: 'Timesheets', icon: IconTimer },
    { to: '/admin/schedule', label: 'Schedule', icon: IconCalendar },
    { to: '/admin/time-off', label: 'Time Off', icon: IconBeach, badge: 3, badgeLabel: '3 pending requests' },
  ] },
  { title: 'Pro Shop', items: [
    { to: '/admin/products', label: 'Products', icon: IconSell },
    { to: '/admin/sales', label: 'Sales', icon: IconPointOfSale },
    { to: '/admin/registers', label: 'Registers', icon: IconReceipt },
    { to: '/admin/house-accounts', label: 'House Accounts', icon: IconWallet, badge: 128, badgeLabel: '128 overdue statements' },
  ] },
  { title: 'Admin', items: [
    { to: '/admin/users', label: 'Users', icon: IconGroup },
    { to: '/admin/settings', label: 'Settings', icon: IconSettings },
  ] },
]

const footerItems = [
  { to: '/', label: 'Back to site', icon: IconHome },
  { label: 'Sign out', icon: IconLogout, action: 'sign-out' },
]

const staffItems = [
  { to: '/staff', label: 'Clock', icon: IconPunchClock },
  { to: '/staff/schedule', label: 'Schedule', icon: IconCalendar },
  { to: '/staff/time-off', label: 'Time off', icon: IconBeach, badge: true, badgeLabel: 'Request updated' },
  { to: '/staff/teesheet', label: 'Tee sheet', icon: IconGolf },
  { to: '/staff/register', label: 'Register', icon: IconPointOfSale, badge: 2, badgeLabel: '2 card payments waiting' },
  { to: '/staff/oncourse', label: 'On course', icon: IconFlag },
]

const more = { label: 'More', icon: IconMoreHoriz, action: 'more' }
const moreItems = [
  { to: '/staff/timesheet', label: 'My Timesheet', icon: IconTimer },
  { to: '/staff/time-off', label: 'Time Off', icon: IconBeach },
  { to: '/staff/pin', label: 'Manager PIN', icon: IconKey },
  { to: '/', label: 'Back to site', icon: IconHome },
]

const byPath = Object.fromEntries(staffItems.map(i => [i.to, i]))
const bottomDemos = [
  { key: 'bottomStaff', role: 'Staff', tone: 'surface', items: [byPath['/staff'], byPath['/staff/schedule'], { ...byPath['/staff/time-off'], badge: 1, badgeLabel: '1 request approved' }, more] },
  { key: 'bottomRegister', role: 'Register users', tone: 'primary', items: [byPath['/staff'], byPath['/staff/teesheet'], byPath['/staff/register'], more] },
  { key: 'bottomCourse', role: 'Course staff', tone: 'surface', items: [byPath['/staff'], byPath['/staff/oncourse'], byPath['/staff/teesheet'], more] },
]

// Each demo keeps its own "current page"; clicks are intercepted so the gallery doesn't navigate away
const state = reactive({
  drawer: '/admin/time-off',
  modal: '/admin/bookings',
  rail: '/staff/register',
  bottomStaff: '/staff',
  bottomRegister: '/staff/teesheet',
  bottomCourse: '/staff/oncourse',
})
const modalOpen = reactive({ surface: false, primary: false })
const moreOpen = reactive({ bottomStaff: false, bottomRegister: false, bottomCourse: false })
const railMenu = ref(null)

function demoItems(items, current, moreExpanded = false) {
  return items.map(item => (item.to
    ? { ...item, active: item.to === current }
    : { ...item, expanded: moreExpanded, active: moreItems.some(m => m.to === current) && !items.some(i => i.to === current) }))
}
function demoSections(sections, current) {
  return sections.map(s => ({ ...s, items: demoItems(s.items, current) }))
}
function pick(key, item, event) {
  if (!item.to) return
  event?.preventDefault()
  state[key] = item.to
}

const allItems = [...adminSections.flatMap(s => s.items), ...staffItems, ...moreItems]
function titleOf(path) {
  return allItems.find(i => i.to === path)?.label ?? 'Deer Run'
}
</script>
