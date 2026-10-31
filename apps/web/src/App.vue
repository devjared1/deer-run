<template>
  <div style="min-height:100vh;background:#F2EBD9;display:flex;flex-direction:column;">
    <AppNav v-if="!isPortal" class="print:hidden" />
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter v-if="!isPortal" class="print:hidden" />
  </div>
</template>

<script setup>
import AppFooter from '@/components/layout/AppFooter.vue'
import AppNav from '@/components/layout/AppNav.vue'
import { useAuthStore } from '@/stores/auth'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const auth  = useAuthStore()
const route = useRoute()

// Admin and staff pages have their own layouts (sidebar + header), so the public site's nav and
// footer are hidden there. route.meta includes the parent /admin or /staff route's meta.
const isPortal = computed(() => !!(route.meta.requiresAdmin || route.meta.requiresStaff))

onMounted(() => auth.init())
</script>
