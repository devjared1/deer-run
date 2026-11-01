<template>
  <div class="overflow-x-auto print:overflow-visible">
    <table class="w-full border-collapse font-body text-body-m text-on-surface">
      <thead>
        <tr class="text-left border-b border-outline-variant">
          <th v-if="showRegister" class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap">
            Register
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap">
            Opened
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap">
            Closed
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap text-right">
            Start
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap text-right">
            Cash in
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap text-right">
            Cash out
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap text-right" title="Paid in, paid out and safe drops">
            Paid in / out
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap text-right">
            Expected
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap text-right">
            Counted
          </th>
          <th class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap text-right">
            Over / short
          </th>
          <th v-if="closable" class="px-3 py-2 text-label-l text-on-surface-variant whitespace-nowrap print:hidden" />
        </tr>
      </thead>
      <tbody class="divide-y divide-outline-variant">
        <tr v-for="d in sessions" :key="d.id">
          <td v-if="showRegister" class="px-3 py-2">
            {{ d.register?.name }}
          </td>
          <td class="px-3 py-2 whitespace-nowrap">
            {{ when(d.openedAt) }}
            <div class="text-body-s text-on-surface-variant">
              {{ person(d.openedBy) }}
            </div>
          </td>
          <td class="px-3 py-2 whitespace-nowrap">
            <template v-if="d.closedAt">
              {{ when(d.closedAt) }}
              <div class="text-body-s text-on-surface-variant">
                {{ person(d.closedBy) }}
              </div>
            </template>
            <StatusChip v-else label="Open" tone="warning" icon="pending" size="sm" />
          </td>
          <td class="px-3 py-2 text-right tabular-nums">
            {{ money(d.openingFloatCents) }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums">
            {{ money(d.cashSalesCents) }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums">
            {{ d.cashRefundsCents ? `−${money(d.cashRefundsCents)}` : money(0) }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap" :title="movementTitle(d)">
            <template v-if="d.paidInCents || d.paidOutCents || d.safeDropCents">
              <div v-if="d.paidInCents">
                +{{ money(d.paidInCents) }} <span class="text-body-s text-on-surface-variant">in</span>
              </div>
              <div v-if="d.paidOutCents">
                −{{ money(d.paidOutCents) }} <span class="text-body-s text-on-surface-variant">out</span>
              </div>
              <div v-if="d.safeDropCents">
                −{{ money(d.safeDropCents) }} <span class="text-body-s text-on-surface-variant">to safe</span>
              </div>
            </template>
            <span v-else class="text-on-surface-variant">—</span>
          </td>
          <td class="px-3 py-2 text-right tabular-nums font-bold">
            {{ money(d.expectedCents) }}<span v-if="!d.closedAt" class="text-body-s text-on-surface-variant font-normal"> so far</span>
          </td>
          <td class="px-3 py-2 text-right tabular-nums">
            {{ d.closedAt ? money(d.countedCents) : '—' }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums font-bold" :class="overShortClass(d)">
            <template v-if="d.closedAt">
              {{ d.overShortCents === 0 ? 'Balanced' : `${d.overShortCents > 0 ? '+' : '−'}${money(Math.abs(d.overShortCents))}` }}
            </template>
            <template v-else>
              —
            </template>
            <div v-if="d.closeNote" class="text-body-s text-on-surface-variant font-normal max-w-[14rem] ml-auto truncate" :title="d.closeNote">
              {{ d.closeNote }}
            </div>
          </td>
          <td v-if="closable" class="px-1 py-0 text-right print:hidden">
            <AppButton v-if="!d.closedAt" variant="text" :aria-label="`Close the ${d.register?.name ?? ''} drawer`" @click="$emit('close', d)">
              Close…
            </AppButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { COURSE_TZ } from '@/lib/timeclock'
import AppButton from '@/components/ui/AppButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import { MOVEMENT_LABELS, MOVEMENT_SIGN } from './salesReport'

defineProps({
  sessions:     { type: Array, required: true },
  showRegister: { type: Boolean, default: true },
  closable:     { type: Boolean, default: false },
})
defineEmits(['close'])

function overShortClass(d) {
  if (!d.closedAt || d.overShortCents === 0) return 'text-primary'
  return 'text-tertiary'
}

// Hover text: each paid in / paid out / safe drop with its time, reason and who did it
function movementTitle(d) {
  if (!d.movements?.length) return null
  return d.movements.map(m => [
    `${time(m.createdAt)} ${MOVEMENT_LABELS[m.type]} ${MOVEMENT_SIGN[m.type]}${money(m.amountCents)}`,
    m.reason, m.recipient && `to ${m.recipient}`, person(m.employee) && `by ${person(m.employee)}`,
  ].filter(Boolean).join(' · ')).join('\n')
}

const time = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
const when = (ts) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
const person = (e) => (e ? `${e.firstName} ${e.lastName}` : '')
const money = (cents) => `$${((cents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
</script>
