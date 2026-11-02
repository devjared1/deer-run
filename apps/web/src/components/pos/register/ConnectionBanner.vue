<template>
  <div
    role="alert"
    class="flex flex-wrap items-center gap-x-4 gap-y-2 bg-error-container text-on-error-container px-4 py-3 border-b border-error/30"
  >
    <IconCloudOff class="w-6 h-6 flex-none" aria-hidden="true" />
    <div class="flex-1 min-w-[14rem]">
      <p class="text-title-m">Connection lost</p>
      <p class="text-body-m">
        Sales can't be saved until it's back. The cart is kept, so finish the sale once the connection returns.
      </p>
    </div>
    <AppButton variant="outlined" :icon="IconRefresh" :loading="checking" @click="emit('retry')">
      {{ checking ? 'Checking…' : 'Check now' }}
    </AppButton>
  </div>
</template>

<script setup>
// The register's connection-lost banner (see useRegisterConnection). Shown above the products and cart while the
// server can't be reached; Charge is disabled meanwhile. Props: checking (a check is running). Emits: retry.
import AppButton from '@/components/ui/AppButton.vue'
import IconCloudOff from '~icons/material-symbols/cloud-off-rounded'
import IconRefresh from '~icons/material-symbols/refresh-rounded'

defineProps({
  checking: { type: Boolean, default: false },
})
const emit = defineEmits(['retry'])
</script>
