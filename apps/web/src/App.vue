<template>
  <!-- Public pages leave room at the bottom for AppNav's sticky "Book a tee time" bar on phones -->
  <div
    :class="[
      'min-h-screen flex flex-col bg-surface-container',
      isPortal ? '' : 'pb-[var(--bottom-bar-height,0px)] print:pb-0',
    ]"
  >
    <AppNav v-if="!isPortal" />
    <main id="main" ref="main" tabindex="-1" class="flex-1 outline-none">
      <RouterView />
    </main>
    <AppFooter v-if="!isPortal" />
    <!-- One host each for useConfirm() and useSnackbar(), shared by every layout -->
    <ConfirmDialog />
    <AppSnackbar />
  </div>
</template>

<script setup>
import AppFooter from '@/components/layout/AppFooter.vue'
import AppNav from '@/components/layout/AppNav.vue'
import AppSnackbar from '@/components/ui/AppSnackbar.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useHead } from '@unhead/vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Same text as the static description in index.html (what crawlers without JavaScript see)
const DEFAULT_DESCRIPTION = '18-hole public golf course nestled at the entrance to the Bankhead National Forest in Moulton, Alabama. Earl Stone design, open since 1980.'

const auth   = useAuthStore()
const route  = useRoute()
const router = useRouter()
const main   = ref(null)

// Admin and staff pages have their own layouts (sidebar + header), so the public site's nav and
// footer are hidden there. route.meta includes the parent /admin or /staff route's meta.
const isPortal = computed(() => !!(route.meta.requiresAdmin || route.meta.requiresStaff || route.meta.bare))

// <title> and the description meta from the route's meta.title / meta.description (unhead, registered in main.js).
// Child routes' meta wins over the parent's (route.meta is merged), so /admin/sales gets "Sales & Reports".
const SITE = 'Deer Run Golf Course'
useHead({
  title: computed(() => (route.path === '/' || !route.meta.title ? `${SITE} — Moulton, Alabama` : `${route.meta.title} · ${SITE}`)),
  meta: [
    { name: 'description', content: computed(() => route.meta.description || DEFAULT_DESCRIPTION) },
    // Portals, the 404 page and anything with meta.noindex stay out of search results
    { name: 'robots', content: computed(() => (route.meta.noindex || isPortal.value ? 'noindex' : 'index, follow')) },
  ],
})

// After a client-side navigation, move focus to the new page's content so screen readers start there (and the
// next Tab continues from the top of the page), as a full page load would. Not on the first load, not when only
// the query or hash changed, and not inside the admin/staff portals, whose shells manage focus themselves (the
// register focuses its scan field).
router.afterEach(async (to, from, failure) => {
  if (failure || !from.matched.length || to.path === from.path) return
  if (to.meta.requiresAdmin || to.meta.requiresStaff || to.meta.bare) return
  await nextTick()
  main.value?.focus({ preventScroll: true })
})

onMounted(() => auth.init())
</script>
