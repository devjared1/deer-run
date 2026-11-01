<template>
  <AppDialog
    :open="open"
    :title="teeSlot ? `Book ${teeTime(teeSlot.startTime)}` : 'Book a tee time'"
    persistent
    @update:open="v => emit('update:open', v)"
    @after-leave="emit('after-leave')"
  >
    <template v-if="teeSlot">
      <p class="mb-4 text-body-m text-on-surface-variant">
        {{ formatLocalDate(teeSlot.date, { weekday: 'long', month: 'short', day: 'numeric' }) }} ·
        {{ teeSlot.available }} spot{{ teeSlot.available === 1 ? '' : 's' }} open
      </p>
      <p v-if="teeSlot.memberOnly" class="mb-4 flex items-start gap-2 text-body-m text-on-surface">
        <IconMember class="w-5 h-5 flex-none text-secondary" aria-hidden="true" />
        Members only: attach the member at the register.
      </p>
      <div class="space-y-5">
        <SegmentedButton v-model="source" label="Booking type" size="lg" block :options="SOURCES" />
        <div class="space-y-2">
          <p class="text-label-l text-on-surface-variant" aria-hidden="true">
            Players
          </p>
          <SegmentedButton v-model="players" label="Players" size="lg" block :options="playerOptions" />
        </div>
        <TextField
          v-model="name"
          label="Name for the tee sheet"
          maxlength="80"
          autocomplete="off"
          placeholder="e.g. Smith party"
          helper="Or leave blank and attach the customer's account at the register."
        />
      </div>
    </template>

    <template #actions="{ close }">
      <AppButton variant="text" @click="close">
        Cancel
      </AppButton>
      <AppButton variant="gold" :trailing-icon="IconArrow" @click="submit">
        Continue to register
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Walk-in / phone booking from an open tee time. Collects source, players and a name; emits
// submit({ slot, source, players, name }) and the page hands it to the register (paid there, saved with the sale).
import { computed, ref, watch } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import TextField from '@/components/ui/TextField.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import { formatLocalDate } from '@/lib/timeclock'
import { teeTime } from '@/lib/teesheet'
import IconMember from '~icons/material-symbols/card-membership-rounded'
import IconArrow from '~icons/material-symbols/arrow-forward-rounded'

const SOURCES = [
  { value: 'POS',   label: 'Walk-in' },
  { value: 'PHONE', label: 'Phone booking' },
]

const props = defineProps({
  open: { type: Boolean, default: false },
  teeSlot: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'submit', 'after-leave'])

const source  = ref('POS')
const players = ref(1)
const name    = ref('')

const playerOptions = computed(() => Array.from({ length: props.teeSlot?.available ?? 0 }, (_, i) => ({ value: i + 1, label: String(i + 1) })))

watch(() => props.open, (open) => {
  if (!open || !props.teeSlot) return
  source.value = 'POS'
  players.value = Math.min(props.teeSlot.available, 4)
  name.value = ''
}, { immediate: true })

function submit() {
  emit('submit', { slot: props.teeSlot, source: source.value, players: players.value, name: name.value.trim() })
}
</script>
