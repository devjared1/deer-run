<template>
  <div class="space-y-3">
    <div>
      <div class="text-label-l text-on-surface-variant mb-1" aria-hidden="true">Receipt</div>
      <SegmentedButton
        :model-value="choice"
        :options="OPTIONS"
        label="Receipt"
        size="lg"
        block
        @update:model-value="v => $emit('update:choice', v)"
      />
    </div>
    <TextField
      v-if="choice === 'email'"
      :model-value="email"
      label="Customer email"
      type="email"
      inputmode="email"
      autocomplete="off"
      :error="email && !valid ? 'Enter an email like name@example.com' : ''"
      @update:model-value="v => $emit('update:email', v)"
    />
  </div>
</template>

<script setup>
// Receipt choice for the POS dialogs: None / Print / Email as a segmented button; Email shows the address field.
//   <ReceiptChoice v-model:choice="receipt" v-model:email="email" />
// choice: 'none' | 'print' | 'email'.
import { computed } from 'vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import TextField from '@/components/ui/TextField.vue'
import IconNone from '~icons/material-symbols/do-not-disturb-on-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'

const props = defineProps({
  choice: { type: String, default: 'print' },
  email:  { type: String, default: '' },
})
defineEmits(['update:choice', 'update:email'])

const OPTIONS = [
  { value: 'none', label: 'None', icon: IconNone },
  { value: 'print', label: 'Print', icon: IconPrint },
  { value: 'email', label: 'Email', icon: IconMail },
]
const valid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email.trim()))
</script>
