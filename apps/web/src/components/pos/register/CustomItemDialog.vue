<template>
  <AppDialog :open="true" title="Custom item" size="sm" persistent>
    <form id="custom-item-form" class="space-y-4" @submit.prevent="add">
      <TextField v-model="description" label="Description" maxlength="100" autocomplete="off" required data-autofocus />
      <MoneyField v-model="priceCents" label="Price" :min="1" required helper="Custom items are taxed at the course rate." />
    </form>
    <template #actions>
      <AppButton variant="text" @click="emit('cancel')">Cancel</AppButton>
      <AppButton variant="gold" size="lg" type="submit" form="custom-item-form" :icon="IconAdd" :disabled="!valid">Add</AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// A one-off line (description + price). Emits add({ description, priceCents }) and cancel.
import { computed, ref } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import TextField from '@/components/ui/TextField.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import IconAdd from '~icons/material-symbols/add-rounded'

const emit = defineEmits(['add', 'cancel'])

const description = ref('')
const priceCents = ref(null)
const valid = computed(() => !!description.value.trim() && priceCents.value > 0)

function add() {
  if (valid.value) emit('add', { description: description.value.trim(), priceCents: priceCents.value })
}
</script>
