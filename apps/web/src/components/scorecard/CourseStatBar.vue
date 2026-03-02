<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div v-for="s in stats" :key="s.label" class="card rounded-lg p-4 text-center">
      <div style="font-family:'Playfair Display',serif;font-size:30px;font-weight:900;color:#1E3D2F;">{{ s.val }}</div>
      <div style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(61,43,26,.45);margin-top:2px;">{{ s.label }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  teeSet: { type: Object, required: true },
})

const stats = computed(() => [
  { label: 'Total Yards',    val: props.teeSet.total.toLocaleString() },
  { label: 'Par',            val: '72' },
  { label: 'Course Rating',  val: props.teeSet.rating },
  { label: 'Slope Rating',   val: props.teeSet.slope },
])
</script>
