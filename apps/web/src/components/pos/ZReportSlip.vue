<template>
  <!-- End-of-day report on 80 mm paper. Like every print job, it also opens the cash drawer. -->
  <div class="receipt">
    <div class="center title">
      {{ report.from === report.to ? 'END OF DAY (Z) REPORT' : 'SALES REPORT' }}
    </div>
    <div class="center">
      Deer Run Golf Course
    </div>
    <div class="rule" />
    <div>{{ dateLabel }}</div>
    <div>{{ report.register?.name || 'All registers' }}</div>
    <div>Printed {{ printedAt }}<template v-if="report.printedBy"> by {{ report.printedBy }}</template></div>
    <div class="rule" />

    <div class="heading">
      SALES
    </div>
    <div class="row"><span>Sales ({{ report.sales.count }})</span><span>{{ money(report.sales.grossCents) }}</span></div>
    <div class="row"><span>Discounts</span><span>-{{ money(report.sales.discountCents) }}</span></div>
    <div class="row"><span>Voids ({{ report.returns.voidCount }})</span><span>-{{ money(preTaxVoids) }}</span></div>
    <div class="row"><span>Refunds ({{ report.returns.refundCount }})</span><span>-{{ money(preTaxRefunds) }}</span></div>
    <div class="row strong"><span>Net sales</span><span>{{ money(report.net.salesCents) }}</span></div>
    <div class="row"><span>Tax collected</span><span>{{ money(report.net.taxCents) }}</span></div>
    <div class="row strong"><span>Net total</span><span>{{ money(report.net.totalCents) }}</span></div>
    <div class="rule" />

    <div class="heading">
      BY CATEGORY (net, before tax)
    </div>
    <div v-for="c in report.categories" :key="c.name" class="row">
      <span>{{ c.name }} ({{ c.quantity - c.refundedQuantity }})</span><span>{{ money(c.netCents) }}</span>
    </div>
    <div v-if="!report.categories.length" class="sub">
      No sales
    </div>
    <div class="rule" />

    <div class="heading">
      BY TENDER (net)
    </div>
    <div v-for="t in report.tenders" :key="t.method" class="row">
      <span>{{ t.label }} ({{ t.count }})</span><span>{{ money(t.netCents) }}</span>
    </div>
    <div v-if="report.sales.noChargeCount" class="row">
      <span>No charge ({{ report.sales.noChargeCount }})</span><span>{{ money(0) }}</span>
    </div>
    <div class="rule" />

    <div class="row strong"><span>Cash expected</span><span>{{ money(report.cashExpectedCents) }}</span></div>
    <div class="sub">
      Cash sales minus cash refunds (add your opening float)
    </div>
    <div class="row"><span>No Sale openings</span><span>{{ report.noSaleCount }}</span></div>
    <div class="rule" />
    <div>Counted cash: ______________</div>
    <div class="sig">
      Signature: ______________
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COURSE_TZ, formatLocalDate } from '@/lib/timeclock'
import { reportDateLabel } from './salesReport'

const props = defineProps({
  report: { type: Object, required: true },
})

const dateLabel = computed(() => reportDateLabel(props.report, formatLocalDate))
const printedAt = computed(() => new Date(props.report.generatedAt).toLocaleString('en-US', {
  month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
}))
const preTaxVoids   = computed(() => props.report.returns.voidCents - props.report.returns.voidTaxCents)
const preTaxRefunds = computed(() => props.report.returns.refundCents - props.report.returns.refundTaxCents)

const money = (cents) => `$${(cents / 100).toFixed(2)}`
</script>

<style scoped>
.receipt { width: 72mm; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; background: #fff; }
.center  { text-align: center; }
.title   { font-weight: bold; font-size: 13px; }
.heading { font-weight: bold; margin-bottom: 2px; }
.rule    { border-top: 1px dashed #000; margin: 6px 0; }
.row     { display: flex; justify-content: space-between; gap: 8px; }
.row > span:first-child { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.row > span:last-child  { white-space: nowrap; }
.strong  { font-weight: bold; }
.sub     { padding-left: 12px; font-size: 10px; }
.sig     { margin-top: 10px; }
</style>
