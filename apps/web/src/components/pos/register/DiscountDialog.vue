<template>
  <AppDialog :open="true" title="Discount" size="sm" persistent initial-focus="[data-keypad]">
    <p class="text-body-m text-on-surface-variant mb-3">{{ description }} · {{ formatCents(grossCents) }}</p>

    <SegmentedButton v-model="mode" block size="lg" label="Discount type" :options="modes" class="mb-3" @update:model-value="digits = ''" />

    <NumericKeypad
      :key="mode"
      v-model="digits"
      data-keypad
      autofocus
      class="mx-auto"
      :label="mode === '$' ? 'Amount off' : 'Percent off'"
      :left-key="mode === '$' ? '00' : '.'"
      :max-length="mode === '$' ? 8 : 5"
      :format="mode === '$' ? v => formatCents(Number(v || 0)) : v => `${v}%`"
      :placeholder="mode === '$' ? '$0.00' : '0%'"
      :hint="preview"
      @submit="apply"
    />

    <template #actions>
      <AppButton variant="text" class="mr-auto" @click="emit('cancel')">Cancel</AppButton>
      <AppButton v-if="currentCents" variant="text-danger" :icon="IconDelete" @click="emit('apply', 0)">Remove</AppButton>
      <AppButton variant="gold" size="lg" @click="apply">Apply</AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// The manager's line discount (the approval is asked for before this opens): an amount (keypad in cents) or a percent
// of what's left after any member discount. Emits apply(cents) (0 removes it) and cancel; the parent caps it.
import { computed, ref } from 'vue'
import { formatCents } from '@/lib/money'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import IconDelete from '~icons/material-symbols/delete-rounded'

const props = defineProps({
  description:  { type: String, required: true },
  grossCents:   { type: Number, required: true },
  currentCents: { type: Number, default: 0 },
})
const emit = defineEmits(['apply', 'cancel'])

const modes = [{ value: '$', label: 'Amount' }, { value: '%', label: 'Percent' }]
const mode = ref('$')
const digits = ref(props.currentCents ? String(props.currentCents) : '')

const cents = computed(() => {
  const n = Number(digits.value)
  if (!digits.value || !(n > 0)) return 0
  return Math.min(mode.value === '%' ? Math.round((props.grossCents * n) / 100) : Math.round(n), props.grossCents)
})
const preview = computed(() => (mode.value === '%' && cents.value ? `${formatCents(cents.value)} off` : ''))

function apply() {
  emit('apply', cents.value)
}
</script>
