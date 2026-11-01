<template>
  <section class="py-6 md:py-10 print:py-0">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 print:px-0 print:max-w-none">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-3 mb-6 print:hidden">
        <IconButton :icon="IconArrowBack" label="Back to My Account" to="/account" class="-ml-3" />
        <h1 class="flex-1 min-w-0 font-display text-headline-s text-on-surface">
          {{ data ? `${monthLabel} statement` : 'Statement' }}
        </h1>
        <div v-if="data" class="flex flex-wrap gap-2">
          <AppButton variant="outlined" :icon="IconPrint" @click="print">Print</AppButton>
          <AppButton variant="filled" :icon="IconDownload" :loading="downloading" @click="downloadPdf">Download PDF</AppButton>
        </div>
      </div>

      <div v-if="loading" class="rounded-shape-md bg-surface-container-lowest p-6 sm:p-8 space-y-6 print:hidden">
        <Skeleton variant="rect" height="56px" label="Loading the statement" />
        <Skeleton variant="text" :lines="3" />
        <Skeleton variant="rect" height="180px" />
      </div>

      <Card v-else-if="notFound" variant="outlined" class="print:hidden">
        <EmptyState
          :icon="IconReceipt"
          title="Statement not found"
          message="It may belong to another account, or the link may be mistyped. Your statements are listed in My Account."
          action-label="Back to My Account"
          :action-icon="IconArrowBack"
          to="/account"
        />
      </Card>

      <ErrorBanner
        v-else-if="error"
        title="We couldn't load this statement"
        :message="error"
        :retrying="retrying"
        class="print:hidden"
        @retry="load(true)"
      />

      <!-- Wide statement table: scroll inside its own box on phones, never the page -->
      <div v-else-if="data" class="overflow-x-auto print:overflow-visible">
        <StatementDocument :statement="data.statement" :member="data.member" class="min-w-[36rem] print:min-w-0" />
      </div>
    </div>
  </section>
</template>

<script setup>
// A member's saved house account statement: printable, and as the same PDF that's emailed
// (GET /api/account/statements/:id and ?format=pdf).
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { apiFetch } from '@/lib/api'
import { formatLocalDate } from '@/lib/timeclock'
import { useAuthStore } from '@/stores/auth'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatementDocument from '@/components/accounts/StatementDocument.vue'
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded'
import IconDownload from '~icons/material-symbols/download-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'

const route    = useRoute()
const auth     = useAuthStore()
const snackbar = useSnackbar()

const data        = ref(null)
const loading     = ref(true)
const retrying    = ref(false)
const error       = ref(null)
const notFound    = ref(false)
const downloading = ref(false)

const monthLabel = computed(() => (data.value ? formatLocalDate(data.value.statement.periodStart, { month: 'long', year: 'numeric' }) : ''))

useHead({ title: computed(() => (data.value ? `${monthLabel.value} statement · Deer Run Golf Course` : 'Statement · Deer Run Golf Course')) })

function print() {
  window.print()
}

async function load(retry = false) {
  if (retry) retrying.value = true
  try {
    data.value = await apiFetch(`/api/account/statements/${encodeURIComponent(route.params.id)}`)
    error.value = null
  } catch (e) {
    if (e.status === 404) notFound.value = true
    else error.value = e.status ? (e.message || 'Please try again.') : 'Check your connection and try again.'
  } finally {
    loading.value = false
    retrying.value = false
  }
}

// "attachment; filename="deer-run-statement-2026-10.pdf"" → the filename
function filenameFrom(res) {
  const m = /filename="?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') || '')
  return m ? m[1] : `deer-run-statement-${data.value.statement.periodStart.slice(0, 7)}.pdf`
}

async function downloadPdf() {
  downloading.value = true
  try {
    const res = await fetch(`/api/account/statements/${encodeURIComponent(route.params.id)}?format=pdf`, {
      headers: { Authorization: `Bearer ${auth.getToken()}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'The PDF couldn\'t be downloaded. Please try again, or print the statement instead.')
    }
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = filenameFrom(res)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    snackbar.show({
      message: e instanceof TypeError ? 'Check your connection and try again.' : e.message,
      tone: 'error',
    })
  } finally {
    downloading.value = false
  }
}

onMounted(load)
</script>
