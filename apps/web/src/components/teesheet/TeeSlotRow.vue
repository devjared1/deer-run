<template>
  <section
    :aria-label="`${teeTime(teeSlot.startTime)}, ${availability}`"
    :class="['grid gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-4', compact ? 'py-2' : 'py-4']"
  >
    <header :class="['flex flex-wrap items-baseline gap-x-3 gap-y-1', compact ? 'sm:col-span-2' : 'sm:block']">
      <h2 :class="['text-title-l tabular-nums', past ? 'text-on-surface-variant' : 'text-on-surface']">
        {{ teeTime(teeSlot.startTime) }}
      </h2>
      <p :class="['text-body-m', teeSlot.available ? 'text-on-surface-variant' : 'text-on-surface font-bold']">
        {{ availability }}
      </p>
      <p v-if="teeSlot.memberOnly" class="flex items-center gap-1 text-body-m text-on-surface-variant sm:mt-1">
        <IconMember class="w-4 h-4 flex-none text-secondary" aria-hidden="true" />
        Members only
      </p>
      <p v-if="past" :class="['text-body-s text-on-surface-variant', compact ? '' : 'sm:mt-1']">
        Started
      </p>
    </header>

    <div v-if="!compact" class="min-w-0 space-y-3">
      <div v-if="teeSlot.bookings.length" class="grid gap-3 lg:grid-cols-2">
        <BookingCard
          v-for="b in teeSlot.bookings"
          :key="b.id"
          :booking="b"
          :course-note="noteFor(b)"
          :busy="busyId === b.id"
          @check-in="emit('action', 'check-in', b)"
          @register="emit('action', 'register', b)"
          @setup="emit('action', 'setup', b)"
          @undo="emit('action', 'undo', b)"
          @move="emit('action', 'move', b)"
          @cancel="emit('action', 'cancel', b)"
        />
      </div>

      <!-- The whole row books the open spots (walk-in / phone) -->
      <button
        v-if="teeSlot.available && !past"
        type="button"
        class="state-layer w-full min-h-12 flex items-center gap-3 px-4 py-2 rounded-shape-md border border-dashed border-outline text-left text-on-surface font-body cursor-pointer"
        @click="emit('book')"
      >
        <IconAdd class="w-6 h-6 flex-none text-primary" aria-hidden="true" />
        <span class="flex-1 min-w-0 text-body-l font-bold">
          {{ activeCount ? `${teeSlot.available} more open` : 'Open' }}: tap to book
        </span>
        <span class="hidden sm:inline text-body-m text-on-surface-variant">
          Walk-in or phone
        </span>
      </button>
    </div>
  </section>
</template>

<script setup>
// One tee time on the staff Tee Sheet: the time, its open spots, a BookingCard per booking and, when there's room
// and it hasn't started, an "Open: tap to book" row. Emits action(name, booking) for the cards and book().
import { computed } from 'vue'
import { teeTime } from '@/lib/teesheet'
import BookingCard from './BookingCard.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconMember from '~icons/material-symbols/card-membership-rounded'

const props = defineProps({
  teeSlot: { type: Object, required: true },
  past:   { type: Boolean, default: false },
  // (booking) → course note for BookingCard, or null
  noteFor: { type: Function, default: () => null },
  busyId: { type: String, default: null },
})
const emit = defineEmits(['action', 'book'])

// A tee time that has started with nobody on it: one short line
const compact = computed(() => props.past && !props.teeSlot.bookings.length)
const activeCount = computed(() => props.teeSlot.bookings.filter(b => b.holdsSpot).length)
const availability = computed(() => {
  const { available, maxPlayers } = props.teeSlot
  if (!available) return 'Full'
  return available === maxPlayers ? 'Open' : `${available} of ${maxPlayers} open`
})
</script>
