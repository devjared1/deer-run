<template>
  <!-- Printing this opens the cash drawer (the printer driver kicks it on every job) -->
  <div class="receipt">
    <div class="center title">NO SALE</div>
    <div class="rule" />
    <div>{{ when }}</div>
    <div>{{ registerName }}</div>
    <div>Approved by {{ approverName }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COURSE_TZ } from '@/lib/timeclock'

const props = defineProps({
  at: { type: String, required: true },
  registerName: { type: String, default: '' },
  approverName: { type: String, default: '' },
})

const when = computed(() => new Date(props.at).toLocaleString('en-US', {
  month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
}))
</script>

<style scoped>
.receipt { width: 72mm; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; background: #fff; }
.center  { text-align: center; }
.title   { font-weight: bold; font-size: 14px; }
.rule    { border-top: 1px dashed #000; margin: 6px 0; }
</style>
