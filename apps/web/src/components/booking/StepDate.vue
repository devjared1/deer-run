<template>
  <div class="card rounded-lg p-6">
    <h2 style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#1E3D2F;margin-bottom:4px;">
      Select a Date
    </h2>
    <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-bottom:12px;">
      Tee times available up to {{ authStore.maxBookDays }} days in advance.
    </p>

    <hr
      class="mb-2 p-0"
      style="border-bottom: 1px solid rgba(61,43,26,.12);"
    >

    <!-- Calendar grid -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <button
          class="btn-outline-pine"
          style="padding:4px 8px;"
          @click="prevMonth"
        >
          ‹
        </button>
        <div style="font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:#1E3D2F;">
          {{ monthLabel }}
        </div>
        <button
          class="btn-outline-pine"
          style="padding:4px 8px;"
          @click="nextMonth"
        >
          ›
        </button>
      </div>

      <!-- Day headers -->
      <div class="grid grid-cols-7">
        <div
          v-for="d in ['Su','Mo','Tu','We','Th','Fr','Sa']"
          :key="d"
          class="text-center text-xs font-bold uppercase"
          style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.4);letter-spacing:.08em;"
        >
          {{ d }}
        </div>
      </div>

      <!-- Day cells -->
      <div class="grid grid-cols-7 gap-1">
        <div
          v-for="cell in calendarCells"
          :key="cell.key"
          class="flex items-center justify-center w-full h-9"
        >
          <button
            v-if="cell.date"
            :disabled="cell.disabled"
            class="w-full h-full flex items-center justify-center rounded text-xs font-bold transition-all"
            :style="cellStyle(cell)"
            @click="selectDate(cell.date)"
          >
            {{ cell.day }}
          </button>
        </div>
      </div>
    </div>

    <button
      :disabled="!selectedDate"
      class="btn-amber w-full justify-center"
      :style="!selectedDate ? 'opacity:.4;cursor:not-allowed;' : ''"
      @click="$emit('next')"
    >
      Choose a Tee Time →
    </button>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { computed, ref } from 'vue';

const emit = defineEmits(['next'])
const bookingStore = useAuthStore()
const authStore    = useAuthStore()
const store        = useBookingStore()

const today    = new Date()
today.setHours(0, 0, 0, 0)
const maxDate  = new Date(today)
maxDate.setDate(today.getDate() + authStore.maxBookDays)

const currentMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))

const monthLabel = computed(() => {
  return currentMonth.value.toLocaleString('default', { month: 'long', year: 'numeric' })
})

const selectedDate = computed({
  get: () => store.selectedDate,
  set: (val) => { store.selectedDate = val },
})

const formattedDate = computed(() => {
  if (!selectedDate.value) return ''
  return new Date(selectedDate.value + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})

const calendarCells = computed(() => {
  const year  = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const cells = []

  // Leading blanks
  for (let i = 0; i < first.getDay(); i++) cells.push({ key: `blank-${i}`, date: null })

  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d)
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({
      key: dateStr,
      date: dateStr,
      day: d,
      disabled: date < today || date > maxDate,
      isToday: date.getTime() === today.getTime(),
      selected: selectedDate.value === dateStr,
    })
  }
  return cells
})

function cellStyle(cell) {
  if (cell.disabled) return 'font-family:Lato,sans-serif;color:rgba(61,43,26,.2);cursor:not-allowed;'
  if (cell.selected) return 'font-family:Lato,sans-serif;background:#C4873A;color:#0D1F16;cursor:pointer;'
  if (cell.isToday)  return 'font-family:Lato,sans-serif;background:rgba(30,61,47,.1);color:#1E3D2F;cursor:pointer;font-weight:900;'
  return 'font-family:Lato,sans-serif;color:#3D2B1A;cursor:pointer;'
}

function selectDate(dateStr) {
  selectedDate.value = dateStr
  store.selectedSlot = null
}

function prevMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1)
}
function nextMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1)
}
</script>
