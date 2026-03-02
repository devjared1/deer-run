<template>
  <div style="min-height:100vh;background:#F2EBD9;display:flex;flex-direction:column;">
    <AppNav />
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppNav from '@/components/layout/AppNav.vue'
import AppFooter from '@/components/layout/AppFooter.vue'

const auth = useAuthStore()
onMounted(() => auth.init())
</script>
