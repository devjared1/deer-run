<template>
  <div class="sales-report space-y-5">
    <!-- Headline numbers -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="stat-label">
          Net sales
        </div>
        <div class="stat-value">
          {{ money(report.net.salesCents) }}
        </div>
        <div class="stat-sub">
          before tax
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          Tax collected
        </div>
        <div class="stat-value">
          {{ money(report.net.taxCents) }}
        </div>
        <div class="stat-sub">
          after refunds
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          Net total
        </div>
        <div class="stat-value">
          {{ money(report.net.totalCents) }}
        </div>
        <div class="stat-sub">
          {{ report.sales.count }} sale{{ report.sales.count === 1 ? '' : 's' }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          Net cash
        </div>
        <div class="stat-value">
          {{ money(report.cashExpectedCents) }}
        </div>
        <div class="stat-sub">
          cash in − cash refunds
        </div>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-5">
      <!-- Summary -->
      <div class="panel">
        <h3 class="panel-title">
          Summary
        </h3>
        <table class="w-full text-sm font-body">
          <tbody>
            <tr><td class="td">Sales ({{ report.sales.count }})</td><td class="td-num">{{ money(report.sales.grossCents) }}</td></tr>
            <tr><td class="td">Discounts</td><td class="td-num text-clay">−{{ money(report.sales.discountCents) }}</td></tr>
            <tr>
              <td class="td">Voids ({{ report.returns.voidCount }})</td>
              <td class="td-num text-clay">−{{ money(report.returns.voidCents - report.returns.voidTaxCents) }}</td>
            </tr>
            <tr>
              <td class="td">Refunds ({{ report.returns.refundCount }})</td>
              <td class="td-num text-clay">−{{ money(report.returns.refundCents - report.returns.refundTaxCents) }}</td>
            </tr>
            <tr class="font-semibold border-t border-gray-200">
              <td class="td">Net sales</td><td class="td-num">{{ money(report.net.salesCents) }}</td>
            </tr>
            <tr><td class="td">Tax collected</td><td class="td-num">{{ money(report.net.taxCents) }}</td></tr>
            <tr class="font-semibold border-t border-gray-200">
              <td class="td">Net total</td><td class="td-num">{{ money(report.net.totalCents) }}</td>
            </tr>
            <tr><td class="td text-gray-500">No-charge sales</td><td class="td-num text-gray-500">{{ report.sales.noChargeCount }}</td></tr>
            <tr><td class="td text-gray-500">No Sale drawer openings</td><td class="td-num text-gray-500">{{ report.noSaleCount }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Tenders -->
      <div class="panel">
        <h3 class="panel-title">
          By tender
        </h3>
        <table class="w-full text-sm font-body">
          <thead>
            <tr class="text-left text-xs text-gray-500 uppercase tracking-wider">
              <th class="th">
                Tender
              </th>
              <th class="th text-right">
                Collected
              </th>
              <th class="th text-right">
                Refunded
              </th>
              <th class="th text-right">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in report.tenders" :key="t.method">
              <td class="td">
                {{ t.label }} <span class="text-gray-400">({{ t.count }})</span>
              </td>
              <td class="td-num">
                {{ money(t.collectedCents) }}
              </td>
              <td class="td-num text-clay">
                {{ t.refundedCents ? `−${money(t.refundedCents)}` : '—' }}
              </td>
              <td class="td-num font-semibold">
                {{ money(t.netCents) }}
              </td>
            </tr>
            <tr v-if="!report.tenders.length">
              <td class="td text-gray-400" colspan="4">
                No payments
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Categories -->
    <div class="panel">
      <h3 class="panel-title">
        By category
      </h3>
      <table class="w-full text-sm font-body">
        <thead>
          <tr class="text-left text-xs text-gray-500 uppercase tracking-wider">
            <th class="th">
              Category
            </th>
            <th class="th text-right">
              Qty
            </th>
            <th class="th text-right">
              Sales
            </th>
            <th class="th text-right">
              Returns
            </th>
            <th class="th text-right">
              Net sales
            </th>
            <th class="th text-right">
              Tax
            </th>
            <th class="th w-1/4 print:hidden" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in report.categories" :key="c.name">
            <td class="td">
              {{ c.name }}
            </td>
            <td class="td-num">
              {{ c.quantity - c.refundedQuantity }}<span v-if="c.refundedQuantity" class="text-gray-400 text-xs"> ({{ c.quantity }} sold)</span>
            </td>
            <td class="td-num">
              {{ money(c.salesCents) }}
            </td>
            <td class="td-num text-clay">
              {{ c.refundCents ? `−${money(c.refundCents)}` : '—' }}
            </td>
            <td class="td-num font-semibold">
              {{ money(c.netCents) }}
            </td>
            <td class="td-num text-gray-500">
              {{ money(c.netTaxCents) }}
            </td>
            <td class="td print:hidden">
              <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div class="h-full bg-pine/70" :style="{ width: `${barWidth(c.netCents)}%` }" />
              </div>
            </td>
          </tr>
          <tr v-if="!report.categories.length">
            <td class="td text-gray-400" colspan="7">
              No sales in this period
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- House account payments: settling balances, so they're not in sales -->
    <div v-if="report.accountPayments?.rows.length" class="panel">
      <h3 class="panel-title">
        House account payments received
      </h3>
      <table class="w-full text-sm font-body">
        <tbody>
          <tr v-for="a in report.accountPayments.rows" :key="a.method">
            <td class="td">
              {{ a.label }} <span class="text-gray-400">({{ a.count }})</span>
            </td>
            <td class="td-num">
              {{ money(a.amountCents) }}
            </td>
          </tr>
          <tr class="font-semibold border-t border-gray-200">
            <td class="td">
              Total
            </td>
            <td class="td-num">
              {{ money(report.accountPayments.totalCents) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-xs text-gray-400 font-body mt-2">
        Members paying down their accounts. Not counted in sales (the charges were); cash payments are in net cash.
      </p>
    </div>

    <!-- Cash drawers -->
    <div v-if="report.drawerSessions?.length" class="panel">
      <h3 class="panel-title">
        Cash drawers
      </h3>
      <DrawerSessionsTable :sessions="report.drawerSessions" :show-register="!report.register" />
    </div>

    <p class="text-xs text-gray-400 font-body">
      Sales count on the day they were rung up; voids and refunds come off on the day they happen, so a past day's
      report doesn't change. Net cash is cash taken minus cash refunded; each drawer's expected amount adds its starting cash.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DrawerSessionsTable from './DrawerSessionsTable.vue'

const props = defineProps({
  report: { type: Object, required: true },
})

const maxNet = computed(() => Math.max(1, ...props.report.categories.map(c => c.netCents)))

function barWidth(cents) {
  return Math.max(0, Math.round((cents / maxNet.value) * 100))
}

const money = (cents) => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
</script>

<style scoped>
.stat-card   { @apply bg-white rounded-xl border border-gray-200 p-5 print:p-3 print:rounded-none; }
.stat-label  { @apply text-gray-400 text-xs font-body uppercase tracking-wider mb-1; }
.stat-value  { @apply text-2xl font-display font-bold text-bark tabular-nums; }
.stat-sub    { @apply text-xs text-gray-400 font-body mt-0.5; }
.panel       { @apply bg-white rounded-xl border border-gray-200 p-5 print:rounded-none print:p-3; break-inside: avoid; }
.panel-title { @apply font-display font-bold text-bark text-sm mb-3; }
.th          { @apply py-2 pr-3 font-semibold; }
.td          { @apply py-1.5 pr-3 text-bark; }
.td-num      { @apply py-1.5 pr-3 text-right tabular-nums text-bark; }
</style>
