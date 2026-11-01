import { useAuthStore } from '@/stores/auth'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/',             component: () => import('@/views/HomeView.vue') },
  { path: '/scorecard',    component: () => import('@/views/ScorecardView.vue') },
  { path: '/rates',        component: () => import('@/views/RatesView.vue') },
  { path: '/memberships',  component: () => import('@/views/MembershipsView.vue') },
  { path: '/tournaments',  component: () => import('@/views/TournamentsView.vue') },
  { path: '/contact',      component: () => import('@/views/ContactView.vue') },
  { path: '/book',         component: () => import('@/views/BookView.vue') },
  { path: '/confirmation', component: () => import('@/views/ConfirmationView.vue') },
  { path: '/login',        component: () => import('@/views/LoginView.vue') },
  { path: '/account',      component: () => import('@/views/AccountView.vue'), meta: { requiresAuth: true } },
  { path: '/account/statements/:id', component: () => import('@/views/StatementView.vue'), meta: { requiresAuth: true } },

  // Admin section
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      { path: '',           component: () => import('@/views/admin/DashboardView.vue') },
      { path: 'teetimes',   component: () => import('@/views/admin/TeeTimesView.vue') },
      { path: 'bookings',   component: () => import('@/views/admin/BookingsView.vue') },
      { path: 'tournaments',component: () => import('@/views/admin/TournamentsView.vue') },
      { path: 'settings',   component: () => import('@/views/admin/SettingsView.vue') },
      { path: 'users',      component: () => import('@/views/admin/UsersView.vue') },
      { path: 'employees',  component: () => import('@/views/admin/EmployeesView.vue') },
      { path: 'timesheets', component: () => import('@/views/admin/TimesheetsView.vue') },
      { path: 'schedule',   component: () => import('@/views/admin/ScheduleView.vue') },
      { path: 'time-off',   component: () => import('@/views/admin/TimeOffView.vue') },
      { path: 'products',   component: () => import('@/views/admin/ProductsView.vue') },
      { path: 'sales',      component: () => import('@/views/admin/SalesView.vue') },
      { path: 'house-accounts',     component: () => import('@/views/admin/HouseAccountsView.vue') },
      { path: 'house-accounts/:id', component: () => import('@/views/admin/HouseAccountDetailView.vue') },
      { path: 'registers',  component: () => import('@/views/admin/RegistersView.vue') },
    ],
  },

  // Staff portal (employees with an active Employee record linked to their login)
  {
    path: '/staff',
    component: () => import('@/views/staff/StaffLayout.vue'),
    meta: { requiresStaff: true },
    children: [
      { path: '',          component: () => import('@/views/staff/TimeClockView.vue') },
      { path: 'timesheet', component: () => import('@/views/staff/MyTimesheetView.vue') },
      { path: 'schedule',  component: () => import('@/views/staff/MyScheduleView.vue') },
      { path: 'time-off',  component: () => import('@/views/staff/TimeOffView.vue') },
      { path: 'register',  component: () => import('@/views/staff/RegisterView.vue'), meta: { requiresRegister: true } },
      { path: 'teesheet',  component: () => import('@/views/staff/TeeSheetView.vue'), meta: { requiresRegister: true } },
      { path: 'oncourse',  component: () => import('@/views/staff/OnCourseView.vue'), meta: { requiresCourse: true } },
      { path: 'pin',       component: () => import('@/views/staff/ManagerPinView.vue'), meta: { requiresRegisterManager: true } },
    ],
  },
  // Component gallery for design review: every src/components/ui component in every state. Dev server only,
  // or a build with VITE_UI_GALLERY=true (e.g. a staging preview).
  ...(import.meta.env.DEV || import.meta.env.VITE_UI_GALLERY === 'true'
    ? [{ path: '/dev/ui', component: () => import('@/views/dev/UiGalleryView.vue'), meta: { bare: true } }]
    : []),
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
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
