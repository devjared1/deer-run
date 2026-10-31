<template>
  <!-- Paid in / paid out / safe drop on 80 mm paper. Printing it opens the cash drawer. -->
  <div class="receipt">
    <div class="center title">
      {{ title }}
    </div>
    <div class="center">
      {{ registerName }}
    </div>
    <div class="rule" />
    <div>{{ when }}</div>
    <div>By {{ name(movement.employee) }}</div>
    <div v-if="movement.approval?.approver">
      Approved by {{ name(movement.approval.approver) }}
    </div>
    <div class="rule" />
    <div class="row strong big">
      <span>{{ movement.type === 'PAID_IN' ? 'Into drawer' : 'Out of drawer' }}</span><span>{{ money(movement.amountCents) }}</span>
    </div>
    <div v-if="movement.reason" class="sub">
      {{ movement.type === 'PAID_OUT' ? 'For' : 'Note' }}: {{ movement.reason }}
    </div>
    <div v-if="movement.recipient" class="sub">
      Paid to: {{ movement.recipient }}
    </div>
    <div class="rule" />
    <template v-if="movement.type === 'PAID_OUT'">
      <div class="sig">
        Received by: ______________
      </div>
      <div class="sig">
        Manager: ______________
      </div>
      <div class="sub">
        Attach the purchase receipt to this slip.
      </div>
    </template>
    <div v-else-if="movement.type === 'SAFE_DROP'" class="sig">
      Dropped by: ______________
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COURSE_TZ } from '@/lib/timeclock'

const props = defineProps({
  movement: { type: Object, required: true },
  registerName: { type: String, default: '' },
})

const title = computed(() => ({ PAID_IN: 'PAID IN', PAID_OUT: 'PAID OUT', SAFE_DROP: 'SAFE DROP' }[props.movement.type] ?? props.movement.type))
const when = computed(() => new Date(props.movement.createdAt).toLocaleString('en-US', {
  month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
}))
const name = (e) => (e ? `${e.firstName} ${e.lastName.charAt(0)}.` : '—')
const money = (cents) => `$${(cents / 100).toFixed(2)}`
</script>

<style scoped>
.receipt { width: 72mm; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; background: #fff; }
.center  { text-align: center; }
.title   { font-weight: bold; font-size: 14px; }
.rule    { border-top: 1px dashed #000; margin: 6px 0; }
.row     { display: flex; justify-content: space-between; gap: 8px; }
.row > span:last-child { white-space: nowrap; }
.strong  { font-weight: bold; }
.big     { font-size: 13px; }
.sub     { font-size: 10px; margin-top: 2px; overflow-wrap: anywhere; }
.sig     { margin-top: 12px; }
</style>
