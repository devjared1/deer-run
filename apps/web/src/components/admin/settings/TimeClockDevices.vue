<template>
  <Card variant="outlined" padding="lg" tag="section" aria-labelledby="kiosks-heading">
    <h2 id="kiosks-heading" class="font-display text-headline-s text-on-surface">Time clock iPads</h2>
    <p class="mt-1 text-body-m text-on-surface-variant">
      A shared device where employees tap their name and clock in with their time clock PIN. To add one, open
      <span class="text-on-surface whitespace-nowrap">{{ origin }}/timeclock</span> on the iPad and sign in as an
      admin; you're signed out once it's set up. Set PINs in Employees.
    </p>

    <ErrorBanner v-if="error" class="mt-4" :message="error" @retry="load" />

    <div v-else-if="loading" class="mt-4">
      <Skeleton height="56px" label="Loading time clocks" />
    </div>

    <ul v-else-if="kiosks.length" class="mt-4 divide-y divide-outline-variant border-y border-outline-variant">
      <li v-for="k in kiosks" :key="k.id" class="flex items-center gap-3 py-3">
        <IconTablet class="w-6 h-6 flex-none text-on-surface-variant" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-title-s text-on-surface break-words">{{ k.name }}</p>
          <p class="text-body-s text-on-surface-variant">
            Set up {{ formatDate(k.createdAt) }} · {{ k.lastSeenAt ? `last used ${formatWhen(k.lastSeenAt)}` : 'not used yet' }}
          </p>
        </div>
        <AppButton variant="text-danger" :loading="removing === k.id" :disabled="!!removing" @click="remove(k)">
          Remove
        </AppButton>
      </li>
    </ul>
    <p v-else class="mt-4 text-body-m text-on-surface-variant">No time clock iPads set up yet.</p>

    <AppButton variant="outlined" :icon="IconOpen" to="/timeclock" target="_blank" class="mt-4">
      Open the time clock
    </AppButton>
  </Card>
</template>

<script setup>
// Admin → Settings → Payroll: the time clock kiosks (GET /api/admin/kiosks) with Remove (DELETE, signs the device
// out). Devices are added from the device itself, at /timeclock.
import { ref, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { COURSE_TZ } from '@/lib/timeclock'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import Card from '@/components/ui/Card.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import IconTablet from '~icons/material-symbols/tablet-mac-rounded'
import IconOpen from '~icons/material-symbols/open-in-new-rounded'

const confirm = useConfirm()
const snackbar = useSnackbar()

const origin = window.location.origin.replace(/^https?:\/\//, '')
const kiosks = ref([])
const loading = ref(true)
const error = ref(null)
const removing = ref(null)

const formatDate = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: COURSE_TZ })
const formatWhen = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })

async function load() {
  loading.value = true
  error.value = null
  try {
    kiosks.value = await apiFetch('/api/admin/kiosks')
  } catch (e) {
    error.value = e.status === 500 && /ClockKiosk/.test(e.message)
      ? 'Time clock iPads need a database update first (migration 13).'
      : e.message
  } finally {
    loading.value = false
  }
}

async function remove(k) {
  const ok = await confirm({
    title: `Remove ${k.name}?`,
    message: 'It stops working as a time clock right away and shows the set-up screen. Punches already made are kept.',
    confirmLabel: 'Remove',
    destructive: true,
  })
  if (!ok) return
  removing.value = k.id
  try {
    await apiFetch(`/api/admin/kiosks/${k.id}`, { method: 'DELETE' })
    kiosks.value = kiosks.value.filter(x => x.id !== k.id)
    snackbar.show(`${k.name} removed`)
  } catch (e) {
    error.value = e.message
  } finally {
    removing.value = null
  }
}

onMounted(load)
</script>
