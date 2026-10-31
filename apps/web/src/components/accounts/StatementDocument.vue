<template>
  <!-- Letter-size house account statement (screen and print) -->
  <article class="statement bg-white rounded-xl border border-gray-200 p-8 font-body text-bark print:border-0 print:rounded-none print:p-0">
    <header class="flex justify-between gap-6 border-b border-gray-200 pb-4 mb-4">
      <div>
        <div class="font-display font-bold text-xl">
          Deer Run Golf Course
        </div>
        <div class="text-sm text-gray-500">
          1175 County Road 100 · Moulton, AL 35650 · (256) 974-7384
        </div>
      </div>
      <div class="text-right">
        <div class="font-display font-bold text-lg">
          House Account Statement
        </div>
        <div class="text-sm text-gray-500">
          {{ formatLocalDate(statement.periodStart, longDate) }} – {{ formatLocalDate(statement.periodEnd, longDate) }}
        </div>
      </div>
    </header>

    <div class="flex justify-between gap-6 mb-6 text-sm">
      <div>
        <div class="text-gray-400 text-xs uppercase tracking-wider">
          Member
        </div>
        <div class="font-semibold">
          {{ member?.name || member?.email }}
        </div>
        <div v-if="member?.name" class="text-gray-500">
          {{ member.email }}
        </div>
      </div>
      <table class="text-sm">
        <tbody>
          <tr><td class="pr-6 text-gray-500">Previous balance</td><td class="text-right tabular-nums">{{ money(statement.openingCents) }}</td></tr>
          <tr><td class="pr-6 text-gray-500">Charges</td><td class="text-right tabular-nums">{{ money(statement.chargesCents) }}</td></tr>
          <tr><td class="pr-6 text-gray-500">Payments &amp; credits</td><td class="text-right tabular-nums">{{ money(statement.creditsCents) }}</td></tr>
          <tr class="font-bold border-t border-gray-300">
            <td class="pr-6 pt-1">
              {{ statement.closingCents > 0 ? 'Balance due' : 'Balance' }}
            </td>
            <td class="text-right tabular-nums pt-1">
              {{ money(statement.closingCents) }}
            </td>
          </tr>
          <tr v-if="statement.dueDate && statement.closingCents > 0">
            <td class="pr-6 text-gray-500">
              Due by
            </td>
            <td class="text-right">
              {{ formatLocalDate(statement.dueDate, shortDate) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
          <th class="py-2 pr-3 font-semibold w-28">
            Date
          </th>
          <th class="py-2 pr-3 font-semibold">
            Description
          </th>
          <th class="py-2 text-right font-semibold w-28">
            Amount
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr v-for="e in statement.entries" :key="e.id" class="statement-row">
          <td class="py-1.5 pr-3 text-gray-600 whitespace-nowrap">
            {{ entryDate(e.createdAt) }}
          </td>
          <td class="py-1.5 pr-3">
            {{ e.description }}
          </td>
          <td class="py-1.5 text-right tabular-nums" :class="e.amountCents < 0 ? 'text-pine' : ''">
            {{ money(e.amountCents) }}
          </td>
        </tr>
        <tr v-if="!statement.entries?.length">
          <td colspan="3" class="py-4 text-center text-gray-400">
            No activity in this period.
          </td>
        </tr>
      </tbody>
    </table>

    <footer class="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500">
      <template v-if="statement.closingCents > 0">
        Pay online in My Account at deerrun.golf, or at the pro shop.
      </template>
      <template v-else>
        Nothing is due. Thank you!
      </template>
      Charges show what was charged to your account at the register; your receipts list the items.
    </footer>
  </article>
</template>

<script setup>
import { formatLocalDate, COURSE_TZ } from '@/lib/timeclock'

defineProps({
  statement: { type: Object, required: true }, // { periodStart, periodEnd, openingCents, chargesCents, creditsCents, closingCents, dueDate?, entries }
  member:    { type: Object, default: null },  // { name, email }
})

const longDate = { month: 'long', day: 'numeric', year: 'numeric' }
const shortDate = { month: 'short', day: 'numeric', year: 'numeric' }

function entryDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: COURSE_TZ })
}

const money = (cents) => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
</script>

<style scoped>
@media print {
  .statement { font-size: 10pt; }
  .statement-row { break-inside: avoid; }
}
</style>
