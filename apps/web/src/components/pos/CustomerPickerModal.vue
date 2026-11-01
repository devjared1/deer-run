<template>
  <AppDialog :open="true" title="Attach customer" size="md" @update:open="v => !v && emit('close')">
    <!-- Room below the field for the results list (it overlays the dialog body) -->
    <div class="min-h-[22rem]">
      <CustomerSearch autofocus label="Customer" placeholder="Name or email" @select="u => emit('pick', u)" />
      <p class="mt-3 px-1 text-body-s text-on-surface-variant">
        Active members get member pricing and their Pro Shop discount on this sale.
      </p>
    </div>
    <template #actions="{ close }">
      <AppButton variant="text" @click="close">Cancel</AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Attach a customer to the sale (register): CustomerSearch over GET /api/staff/register/customers?search=, which
// returns the full customer (isMember, role, membershipTier, houseAccount). Mounted with v-if; Esc / Cancel emit
// close (a search term isn't worth keeping the dialog open for). Emits pick(customer).
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import CustomerSearch from '@/components/ui/CustomerSearch.vue'

const emit = defineEmits(['pick', 'close'])
</script>
