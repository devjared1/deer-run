<template>
  <div class="space-y-8">
    <div>
      <h3 class="text-title-m mb-3">Snackbar (useSnackbar)</h3>
      <div class="flex flex-wrap gap-3">
        <AppButton variant="tonal" @click="snackbar.show('Saved')">Simple</AppButton>
        <AppButton variant="tonal" @click="withUndo">With Undo</AppButton>
        <AppButton variant="tonal" @click="snackbar.show({ message: 'Receipt printed', icon: IconCheck })">With icon</AppButton>
        <AppButton variant="tonal" @click="snackbar.show({ message: 'Could not save the shift. Check your connection and try again.', tone: 'error', actionLabel: 'Retry', onAction: () => snackbar.show('Saved') })">Error</AppButton>
        <AppButton variant="tonal" @click="snackbar.show({ message: 'Stays until closed', duration: 0 })">No timeout</AppButton>
        <AppButton variant="outlined" @click="queueThree">Queue three</AppButton>
      </div>
      <p class="mt-2 text-body-m text-on-surface-variant">Undo count: {{ undone }}</p>
    </div>

    <div>
      <h3 class="text-title-m mb-3">ErrorBanner</h3>
      <div class="space-y-3 max-w-2xl">
        <ErrorBanner message="Couldn't load the tee sheet." :retrying="retrying" @retry="retry" />
        <ErrorBanner v-if="showDismissible" title="Card declined" message="The reader reported: insufficient funds." @dismiss="showDismissible = false" />
        <AppButton v-else variant="text" @click="showDismissible = true">Show the dismissible banner again</AppButton>
        <ErrorBanner>
          Plain banner from the slot: <strong>Cash needs an open drawer.</strong>
        </ErrorBanner>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">EmptyState</h3>
      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-shape-md bg-surface-container-low">
          <EmptyState
            :icon="IconEventBusy"
            title="No tournaments yet"
            message="Create one to list it on the Tournaments page."
            action-label="New tournament"
            :action-icon="IconAdd"
            @action="snackbar.show('New tournament')"
          />
        </div>
        <div class="rounded-shape-md bg-surface-container-low">
          <EmptyState :icon="IconSearchOff" title="No matching sales" message="Try another date range or receipt number." action-label="Go home" to="/" />
        </div>
        <div class="rounded-shape-md bg-surface-container-low">
          <EmptyState compact :icon="IconReceipt" message="No sales today." action-label="Open the register" @action="snackbar.show('Register')" />
          <EmptyState compact title="Default icon" />
        </div>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">Skeleton</h3>
      <div class="grid gap-6 md:grid-cols-2">
        <div class="space-y-4">
          <Skeleton variant="text" :lines="3" label="Loading bookings" />
          <Skeleton variant="text" :lines="1" width="40%" />
          <div class="flex items-center gap-3">
            <Skeleton variant="circle" />
            <Skeleton variant="circle" size="56px" />
            <Skeleton variant="rect" width="120px" height="40px" />
          </div>
          <Skeleton variant="rect" height="120px" />
        </div>
        <div class="space-y-4">
          <Skeleton variant="card" label="Loading employees" />
          <Skeleton variant="card" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default { galleryTitle: 'Feedback', galleryNote: 'The snackbar and confirm hosts are mounted in the Dialogs section for now.' }
</script>

<script setup>
import { ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useSnackbar } from '@/composables/useSnackbar.js'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconCheck from '~icons/material-symbols/check-circle-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconSearchOff from '~icons/material-symbols/search-off-rounded'

const snackbar = useSnackbar()

const undone = ref(0)
function withUndo() {
  snackbar.show({ message: 'Shift deleted', actionLabel: 'Undo', onAction: () => { undone.value++ } })
}
function queueThree() {
  snackbar.show('First of three')
  snackbar.show('Second of three')
  snackbar.show('Third of three')
}

const retrying = ref(false)
function retry() {
  retrying.value = true
  setTimeout(() => {
    retrying.value = false
    snackbar.show('Loaded')
  }, 1500)
}
const showDismissible = ref(true)
</script>
