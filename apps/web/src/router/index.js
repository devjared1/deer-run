import { useAuthStore } from '@/stores/auth'
import { createRouter, createWebHistory } from 'vue-router'

// meta.title → "<title> · Deer Run Golf Course" (App.vue, via @unhead/vue); meta.description → the description meta
// (public pages). meta.noindex keeps a page out of search results (the portals are noindex automatically).
const routes = [
  {
    path: '/',
    component: () => import('@/views/HomeView.vue'),
    meta: {
      title: 'Home',
      description: '18-hole public golf course nestled at the entrance to the Bankhead National Forest in Moulton, Alabama. Earl Stone design, open since 1980.',
    },
  },
  {
    path: '/scorecard',
    component: () => import('@/views/ScorecardView.vue'),
    meta: { title: 'The Course', description: 'Hole-by-hole scorecard for Deer Run Golf Course: par, handicap and yardage from every tee.' },
  },
  { path: '/course', redirect: '/scorecard' },
  {
    // Hole-by-hole pages, 1–18 (other numbers go to the 404 page)
    path: '/course/hole/:n(\\d+)',
    component: () => import('@/views/HoleView.vue'),
    meta: { title: 'Hole', description: 'Hole-by-hole guide to Deer Run Golf Course: par, handicap and yardage from every tee.' },
    beforeEnter: to => (Number(to.params.n) >= 1 && Number(to.params.n) <= 18 ? true : { path: '/not-found' }),
  },
  {
    path: '/rates',
    component: () => import('@/views/RatesView.vue'),
    meta: { title: 'Rates', description: 'Green fees, cart fees and course policies at Deer Run Golf Course in Moulton, Alabama.' },
  },
  {
    path: '/memberships',
    component: () => import('@/views/MembershipsView.vue'),
    meta: { title: 'Memberships', description: 'Compare Deer Run Golf Course membership options and benefits, and ask about joining.' },
  },
  {
    path: '/tournaments',
    component: () => import('@/views/TournamentsView.vue'),
    meta: { title: 'Tournaments', description: 'Upcoming tournaments and events at Deer Run Golf Course, and results from past ones.' },
  },
  {
    path: '/tournaments/:id',
    component: () => import('@/views/EventView.vue'),
    meta: { title: 'Event', description: 'Tournament details and registration at Deer Run Golf Course.' },
  },
  {
    path: '/accessibility',
    component: () => import('@/views/AccessibilityView.vue'),
    meta: { title: 'Accessibility', description: 'Accessibility statement for the Deer Run Golf Course website.' },
  },
  {
    path: '/contact',
    component: () => import('@/views/ContactView.vue'),
    meta: { title: 'Contact', description: 'Directions, hours, phone and email for Deer Run Golf Course, 1175 County Road 100, Moulton, Alabama.' },
  },
  {
    path: '/book',
    component: () => import('@/views/BookView.vue'),
    meta: { title: 'Book a Tee Time', description: 'Book a tee time online at Deer Run Golf Course: pick a day, a time and your group size.' },
  },
  {
    path: '/confirmation',
    component: () => import('@/views/ConfirmationView.vue'),
    meta: { title: 'Booking Confirmation', description: 'Your Deer Run Golf Course tee time booking.', noindex: true },
  },
  {
    path: '/login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Sign In', description: 'Sign in to your Deer Run Golf Course account.' },
  },
  {
    path: '/account',
    component: () => import('@/views/AccountView.vue'),
    meta: { requiresAuth: true, title: 'My Account', description: 'Your Deer Run Golf Course bookings, membership and house account.', noindex: true },
  },
  {
    path: '/account/statements/:id',
    component: () => import('@/views/StatementView.vue'),
    meta: { requiresAuth: true, title: 'Statement', description: 'A Deer Run Golf Course house account statement.', noindex: true },
  },

  // Admin section (meta.title is also the admin shell's page title)
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAdmin: true, title: 'Admin' },
    children: [
      { path: '',           component: () => import('@/views/admin/DashboardView.vue'),   meta: { title: 'Dashboard' } },
      { path: 'teetimes',   component: () => import('@/views/admin/TeeTimesView.vue'),    meta: { title: 'Tee Time Management' } },
      { path: 'bookings',   component: () => import('@/views/admin/BookingsView.vue'),    meta: { title: 'Booking Management' } },
      { path: 'tournaments',component: () => import('@/views/admin/TournamentsView.vue'), meta: { title: 'Tournament Scheduling' } },
      { path: 'settings',   component: () => import('@/views/admin/SettingsView.vue'),    meta: { title: 'Course Settings' } },
      { path: 'users',      component: () => import('@/views/admin/UsersView.vue'),       meta: { title: 'User Management' } },
      { path: 'employees',  component: () => import('@/views/admin/EmployeesView.vue'),   meta: { title: 'Employee Management' } },
      { path: 'timesheets', component: () => import('@/views/admin/TimesheetsView.vue'),  meta: { title: 'Timesheets' } },
      { path: 'schedule',   component: () => import('@/views/admin/ScheduleView.vue'),    meta: { title: 'Schedule' } },
      { path: 'time-off',   component: () => import('@/views/admin/TimeOffView.vue'),     meta: { title: 'Time Off Requests' } },
      { path: 'products',   component: () => import('@/views/admin/ProductsView.vue'),    meta: { title: 'Products & Inventory' } },
      { path: 'sales',      component: () => import('@/views/admin/SalesView.vue'),       meta: { title: 'Sales & Reports' } },
      { path: 'house-accounts',     component: () => import('@/views/admin/HouseAccountsView.vue'), meta: { title: 'House Accounts' } },
      {
        path: 'house-accounts/:id',
        component: () => import('@/views/admin/HouseAccountDetailView.vue'),
        meta: { title: 'House Account', breadcrumbs: [{ label: 'House Accounts', to: '/admin/house-accounts' }] },
      },
      { path: 'registers',  component: () => import('@/views/admin/RegistersView.vue'),   meta: { title: 'Registers' } },
    ],
  },

  // Staff portal (employees with an active Employee record linked to their login)
  {
    path: '/staff',
    component: () => import('@/views/staff/StaffLayout.vue'),
    meta: { requiresStaff: true, title: 'Staff' },
    children: [
      { path: '',          component: () => import('@/views/staff/TimeClockView.vue'),   meta: { title: 'Time Clock' } },
      { path: 'timesheet', component: () => import('@/views/staff/MyTimesheetView.vue'), meta: { title: 'My Timesheet' } },
      { path: 'schedule',  component: () => import('@/views/staff/MyScheduleView.vue'),  meta: { title: 'My Schedule' } },
      { path: 'time-off',  component: () => import('@/views/staff/TimeOffView.vue'),     meta: { title: 'Time Off' } },
      // registerMode: the staff shell goes full-bleed (no sidebar padding, rail collapsed)
      {
        path: 'register',
        component: () => import('@/views/staff/RegisterView.vue'),
        meta: { requiresRegister: true, registerMode: true, title: 'Register' },
      },
      { path: 'teesheet',  component: () => import('@/views/staff/TeeSheetView.vue'),   meta: { requiresRegister: true, title: 'Tee Sheet' } },
      { path: 'oncourse',  component: () => import('@/views/staff/OnCourseView.vue'),   meta: { requiresCourse: true, title: 'On Course' } },
      { path: 'pin',       component: () => import('@/views/staff/ManagerPinView.vue'), meta: { requiresRegisterManager: true, title: 'Manager PIN' } },
    ],
  },
  // Component gallery for design review: every src/components/ui component in every state. Dev server only,
  // or a build with VITE_UI_GALLERY=true (e.g. a staging preview).
  ...(import.meta.env.DEV || import.meta.env.VITE_UI_GALLERY === 'true'
    ? [{ path: '/dev/ui', component: () => import('@/views/dev/UiGalleryView.vue'), meta: { bare: true, title: 'UI Gallery', noindex: true } }]
    : []),

  // Anything else: a friendly 404 (keep it last)
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Page not found', description: 'This page doesn’t exist at Deer Run Golf Course.', noindex: true },
  },
]

