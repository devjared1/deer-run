<template>
  <div class="card rounded-lg p-6">
    <div class="flex items-center gap-3 mb-1">
      <button @click="$emit('back')" style="color:rgba(61,43,26,.4);font-size:20px;cursor:pointer;background:none;border:none;">←</button>
      <h2 style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#1E3D2F;">Choose a Tee Time</h2>
    </div>
    <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-bottom:24px;">
      {{ formattedDate }} · ${{ store.PRICE_PER_PLAYER }}/player w/ cart
    </p>

    <div v-if="loading" class="text-center py-12" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.4);">Loading tee times…</div>
    <div v-else-if="error" class="text-center py-8" style="font-family:'Lato',sans-serif;color:#8C4A2F;">{{ error }}</div>
    <div v-else>
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
        <button
          v-for="slot in slots"
          :key="slot.id"
          @click="selectSlot(slot)"
          :disabled="slot.full"
          :class="['rounded p-3 text-center transition-all', slot.full ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer']"
          :style="isSelected(slot)
            ? 'background:#C4873A;border:2px solid #C4873A;'
            : slot.full
              ? 'background:rgba(61,43,26,.06);border:1px solid rgba(61,43,26,.1);'
              : 'background:rgba(30,61,47,.05);border:1px solid rgba(30,61,47,.15);'"
        >
          <div class="font-bold text-sm" :style="isSelected(slot) ? 'font-family:Lato,sans-serif;color:#0D1F16;' : 'font-family:Lato,sans-serif;color:#1E3D2F;'">
            {{ formatTime(slot.startTime) }}
          </div>
          <div class="text-xs mt-1" :style="isSelected(slot) ? 'font-family:Lato,sans-serif;color:rgba(13,31,22,.7);' : 'font-family:Lato,sans-serif;color:rgba(61,43,26,.4);'">
            {{ slot.full ? 'Full' : `${slot.available} open` }}
          </div>
        </button>
      </div>

      <!-- Player count -->
      <div v-if="selectedSlot" class="mb-6 p-4 rounded" style="background:rgba(30,61,47,.06);">
        <div style="font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(61,43,26,.5);margin-bottom:10px;">Number of Players</div>
        <div class="flex gap-2">
          <button
            v-for="n in playerOptions"
            :key="n"
            @click="store.players = n"
            class="w-10 h-10 rounded font-bold text-sm transition-all"
            :style="store.players === n
              ? 'background:#1E3D2F;color:#F2EBD9;font-family:Lato,sans-serif;border:none;cursor:pointer;'
              : 'background:rgba(61,43,26,.08);color:#3D2B1A;font-family:Lato,sans-serif;border:1px solid rgba(61,43,26,.15);cursor:pointer;'"
          >
            {{ n }}
          </button>
        </div>
        <div class="mt-3 flex justify-between">
          <span style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.55);">Total (incl. cart)</span>
          <span style="font-family:'Playfair Display',serif;font-size:20px;font-weight:900;color:#1E3D2F;">${{ store.totalPrice }}</span>
        </div>
      </div>

      <button
        @click="$emit('next')"
        :disabled="!selectedSlot"
        class="btn-amber w-full justify-center"
        :style="!selectedSlot ? 'opacity:.4;cursor:not-allowed;' : ''"
      >
        Continue to Details →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBookingStore } from '@/stores/booking'

const emit = defineEmits(['next', 'back'])
const store = useBookingStore()

const slots   = ref([])
const loading = ref(true)
const error   = ref('')

const selectedSlot = computed({
  get: () => store.selectedSlot,
  set: (val) => { store.selectedSlot = val },
})

const formattedDate = computed(() => {
  if (!store.selectedDate) return ''
  return new Date(store.selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})

const playerOptions = computed(() => {
  const max = selectedSlot.value?.available ?? 4
  return Array.from({ length: Math.min(max, 4) }, (_, i) => i + 1)
})

function isSelected(slot) { return store.selectedSlot?.id === slot.id }
function selectSlot(slot) {
  store.selectedSlot = slot
  // Clamp players to available
  if (store.players > slot.available) store.players = slot.available
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`
}

onMounted(async () => {
  if (!store.selectedDate) { error.value = 'No date selected.'; loading.value = false; return }
  try {
    slots.value = await store.fetchAvailableSlots(store.selectedDate)
  } catch (e) {
    error.value = 'Unable to load tee times. Please call (256) 974-7384.'
  } finally {
    loading.value = false
  }
})
</script>
