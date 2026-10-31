<template>
  <section class="topo py-10 print:py-0">
    <div class="max-w-3xl mx-auto px-5 print:px-0 print:max-w-none">
      <div class="flex items-center gap-3 mb-4 print:hidden">
        <RouterLink to="/account" class="text-sm text-lake hover:text-pine font-body">
          ← My Account
        </RouterLink>
        <button v-if="data" class="btn-outline-pine ml-auto" style="padding:8px 16px;font-size:12px;" @click="print">
          Print
        </button>
      </div>
      <p v-if="loading" class="text-bark/50 font-body">
        Loading…
      </p>
      <p v-else-if="error" class="text-clay font-body">
        {{ error }}
      </p>
      <StatementDocument v-else-if="data" :statement="data.statement" :member="data.member" />
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apiFetch } from '@/lib/api'
import StatementDocument from '@/components/accounts/StatementDocument.vue'

// A member's saved house account statement, printable (GET /api/account/statements/:id)
const route   = useRoute()
const data    = ref(null)
const loading = ref(true)
const error   = ref(null)

function print() {
  window.print()
}

onMounted(async () => {
  try {
    data.value = await apiFetch(`/api/account/statements/${route.params.id}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>
