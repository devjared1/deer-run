<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm font-body">
      <thead>
        <tr class="text-left text-xs text-gray-500 uppercase tracking-wider">
          <th v-if="showRegister" class="th">
            Register
          </th>
          <th class="th">
            Opened
          </th>
          <th class="th">
            Closed
          </th>
          <th class="th text-right">
            Start
          </th>
          <th class="th text-right">
            Cash in
          </th>
          <th class="th text-right">
            Cash out
          </th>
          <th class="th text-right">
            Expected
          </th>
          <th class="th text-right">
            Counted
          </th>
          <th class="th text-right">
            Over / short
          </th>
          <th v-if="closable" class="th print:hidden" />
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-50">
        <tr v-for="d in sessions" :key="d.id">
          <td v-if="showRegister" class="td">
            {{ d.register?.name }}
          </td>
          <td class="td whitespace-nowrap">
            {{ when(d.openedAt) }}
            <div class="text-xs text-gray-400">
              {{ person(d.openedBy) }}
            </div>
          </td>
          <td class="td whitespace-nowrap">
            <template v-if="d.closedAt">
              {{ when(d.closedAt) }}
              <div class="text-xs text-gray-400">
                {{ person(d.closedBy) }}
              </div>
            </template>
            <span v-else class="text-xs px-2 py-0.5 rounded-full bg-amber/20 text-amber-dark">Open</span>
          </td>
          <td class="td-num">
            {{ money(d.openingFloatCents) }}
          </td>
          <td class="td-num">
            {{ money(d.cashSalesCents) }}
          </td>
          <td class="td-num">
            {{ d.cashRefundsCents ? `−${money(d.cashRefundsCents)}` : money(0) }}
          </td>
          <td class="td-num font-semibold">
            {{ money(d.expectedCents) }}<span v-if="!d.closedAt" class="text-xs text-gray-400 font-normal"> so far</span>
          </td>
          <td class="td-num">
            {{ d.closedAt ? money(d.countedCents) : '—' }}
          </td>
          <td class="td-num font-semibold" :class="overShortClass(d)">
            <template v-if="d.closedAt">
              {{ d.overShortCents === 0 ? 'Balanced' : `${d.overShortCents > 0 ? '+' : '−'}${money(Math.abs(d.overShortCents))}` }}
            </template>
            <template v-else>
              —
            </template>
            <div v-if="d.closeNote" class="text-xs text-gray-400 font-normal max-w-[14rem] ml-auto truncate" :title="d.closeNote">
              {{ d.closeNote }}
            </div>
          </td>
          <td v-if="closable" class="td text-right print:hidden">
            <button v-if="!d.closedAt" class="text-xs text-lake hover:text-pine" @click="$emit('close', d)">
              Close…
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { COURSE_TZ } from '@/lib/timeclock'

defineProps({
  sessions:     { type: Array, required: true },
  showRegister: { type: Boolean, default: true },
  closable:     { type: Boolean, default: false },
})
defineEmits(['close'])

function overShortClass(d) {
  if (!d.closedAt || d.overShortCents === 0) return 'text-pine'
  return 'text-clay'
}

const when = (ts) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
const person = (e) => (e ? `${e.firstName} ${e.lastName}` : '')
const money = (cents) => `$${((cents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
</script>

<style scoped>
.th     { @apply py-2 pr-3 font-semibold; }
.td     { @apply py-2 pr-3 text-bark; }
.td-num { @apply py-2 pr-3 text-right tabular-nums text-bark; }
</style>
