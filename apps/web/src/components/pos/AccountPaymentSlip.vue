<template>
  <!-- House account payment receipt on 80 mm paper (printing also opens the drawer for cash) -->
  <div class="receipt">
    <div class="center title">
      Deer Run Golf Course
    </div>
    <div class="center">
      House account payment
    </div>
    <div class="rule" />
    <div>{{ when }}</div>
    <div>{{ registerName }}</div>
    <div>{{ memberName }}</div>
    <div class="rule" />
    <div class="row strong"><span>Paid ({{ methodLabel }})</span><span>{{ money(-payment.amountCents) }}</span></div>
    <div v-if="changeCents" class="row"><span>Change</span><span>{{ money(changeCents) }}</span></div>
    <div class="row"><span>New balance</span><span>{{ money(payment.balanceCents) }}</span></div>
    <div class="rule" />
    <div class="center">
      Thank you!
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COURSE_TZ } from '@/lib/timeclock'

const props = defineProps({
  payment:      { type: Object, required: true }, // ledger entry + balanceCents
  memberName:   { type: String, default: '' },
  registerName: { type: String, default: '' },
  changeCents:  { type: Number, default: 0 },
})

const methodLabel = computed(() => ({ CASH: 'cash', CARD: 'card' }[props.payment.method] ?? props.payment.method))
const when = computed(() => new Date(props.payment.createdAt).toLocaleString('en-US', {
  month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
}))
const money = (cents) => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`
</script>

<style scoped>
.receipt { width: 72mm; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; background: #fff; }
.center  { text-align: center; }
.title   { font-weight: bold; font-size: 14px; }
.rule    { border-top: 1px dashed #000; margin: 6px 0; }
.row     { display: flex; justify-content: space-between; gap: 8px; }
.strong  { font-weight: bold; }
</style>
