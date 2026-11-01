<template>
  <BottomSheet
    :open="open"
    :title="title"
    persistent
    @update:open="v => emit('update:open', v)"
    @after-leave="emit('after-leave')"
  >
    <template v-if="booking">
      <p class="mb-4 text-body-l text-on-surface">
        {{ teeTimeLabel(teeSlot.date, teeSlot.startTime) }} · {{ playersText(booking.players) }}
      </p>
      <RoundSetupFields v-model="form" :carts-out="cartsOut" />
      <p v-if="!checkedIn" class="mt-4 text-body-m text-on-surface-variant">
        <strong class="text-on-surface">No add-ons, done</strong> checks the group in and stays here.
        <strong class="text-on-surface">Add items at the register</strong> checks them in and opens a sale with the
        prepaid greens fee at $0 for carts, range balls and drinks.
      </p>
      <ErrorBanner v-if="error" class="mt-4" :message="error" />
    </template>

    <template #actions="{ close }">
      <AppButton variant="text" :disabled="!!busy" @click="close">
        Back
      </AppButton>
      <template v-if="checkedIn">
        <AppButton :loading="busy === 'save'" @click="emit('submit', 'save')">
          Save
        </AppButton>
      </template>
      <template v-else>
        <AppButton
          variant="outlined"
          :icon="IconRegister"
          :loading="busy === 'register'"
          :disabled="!!busy && busy !== 'register'"
          @click="emit('submit', 'register')"
        >
          Add items at the register
        </AppButton>
        <AppButton
          :icon="IconDone"
          :loading="busy === 'done'"
          :disabled="!!busy && busy !== 'done'"
          data-autofocus
          @click="emit('submit', 'done')"
        >
          No add-ons, done
        </AppButton>
      </template>
    </template>
  </BottomSheet>
</template>

<script setup>
// Check-in (or "Carts and round" for a group already checked in) on the Tee Sheet: the round setup form plus
// the two ways to finish a check-in. A bottom sheet on phones, a dialog from md up.
// v-model:form is a setupForm() object (oncourse/roundSetup.js). busy: null | 'done' | 'register' | 'save'.
// Emits submit('done' | 'register' | 'save'); the page does the API calls.
import { computed } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import RoundSetupFields from '@/components/oncourse/RoundSetupFields.vue'
import { teeTimeLabel } from '@/lib/teesheet'
import { playersText } from './teeSheetDisplay'
import IconRegister from '~icons/material-symbols/point-of-sale-rounded'
import IconDone from '~icons/material-symbols/done-all-rounded'

const form = defineModel('form', { type: Object, default: null })
const props = defineProps({
  open:     { type: Boolean, default: false },
  booking:  { type: Object, default: null },
  teeSlot:  { type: Object, default: null },
  cartsOut: { type: Map, default: () => new Map() },
  busy:     { type: String, default: null },
  error:    { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'submit', 'after-leave'])

const checkedIn = computed(() => !!props.booking?.checkedInAt)
const title = computed(() => {
  if (!props.booking) return ''
  return `${checkedIn.value ? 'Carts and round' : 'Check in'}: ${props.booking.name}`
})
</script>
