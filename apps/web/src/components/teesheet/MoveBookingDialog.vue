<template>
  <AppDialog
    :open="open"
    :title="booking ? `Move ${booking.name}` : 'Move booking'"
    size="md"
    @update:open="v => emit('update:open', v)"
    @after-leave="emit('after-leave')"
  >
    <template v-if="booking">
      <p class="mb-4 text-body-m text-on-surface-variant">
        Now {{ teeTimeLabel(teeSlot.date, teeSlot.startTime) }} · {{ playersText(booking.players) }}.
        The price doesn't change<span v-if="booking.source === 'ONLINE'">; the golfer is emailed the new time</span>.
      </p>
      <TextField v-model="day" type="date" label="Date" :min="today" class="mb-4" />

      <ErrorBanner v-if="error" class="mb-3" :message="error" />
      <Skeleton v-if="loading" variant="rect" height="160px" label="Loading tee times" />
      <p v-else-if="slots && !options.length" class="text-body-m text-on-surface">
        No tee times left on this day.
      </p>
      <div
        v-else-if="slots"
        class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto p-0.5"
        role="group"
        aria-label="New tee time"
      >
        <!-- Pressed-state buttons (each a tab stop), not radios: there's no arrow-key navigation in this grid -->
        <button
          v-for="opt in options"
          :key="opt.slot.id"
          type="button"
          :aria-pressed="String(selected === opt.slot.id)"
          :disabled="!!opt.reason"
          :class="[
            'state-layer min-h-14 rounded-shape-sm border px-2 py-1.5 text-left font-body',
            opt.reason
              ? 'border-outline-variant text-on-surface/[.38] cursor-not-allowed'
              : selected === opt.slot.id
                ? 'bg-primary text-on-primary border-primary cursor-pointer'
                : 'border-outline text-on-surface cursor-pointer',
          ]"
          @click="selected = opt.slot.id"
        >
          <span class="block text-title-m">{{ teeTime(opt.slot.startTime) }}</span>
          <span class="block text-body-s">{{ opt.reason || `${opt.slot.available} open` }}</span>
        </button>
      </div>
    </template>

    <template #actions="{ close }">
      <AppButton variant="text" @click="close">
        Back
      </AppButton>
      <AppButton :loading="saving" :disabled="!selected" @click="confirm">
        Move booking
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Move a paid, not checked-in booking to another tee time (any day that hasn't started).
// Loads that day's tee sheet itself and POSTs { action: 'move' }; emits moved({ target, emailError }).
import { computed, ref, watch } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import TextField from '@/components/ui/TextField.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { apiFetch } from '@/lib/api'
import { isValidYmd, localDate, localDateTimeToUtc } from '@/lib/timeclock'
import { teeTime, teeTimeLabel } from '@/lib/teesheet'
import { playersText } from './teeSheetDisplay'

const props = defineProps({
  open:    { type: Boolean, default: false },
  booking: { type: Object, default: null },
  teeSlot: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'moved', 'after-leave'])

const today    = localDate()
const day      = ref(today)
const slots    = ref(null)
const loading  = ref(false)
const error    = ref('')
const selected = ref(null)
const saving   = ref(false)

const isPast = s => localDateTimeToUtc(s.date, s.startTime) < new Date()

watch(() => props.open, (open) => {
  if (!open || !props.teeSlot) return
  const d = props.teeSlot.date < today ? today : props.teeSlot.date
  slots.value = null
  error.value = ''
  if (day.value === d) load()
  else day.value = d   // the day watcher loads it
}, { immediate: true })

watch(day, (d, old) => { if (props.open && d !== old) load() })

async function load({ keepError = false } = {}) {
  if (!isValidYmd(day.value)) return
  loading.value = true
  if (!keepError) error.value = ''
  selected.value = null
  try {
    slots.value = (await apiFetch(`/api/staff/teesheet?date=${day.value}`)).slots
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Tee times on the chosen day that haven't started, with a reason when one can't take the group
const options = computed(() => {
  if (!slots.value || !props.booking) return []
  const b = props.booking
  const member = b.customer?.isMember || b.customer?.role === 'ADMIN'
  return slots.value
    .filter(s => s.id !== props.teeSlot.id && !isPast(s))
    .map(s => ({
      slot: s,
      reason: s.available < b.players
        ? (s.available ? `${s.available} open` : 'Full')
        : (s.memberOnly && !member ? 'Members only' : null),
    }))
})

async function confirm() {
  const target = slots.value.find(s => s.id === selected.value)
  saving.value = true
  error.value = ''
  try {
    const res = await apiFetch(`/api/staff/teesheet/${props.booking.id}`, { method: 'POST', body: { action: 'move', teeTimeSlotId: selected.value } })
    emit('moved', { target, emailError: res.emailError ?? null })
  } catch (e) {
    error.value = e.message
    load({ keepError: true })
  } finally {
    saving.value = false
  }
}
</script>
