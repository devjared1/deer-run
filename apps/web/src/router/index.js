import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
