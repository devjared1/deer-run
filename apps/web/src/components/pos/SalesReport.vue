<template>
  <div class="sales-report space-y-5">
    <!-- Headline numbers -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Net sales" :value="money(report.net.salesCents)" variant="outlined" class="print:rounded-none">
        <p class="text-body-s text-on-surface-variant">before tax</p>
      </StatCard>
      <StatCard label="Tax collected" :value="money(report.net.taxCents)" variant="outlined" class="print:rounded-none">
        <p class="text-body-s text-on-surface-variant">after refunds</p>
      </StatCard>
      <StatCard label="Net total" :value="money(report.net.totalCents)" variant="outlined" class="print:rounded-none">
        <p class="text-body-s text-on-surface-variant">{{ report.sales.count }} sale{{ report.sales.count === 1 ? '' : 's' }}</p>
      </StatCard>
      <StatCard label="Net cash" :value="money(report.cashExpectedCents)" variant="outlined" class="print:rounded-none">
        <p class="text-body-s text-on-surface-variant">cash in − cash refunds</p>
      </StatCard>
    </div>

    <div class="grid lg:grid-cols-2 gap-5">
      <!-- Summary -->
      <div class="rounded-shape-md border border-outline-variant bg-surface p-4 break-inside-avoid print:rounded-none print:p-3">
        <h3 class="text-title-m text-on-surface mb-3">
          Summary
        </h3>
        <div class="overflow-x-auto print:overflow-visible">
          <table class="w-full border-collapse font-body text-body-m text-on-surface">
            <tbody>
              <tr><td class="py-1.5 pr-3">Sales ({{ report.sales.count }})</td><td class="py-1.5 pr-3 text-right tabular-nums">{{ money(report.sales.grossCents) }}</td></tr>
              <tr><td class="py-1.5 pr-3">Discounts</td><td class="py-1.5 pr-3 text-right tabular-nums text-tertiary">−{{ money(report.sales.discountCents) }}</td></tr>
              <tr>
                <td class="py-1.5 pr-3">Voids ({{ report.returns.voidCount }})</td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-tertiary">−{{ money(report.returns.voidCents - report.returns.voidTaxCents) }}</td>
              </tr>
              <tr>
                <td class="py-1.5 pr-3">Refunds ({{ report.returns.refundCount }})</td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-tertiary">−{{ money(report.returns.refundCents - report.returns.refundTaxCents) }}</td>
              </tr>
              <tr class="font-bold border-t border-outline-variant">
                <td class="py-1.5 pr-3">Net sales</td><td class="py-1.5 pr-3 text-right tabular-nums">{{ money(report.net.salesCents) }}</td>
              </tr>
              <tr><td class="py-1.5 pr-3">Tax collected</td><td class="py-1.5 pr-3 text-right tabular-nums">{{ money(report.net.taxCents) }}</td></tr>
              <tr class="font-bold border-t border-outline-variant">
                <td class="py-1.5 pr-3">Net total</td><td class="py-1.5 pr-3 text-right tabular-nums">{{ money(report.net.totalCents) }}</td>
              </tr>
              <tr><td class="py-1.5 pr-3 text-on-surface-variant">No-charge sales</td><td class="py-1.5 pr-3 text-right tabular-nums text-on-surface-variant">{{ report.sales.noChargeCount }}</td></tr>
              <tr><td class="py-1.5 pr-3 text-on-surface-variant">No Sale drawer openings</td><td class="py-1.5 pr-3 text-right tabular-nums text-on-surface-variant">{{ report.noSaleCount }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tenders -->
      <div class="rounded-shape-md border border-outline-variant bg-surface p-4 break-inside-avoid print:rounded-none print:p-3">
        <h3 class="text-title-m text-on-surface mb-3">
          By tender
        </h3>
        <div class="overflow-x-auto print:overflow-visible">
          <table class="w-full border-collapse font-body text-body-m text-on-surface">
            <thead>
              <tr class="text-left border-b border-outline-variant">
                <th class="py-2 pr-3 text-label-l text-on-surface-variant">
                  Tender
                </th>
                <th class="py-2 pr-3 text-label-l text-on-surface-variant text-right">
                  Collected
                </th>
                <th class="py-2 pr-3 text-label-l text-on-surface-variant text-right">
                  Refunded
                </th>
                <th class="py-2 pr-3 text-label-l text-on-surface-variant text-right">
                  Net
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in report.tenders" :key="t.method">
                <td class="py-1.5 pr-3">
                  {{ t.label }} <span class="text-on-surface-variant">({{ t.count }})</span>
                </td>
                <td class="py-1.5 pr-3 text-right tabular-nums">
                  {{ money(t.collectedCents) }}
                </td>
                <td class="py-1.5 pr-3 text-right tabular-nums text-tertiary">
                  {{ t.refundedCents ? `−${money(t.refundedCents)}` : '—' }}
                </td>
                <td class="py-1.5 pr-3 text-right tabular-nums font-bold">
                  {{ money(t.netCents) }}
                </td>
              </tr>
              <tr v-if="!report.tenders.length">
                <td class="py-1.5 pr-3 text-on-surface-variant" colspan="4">
                  No payments
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Tips added on the card reader: charged on top of the sales, not revenue or tax (and not refunded) -->
        <div v-if="report.cardTips?.count" class="flex justify-between text-body-m text-on-surface mt-3 pt-2 border-t border-outline-variant">
          <span>Card tips <span class="text-on-surface-variant">({{ report.cardTips.count }}) · not in sales or tax</span></span>
          <span class="tabular-nums font-bold">{{ money(report.cardTips.totalCents) }}</span>
        </div>
      </div>
    </div>

    <!-- Categories -->
    <div class="rounded-shape-md border border-outline-variant bg-surface p-4 break-inside-avoid print:rounded-none print:p-3">
      <h3 class="text-title-m text-on-surface mb-3">
        By category
      </h3>
      <div class="overflow-x-auto print:overflow-visible">
        <table class="w-full border-collapse font-body text-body-m text-on-surface">
          <thead>
            <tr class="text-left border-b border-outline-variant">
              <th class="py-2 pr-3 text-label-l text-on-surface-variant">
                Category
              </th>
              <th class="py-2 pr-3 text-label-l text-on-surface-variant text-right">
                Qty
              </th>
              <th class="py-2 pr-3 text-label-l text-on-surface-variant text-right">
                Sales
              </th>
              <th class="py-2 pr-3 text-label-l text-on-surface-variant text-right">
                Returns
              </th>
              <th class="py-2 pr-3 text-label-l text-on-surface-variant text-right">
                Net sales
              </th>
              <th class="py-2 pr-3 text-label-l text-on-surface-variant text-right">
                Tax
              </th>
              <th class="py-2 pr-3 text-label-l text-on-surface-variant w-1/4 print:hidden" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in report.categories" :key="c.name">
              <td class="py-1.5 pr-3">
                {{ c.name }}
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums">
                {{ c.quantity - c.refundedQuantity }}<span v-if="c.refundedQuantity" class="text-on-surface-variant text-body-s"> ({{ c.quantity }} sold)</span>
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums">
                {{ money(c.salesCents) }}
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums text-tertiary">
                {{ c.refundCents ? `−${money(c.refundCents)}` : '—' }}
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums font-bold">
                {{ money(c.netCents) }}
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums text-on-surface-variant">
                {{ money(c.netTaxCents) }}
              </td>
              <td class="py-1.5 pr-3 print:hidden">
                <div class="h-2 rounded-full bg-surface-container-highest overflow-hidden" aria-hidden="true">
                  <div class="h-full bg-primary" :style="{ width: `${barWidth(c.netCents)}%` }" />
                </div>
              </td>
            </tr>
            <tr v-if="!report.categories.length">
              <td class="py-1.5 pr-3 text-on-surface-variant" colspan="7">
                No sales in this period
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- House account payments: settling balances, so they're not in sales -->
    <div v-if="report.accountPayments?.rows.length" class="rounded-shape-md border border-outline-variant bg-surface p-4 break-inside-avoid print:rounded-none print:p-3">
      <h3 class="text-title-m text-on-surface mb-3">
        House account payments received
      </h3>
      <div class="overflow-x-auto print:overflow-visible">
        <table class="w-full border-collapse font-body text-body-m text-on-surface">
          <tbody>
            <tr v-for="a in report.accountPayments.rows" :key="a.method">
              <td class="py-1.5 pr-3">
                {{ a.label }} <span class="text-on-surface-variant">({{ a.count }})</span>
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums">
                {{ money(a.amountCents) }}
              </td>
            </tr>
            <tr class="font-bold border-t border-outline-variant">
              <td class="py-1.5 pr-3">
                Total
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums">
                {{ money(report.accountPayments.totalCents) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-body-s text-on-surface-variant mt-2">
        Members paying down their accounts. Not counted in sales (the charges were); cash payments are in net cash.
      </p>
    </div>

    <!-- Paid in / paid out / safe drops: cash in and out of the drawers that isn't a sale -->
    <div v-if="report.cashMovements?.rows.length" class="rounded-shape-md border border-outline-variant bg-surface p-4 break-inside-avoid print:rounded-none print:p-3">
      <h3 class="text-title-m text-on-surface mb-3">
        Paid in, paid out and safe drops
      </h3>
      <div class="overflow-x-auto print:overflow-visible">
        <table class="w-full border-collapse font-body text-body-m text-on-surface">
          <tbody class="divide-y divide-outline-variant">
            <tr v-for="m in report.cashMovements.rows" :key="m.id">
              <td class="py-1.5 pr-3 whitespace-nowrap">
                {{ movementWhen(m.createdAt) }}
              </td>
              <td class="py-1.5 pr-3">
                {{ MOVEMENT_LABELS[m.type] }}
                <div v-if="m.reason || m.recipient" class="text-body-s text-on-surface-variant">
                  {{ [m.reason, m.recipient && `to ${m.recipient}`].filter(Boolean).join(' ') }}
                </div>
              </td>
              <td class="py-1.5 pr-3 text-body-s text-on-surface-variant">
                {{ person(m.employee) }}<template v-if="m.approval?.approver">
                  <br />approved by {{ person(m.approval.approver) }}
                </template>
              </td>
              <td class="py-1.5 pr-3 text-right tabular-nums">
                {{ MOVEMENT_SIGN[m.type] }}{{ money(m.amountCents) }}
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t border-outline-variant">
            <tr v-if="report.cashMovements.paidInCount">
              <td class="py-1.5 pr-3" colspan="3">Paid in ({{ report.cashMovements.paidInCount }})</td>
              <td class="py-1.5 pr-3 text-right tabular-nums">+{{ money(report.cashMovements.paidInCents) }}</td>
            </tr>
            <tr v-if="report.cashMovements.paidOutCount">
              <td class="py-1.5 pr-3" colspan="3">Paid out ({{ report.cashMovements.paidOutCount }})</td>
              <td class="py-1.5 pr-3 text-right tabular-nums">−{{ money(report.cashMovements.paidOutCents) }}</td>
            </tr>
            <tr v-if="report.cashMovements.safeDropCount">
              <td class="py-1.5 pr-3" colspan="3">Safe drops ({{ report.cashMovements.safeDropCount }})</td>
              <td class="py-1.5 pr-3 text-right tabular-nums">−{{ money(report.cashMovements.safeDropCents) }}</td>
            </tr>
            <tr class="font-bold">
              <td class="py-1.5 pr-3" colspan="3">Cash left in the drawer{{ report.register ? '' : 's' }} (net cash + paid in − paid out − safe drops)</td>
              <td class="py-1.5 pr-3 text-right tabular-nums">{{ money(report.drawerCashCents) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Cash drawers -->
    <div v-if="report.drawerSessions?.length" class="rounded-shape-md border border-outline-variant bg-surface p-4 break-inside-avoid print:rounded-none print:p-3">
      <h3 class="text-title-m text-on-surface mb-3">
        Cash drawers
      </h3>
      <DrawerSessionsTable :sessions="report.drawerSessions" :show-register="!report.register" />
    </div>

    <p class="text-body-s text-on-surface-variant">
      Sales count on the day they were rung up; voids and refunds come off on the day they happen, so a past day's
      report doesn't change. Net cash is cash taken minus cash refunded; each drawer's expected amount adds its starting cash
      and its paid-ins, and takes off its paid-outs and safe drops.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DrawerSessionsTable from './DrawerSessionsTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import { COURSE_TZ } from '@/lib/timeclock'
import { MOVEMENT_LABELS, MOVEMENT_SIGN } from './salesReport'

const props = defineProps({
  report: { type: Object, required: true },
})

const maxNet = computed(() => Math.max(1, ...props.report.categories.map(c => c.netCents)))

function barWidth(cents) {
  return Math.max(0, Math.round((cents / maxNet.value) * 100))
}

const movementWhen = (ts) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
const person = (e) => (e ? `${e.firstName} ${e.lastName}` : '')

const money = (cents) => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
</script>
