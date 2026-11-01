<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2" role="group" aria-label="Preview page">
      <button
        v-for="p in pages"
        :key="p.path"
        type="button"
        :class="[
          'state-layer h-8 px-3 rounded-shape-sm border text-label-l cursor-pointer',
          fakeRoute.path === p.path ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-on-surface-variant',
        ]"
        @click="show(p)"
      >
        {{ p.meta.title }}
      </button>
    </div>

    <!-- transform contains the shell's fixed/sticky parts; the modal drawer still teleports to <body> -->
    <div class="shell-box relative overflow-hidden rounded-shape-md border border-outline-variant" style="transform: translateZ(0)">
      <div class="h-full overflow-y-auto">
        <AdminLayout>
          <div class="space-y-4" aria-hidden="true">
            <div class="h-24 rounded-shape-md bg-surface-container" />
            <div v-for="i in 10" :key="i" :class="['h-4 rounded-full bg-surface-container-highest', i % 3 === 0 ? 'w-2/3' : 'w-full']" />
          </div>
        </AdminLayout>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Admin shell (preview)',
  galleryNote: 'AdminLayout with a fake route and signed-in profile: drawer at lg+, rail at md, modal drawer below md. Pick a page to move the active indicator and title.',
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, provide, reactive } from 'vue'
import { routeLocationKey } from 'vue-router'
import AdminLayout from '@/views/admin/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { usePendingTimeOff } from '@/composables/usePendingTimeOff'

const pages = [
  { path: '/admin', meta: { title: 'Dashboard' } },
  { path: '/admin/time-off', meta: { title: 'Time Off Requests' } },
  {
    path: '/admin/house-accounts/demo',
    meta: {
      title: 'House Account',
      breadcrumbs: [{ label: 'House Accounts', to: '/admin/house-accounts' }, { label: 'House Account' }],
    },
  },
]

// AdminLayout and the nav components read the route with useRoute(); give them a fake one
const fakeRoute = reactive({ path: pages[2].path, fullPath: pages[2].path, meta: pages[2].meta, params: {}, query: {}, hash: '', matched: [] })
provide(routeLocationKey, fakeRoute)
function show(p) {
  Object.assign(fakeRoute, { path: p.path, fullPath: p.path, meta: p.meta })
}

// A signed-in admin who is also staff, and a pending time off badge (the API isn't there in plain Vite)
const authStore = useAuthStore()
const { pending } = usePendingTimeOff()
let savedProfile = null
onMounted(() => {
  savedProfile = authStore.profile
  if (!savedProfile) authStore.profile = { email: 'gm@example.com', role: 'ADMIN', employee: { active: true } }
  setTimeout(() => { pending.value = 3 }, 300)
})
onBeforeUnmount(() => {
  authStore.profile = savedProfile
})
</script>

<style scoped>
.shell-box { height: 720px; }
/* The shell sizes itself to the viewport; in the preview the box is the viewport */
.shell-box :deep(.h-screen) { height: 720px; }
.shell-box :deep(.min-h-screen) { min-height: 720px; }
</style>
