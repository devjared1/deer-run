<template>
  <AppDialog
    :open="true"
    :title="mode === 'open' ? 'Open the cash drawer' : 'Close the cash drawer'"
    size="sm"
    persistent
    initial-focus="[data-keypad]"
  >
    <p class="text-body-m text-on-surface-variant mb-4">
      <template v-if="mode === 'open'">
        {{ resumeTender ? 'The drawer has to be open to take cash. ' : '' }}Count the cash in the drawer before the first sale.
      </template>
      <template v-else>Count all the cash in the drawer, including the starting cash.</template>
    </p>

    <NumericKeypad
      ref="keypad"
      v-model="digits"
      data-keypad
      class="mx-auto"
      :label="mode === 'open' ? 'Starting cash' : 'Counted cash'"
      left-key="00"
      :max-length="8"
      :format="v => formatCents(Number(v || 0))"
      placeholder="$0.00"
      :hint="pristine && initialCents !== null ? 'Last starting cash. Type to change it.' : ''"
      :disabled="busy"
      @update:model-value="onType"
      @submit="submit"
    />

    <TextField
      v-model="note"
      class="mt-4"
      label="Note (optional)"
      maxlength="300"
      autocomplete="off"
      :placeholder="mode === 'close' ? 'e.g. $20 to the safe at 2 PM' : undefined"
      :disabled="busy"
      @keydown.enter.prevent="submit"
    />

    <ErrorBanner v-if="error" class="mt-4" :message="error" />

    <template #actions>
      <AppButton variant="text" :disabled="busy" @click="emit('cancel')">Cancel</AppButton>
      <AppButton variant="gold" size="lg" :loading="busy" :disabled="digits === ''" @click="submit">
        {{ mode === 'open' ? 'Open drawer' : 'Close drawer' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Open (starting float) or close (blind count) the register's cash drawer. The amount is typed on a touch keypad in
// cents ("2" "0" "00" "00" → $200.00), so the register PC's on-screen keyboard never comes up for it.
// Props: mode 'open' | 'close', initialCents (open: the last starting cash, prefilled; the first key replaces it),
// resumeTender (open: say why the drawer is needed), busy, error.
// Emits submit({ cents, note }), cancel.
import { ref } from 'vue'
import { formatCents } from '@/lib/money'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import TextField from '@/components/ui/TextField.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'

const props = defineProps({
  mode:         { type: String, required: true, validator: v => ['open', 'close'].includes(v) },
  initialCents: { type: Number, default: null },
  resumeTender: { type: Boolean, default: false },
  busy:         { type: Boolean, default: false },
  error:        { type: String, default: null },
})
const emit = defineEmits(['submit', 'cancel'])

const initial = props.mode === 'open' && props.initialCents !== null ? String(props.initialCents) : ''
const digits = ref(initial)
const note = ref('')
// While the suggested amount is untouched, the first digit starts a new amount instead of appending to it
const pristine = ref(initial !== '')

function onType(value) {
  if (!pristine.value) return
  pristine.value = false
  if (value.length > initial.length && value.startsWith(initial)) digits.value = value.slice(initial.length)
}

function submit() {
  if (props.busy || digits.value === '') return
  emit('submit', { cents: Number(digits.value), note: note.value })
}
</script>
