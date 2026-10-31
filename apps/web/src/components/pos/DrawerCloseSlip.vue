<template>
  <!-- Drawer close-out on 80 mm paper (printing also opens the drawer) -->
  <div class="receipt">
    <div class="center title">
      DRAWER CLOSE
    </div>
    <div class="center">
      {{ session.register?.name }}
    </div>
    <div class="rule" />
    <div>Opened {{ when(session.openedAt) }} by {{ name(session.openedBy) }}</div>
    <div>Closed {{ when(session.closedAt) }} by {{ name(session.closedBy) }}</div>
    <div class="rule" />
    <div class="row"><span>Starting cash</span><span>{{ money(session.openingFloatCents) }}</span></div>
    <div class="row"><span>Cash taken<template v-if="session.cashSalesCount !== undefined"> ({{ session.cashSalesCount }})</template></span><span>+{{ money(session.cashSalesCents) }}</span></div>
    <div class="row"><span>Cash refunds<template v-if="session.cashRefundsCount !== undefined"> ({{ session.cashRefundsCount }})</template></span><span>-{{ money(session.cashRefundsCents) }}</span></div>
    <div class="row strong"><span>Expected in drawer</span><span>{{ money(session.expectedCents) }}</span></div>
    <div class="row strong"><span>Counted</span><span>{{ money(session.countedCents) }}</span></div>
    <div class="row strong"><span>{{ overShortLabel }}</span><span>{{ money(Math.abs(session.overShortCents)) }}</span></div>
    <div v-if="session.closeNote" class="sub">
      Note: {{ session.closeNote }}
    </div>
    <div class="rule" />
    <div class="sig">
      Counted by: ______________
    </div>
    <div class="sig">
      Verified by: ______________
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COURSE_TZ } from '@/lib/timeclock'

const props = defineProps({
  session: { type: Object, required: true },
})

const overShortLabel = computed(() => {
  const v = props.session.overShortCents
  return v === 0 ? 'Balanced' : v > 0 ? 'Over' : 'Short'
})

const when = (ts) => new Date(ts).toLocaleString('en-US', {
  month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
})
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
.sub     { font-size: 10px; margin-top: 2px; }
.sig     { margin-top: 10px; }
</style>
