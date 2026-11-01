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
    <AppFooter v-if="!isPortal && routeReady" />
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
import { headTags, pageSeo } from '@/lib/seo'
import { useAuthStore } from '@/stores/auth'
import { useHead } from '@unhead/vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const auth   = useAuthStore()
const route  = useRoute()
const router = useRouter()
const main   = ref(null)

// Admin and staff pages have their own layouts (sidebar + header), so the public site's nav and
// footer are hidden there. route.meta includes the parent /admin or /staff route's meta.
const isPortal = computed(() => !!(route.meta.requiresAdmin || route.meta.requiresStaff || route.meta.bare))

// The footer waits for the first page: until the lazy view has loaded, <main> is empty and the footer would sit
// in the viewport, then jump down when the page renders (a big layout shift on every first load)
const routeReady = ref(false)
router.isReady().catch(() => {}).then(() => { routeReady.value = true })

// Head tags from the route (src/lib/seo.js; unhead is registered in main.js): <title> from meta.title, the
// description, robots (portals, the 404 page and meta.noindex stay out of search results), canonical, Open Graph and
// Twitter card (share image from meta.ogImage) and the course JSON-LD on the home page. Child routes' meta wins over
// the parent's (route.meta is merged), so /admin/sales gets "Sales & Reports". The build writes the same tags into
// each public page's HTML (scripts/prerender.mjs); unhead adopts those instead of adding a second copy.
useHead(computed(() => headTags(pageSeo(route))))

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
