<template>
  <div class="receipt">
    <div class="center">
      <div class="title">Deer Run Golf Course</div>
      <div>{{ refund.kind === 'VOID' ? 'VOID' : 'REFUND' }}</div>
    </div>
    <div class="rule" />
    <div class="row"><span>Original receipt #{{ sale.number }}</span></div>
    <div>{{ when }} · {{ registerName }}</div>
    <div>Approved by {{ refund.approval?.approver?.firstName }} {{ refund.approval?.approver?.lastName }}</div>
    <div>Reason: {{ refund.reason }}</div>
    <div class="rule" />
    <div v-for="ri in refund.items" :key="ri.id" class="row">
      <span>{{ ri.quantity }} × {{ descriptions[ri.saleItemId] }}</span>
      <span>−{{ money(ri.amountCents) }}</span>
    </div>
    <div class="rule" />
    <div class="row"><span>Tax refunded</span><span>−{{ money(refund.taxCents) }}</span></div>
    <div class="row total"><span>Cash refunded</span><span>{{ money(refund.amountCents) }}</span></div>
    <div class="rule" />
    <div class="sign">Customer signature</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COURSE_TZ } from '@/lib/timeclock'

const props = defineProps({
  sale: { type: Object, required: true },
  refund: { type: Object, required: true },
  registerName: { type: String, default: '' },
})

const descriptions = computed(() => Object.fromEntries(props.sale.items.map(i => [i.id, i.description])))
const when = computed(() => new Date(props.refund.createdAt).toLocaleString('en-US', {
  month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
}))
const money = (cents) => `$${(cents / 100).toFixed(2)}`
</script>

<style scoped>
.receipt { width: 72mm; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; background: #fff; }
.center  { text-align: center; }
.title   { font-weight: bold; font-size: 14px; }
.rule    { border-top: 1px dashed #000; margin: 6px 0; }
.row     { display: flex; justify-content: space-between; gap: 8px; }
.row > span:first-child { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.row > span:last-child  { white-space: nowrap; }
.total   { font-weight: bold; font-size: 13px; }
.sign    { margin-top: 28px; border-top: 1px solid #000; padding-top: 2px; font-size: 10px; }
</style>
