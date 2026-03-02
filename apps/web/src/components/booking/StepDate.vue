<template>
  <div class="card rounded-lg p-6">
    <h2 style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#1E3D2F;margin-bottom:4px;">Select a Date</h2>
    <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-bottom:24px;">
      Tee times available up to {{ authStore.maxBookDays }} days in advance.
    </p>

    <!-- Calendar grid -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <button @click="prevMonth" class="btn-outline-pine" style="padding:6px 12px;">‹</button>
        <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#1E3D2F;">
          {{ monthLabel }}
        </div>
        <button @click="nextMonth" class="btn-outline-pine" style="padding:6px 12px;">›</button>
      </div>

      <!-- Day headers -->
      <div class="grid grid-cols-7 mb-2">
        <div v-for="d in ['Su','Mo','Tu','We','Th','Fr','Sa']" :key="d"
          class="text-center text-xs font-bold uppercase py-1"
          style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.4);letter-spacing:.08em;"
        >{{ d }}</div>
      </div>

      <!-- Day cells -->
      <div class="grid grid-cols-7 gap-1">
        <div v-for="cell in calendarCells" :key="cell.key" class="aspect-square">
          <button
            v-if="cell.date"
            @click="selectDate(cell.date)"
            :disabled="cell.disabled"
            class="w-full h-full flex items-center justify-center rounded text-sm font-bold transition-all"
            :style="cellStyle(cell)"
          >
            {{ cell.day }}
          </button>
        </div>
      </div>
    </div>

    <!-- Selected summary -->
    <div v-if="selectedDate" class="mb-6 p-3 rounded" style="background:rgba(30,61,47,.06);">
      <span style="font-family:'Lato',sans-serif;font-size:13px;color:#1E3D2F;font-weight:700;">
        Selected: {{ formattedDate }}
      </span>
    </div>

    <button
      @click="$emit('next')"
      :disabled="!selectedDate"
      class="btn-amber w-full justify-center"
      :style="!selectedDate ? 'opacity:.4;cursor:not-allowed;' : ''"
    >
      Choose a Tee Time →
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBookingStore } from '@/stores/booking'
import { useAuthStore } from '@/stores/auth'

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