// The sticky public header (AppNav: 64px, 72px from md) plus some air, so #hash targets aren't hidden under it
function headerOffset() {
  return (window.matchMedia('(min-width: 768px)').matches ? 72 : 64) + 16
}
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Back/forward restores the position; #hash scrolls to that element below the header; a new page starts at the
  // top. Smooth only for a hash link within the same page, and never with prefers-reduced-motion.
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) {
      let found = false
      try { found = !!document.querySelector(to.hash) } catch { /* not a valid selector */ }
      if (found) {
        const smooth = to.path === from.path && !reduceMotion()
        return { el: to.hash, top: headerOffset(), behavior: smooth ? 'smooth' : 'auto' }
      }
    }
    if (to.path === from.path) return false // only the query changed (filters, tabs): stay put
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  // Wait for the session and profile to load so a page refresh doesn't look signed out
  await auth.init()
  if (to.meta.requiresAdmin) {
    if (!auth.isLoggedIn) return { path: '/login', query: { redirect: to.fullPath } }
    if (!auth.isAdmin) return { path: '/' }
  }
  if (to.meta.requiresStaff) {
    if (!auth.isLoggedIn) return { path: '/login', query: { redirect: to.fullPath } }
    if (!auth.isStaff) return { path: '/' }
    if (to.meta.requiresRegister && !auth.canUseRegister) return { path: '/staff' }
    if (to.meta.requiresRegisterManager && !auth.isRegisterManager) return { path: '/staff' }
    if (to.meta.requiresCourse && !auth.canTrackCourse) return { path: '/staff' }
  }
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
