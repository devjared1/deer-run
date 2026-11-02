<template>
  <section
    v-if="shown.length"
    role="alert"
    aria-labelledby="behind-alert-title"
    class="rounded-shape-md bg-error-container text-on-error-container shadow-elevation-1 p-3 sm:p-4"
  >
    <div class="flex items-center gap-2">
      <IconWarning class="w-6 h-6 flex-none" aria-hidden="true" />
      <h2 id="behind-alert-title" class="flex-1 min-w-0 text-title-m">
        {{ shown.length === 1 ? '1 group' : `${shown.length} groups` }} {{ alertMinutes }}+ min behind
      </h2>
    </div>
    <ul class="mt-2 space-y-2">
      <li v-for="g in shown" :key="g.booking.id" class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="flex-1 min-w-[10rem] text-body-l">
          <span class="font-bold">{{ g.booking.name }}</span>
          · {{ teeTime(g.slot.startTime) }} tee time · hole {{ g.track.hole }}
          · <span class="font-bold">{{ formatMinutes(g.track.deltaMinutes) }} behind</span>
          <span v-if="g.track.reportedMinutesAgo != null" class="text-body-m"> (reported {{ formatMinutes(g.track.reportedMinutesAgo) }} ago)</span>
        </span>
        <AppButton variant="filled" :icon="IconLocation" @click="emit('update', g)">Update position</AppButton>
        <IconButton :icon="IconClose" :label="`Dismiss the alert for ${g.booking.name}`" variant="inherit" @click="dismiss(g)" />
      </li>
    </ul>
  </section>
</template>

<script setup>
// On Course: the groups at least `alertMinutes` behind their tee time (pace.js → behindGroups), at the top of the page
// (under the sticky pace bar) with a button to update their position. A phone vibrates when a group newly falls that far behind. Dismissing
// a group hides it until it slips another DISMISS_STEP minutes. Props: groups (trackedGroups items), alertMinutes
// (CourseSettings.behindAlertMinutes; 0 = off). Emits: update(group).
import { computed, reactive, watch } from 'vue'
import { behindGroups, formatMinutes } from '@/lib/pace'
import { teeTime } from '@/lib/teesheet'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconLocation from '~icons/material-symbols/my-location-rounded'
import IconClose from '~icons/material-symbols/close-rounded'

const DISMISS_STEP = 5

const props = defineProps({
  groups:       { type: Array, default: () => [] },
  alertMinutes: { type: Number, default: 0 },
})
const emit = defineEmits(['update'])

// bookingId → deltaMinutes when dismissed
const dismissed = reactive({})

const behind = computed(() => behindGroups(props.groups, props.alertMinutes))
const shown = computed(() => behind.value.filter(g =>
  dismissed[g.booking.id] == null || g.track.deltaMinutes >= dismissed[g.booking.id] + DISMISS_STEP))

function dismiss(g) {
  dismissed[g.booking.id] = g.track.deltaMinutes
}

// Vibrate once when a group appears in the list (not on every refresh)
let seen = new Set()
let first = true
watch(shown, list => {
  const ids = new Set(list.map(g => g.booking.id))
  const fresh = [...ids].some(id => !seen.has(id))
  seen = ids
  if (fresh && !first) navigator.vibrate?.([200, 100, 200])
  first = false
}, { immediate: true })
</script>
