<template>
  <div style="min-height:100vh;background:#F2EBD9;display:flex;flex-direction:column;">
    <AppNav v-if="!isPortal" class="print:hidden" />
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter v-if="!isPortal" class="print:hidden" />
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
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const auth  = useAuthStore()
const route = useRoute()

// Admin and staff pages have their own layouts (sidebar + header), so the public site's nav and
// footer are hidden there. route.meta includes the parent /admin or /staff route's meta.
const isPortal = computed(() => !!(route.meta.requiresAdmin || route.meta.requiresStaff || route.meta.bare))

onMounted(() => auth.init())
</script>
