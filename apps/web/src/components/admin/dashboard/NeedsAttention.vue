<template>
  <Card variant="outlined" tag="section" aria-labelledby="dash-attention" padding="none">
    <template #header>
      <div class="flex-1 min-w-0 px-4 pt-4">
        <h3 id="dash-attention" class="text-title-l text-on-surface">Needs attention</h3>
        <p v-if="rows" class="text-body-m text-on-surface-variant">
          {{ rows.length ? `${rows.length} thing${rows.length === 1 ? '' : 's'} to look at` : 'Nothing waiting on you' }}
        </p>
      </div>
    </template>

    <div class="pb-2">
      <div v-if="error" class="px-4 pb-2">
        <ErrorBanner :message="error" @retry="load" />
      </div>
      <div v-else-if="!rows" class="px-4 pb-2">
        <Skeleton variant="text" :lines="3" label="Loading what needs attention" />
      </div>
      <ul v-else-if="rows.length" class="divide-y divide-outline-variant">
        <li v-for="row in rows" :key="row.key">
          <component
            :is="row.to ? RouterLink : 'a'"
            v-bind="row.to ? { to: row.to } : { href: row.href, target: '_blank', rel: 'noopener' }"
            class="state-layer flex items-center gap-4 px-4 py-3 min-h-16 no-underline text-on-surface"
          >
            <span
              :class="['flex-none flex items-center justify-center w-10 h-10 rounded-full', TONES[row.tone]]"
              aria-hidden="true"
            >
              <component :is="row.icon" class="w-6 h-6" />
            </span>
            <span class="flex-1 min-w-0">
              <span class="block text-body-l">{{ row.title }}</span>
              <span v-if="row.detail" class="block text-body-m text-on-surface-variant">{{ row.detail }}</span>
            </span>
            <span v-if="row.href" class="sr-only">(opens in a new tab)</span>
            <component :is="row.href ? IconExternal : IconChevron" class="flex-none w-6 h-6 text-on-surface-variant" aria-hidden="true" />
          </component>
        </li>
      </ul>
      <div v-else class="flex items-center gap-3 px-4 pb-3 text-body-m text-on-surface-variant">
        <IconDone class="w-6 h-6 flex-none text-success" aria-hidden="true" />
        All caught up: no time off to review, drawers are closed, tee times are set and stock is in.
      </div>
      <p v-if="failedChecks.length" class="px-4 pt-2 text-body-s text-on-surface-variant">
        Couldn't check {{ failedChecks.join(', ') }}. Refresh to try again.
      </p>
    </div>
  </Card>
</template>

<script setup>
// Dashboard "Needs attention": what a manager has to act on, from GET /api/admin/attention, most urgent first. Each
// row links to the page where it's dealt with (a card charge that didn't save links to Stripe). Call the exposed
// load() to refresh.
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { addDays, formatLocalDate, localDate } from '@/lib/timeclock'
import Card from '@/components/ui/Card.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import IconCardOff from '~icons/material-symbols/credit-card-off-rounded'
import IconBeach from '~icons/material-symbols/beach-access-rounded'
import IconPunchClock from '~icons/material-symbols/punch-clock-rounded'
import IconAlarm from '~icons/material-symbols/alarm-rounded'
import IconSwap from '~icons/material-symbols/swap-horiz-rounded'
import { teeTime } from '@/lib/teesheet'
import IconPointOfSale from '~icons/material-symbols/point-of-sale-rounded'
import IconQuote from '~icons/material-symbols/request-quote-rounded'
import IconEventBusy from '~icons/material-symbols/event-busy-rounded'
import IconInventory from '~icons/material-symbols/inventory-2-rounded'
import IconDone from '~icons/material-symbols/check-circle-rounded'
import IconChevron from '~icons/material-symbols/chevron-right-rounded'
import IconExternal from '~icons/material-symbols/open-in-new-rounded'

const TONES = {
  error:   'bg-error-container text-on-error-container',
  warning: 'bg-warning-container text-on-warning-container',
  info:    'bg-secondary-container text-on-secondary-container',
}

const CHECK_NAMES = {
  cardNotSaved: 'card payments', timeOff: 'time off', missedClockOut: 'clock-outs', missedClockIn: 'clock-ins', shiftSwaps: 'shift swaps',
  drawersLeftOpen: 'cash drawers',
  statementsPastDue: 'statements', teeTimeGaps: 'tee times', outOfStock: 'stock',
}

const data  = ref(null)
const error = ref(null)

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
// "A, B and 3 more"
function listOf(names, max = 3) {
  const shown = names.slice(0, max)
  const more = names.length - shown.length
  if (more > 0) return `${shown.join(', ')} and ${more} more`
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] ?? ''
}
const shortDate = ymd => formatLocalDate(ymd, { weekday: 'short', month: 'short', day: 'numeric' })

// key → row (title, detail, icon, tone, link); listed in this order
const BUILDERS = {
  cardNotSaved: i => {
    const first = i.checkouts[0]
    return {
      tone: 'error', icon: IconCardOff, href: 'https://dashboard.stripe.com/payments',
      title: `${plural(i.count, 'card payment')} charged but the sale didn't save`,
      detail: `${formatCents(first.amountCents)}${first.registerName ? ` on ${first.registerName}` : ''}` +
        `${first.lastError ? `: ${first.lastError}` : ''}. Check Stripe before ringing it up again.`,
    }
  },
  missedClockOut: i => ({
    tone: 'error', icon: IconPunchClock, to: '/admin/timesheets',
    title: `${plural(i.count, 'missed clock-out')}`,
    detail: `${listOf(i.names)} still on the clock from earlier. Fix the punch in Timesheets.`,
  }),
  missedClockIn: i => ({
    tone: 'warning', icon: IconAlarm, to: '/admin/schedule',
    title: `${plural(i.count, 'person', 'people')} scheduled but not clocked in`,
    detail: `${listOf(i.people.map(p => `${p.name} (${teeTime(p.startTime)})`))}.`,
  }),
  drawersLeftOpen: i => ({
    tone: 'error', icon: IconPointOfSale, to: { path: '/admin/sales', query: { tab: 'drawers' } },
    title: `${plural(i.count, 'cash drawer')} left open from an earlier day`,
    detail: i.registers.length ? `${listOf(i.registers)}. Count and close it so today's cash starts fresh.` : null,
  }),
  teeTimeGaps: i => {
    const soon = i.dates.some(d => d <= addDays(localDate(), 1))
    return {
      tone: soon ? 'error' : 'warning', icon: IconEventBusy, to: '/admin/teetimes',
      title: `No tee times on ${plural(i.count, 'day')} golfers can book`,
      detail: `${listOf(i.dates.map(shortDate), 4)}. Generate slots so these days show up online.`,
    }
  },
  shiftSwaps: i => ({
    tone: 'warning', icon: IconSwap, to: { path: '/admin/schedule', query: { swaps: '1' } },
    title: `${plural(i.count, 'shift swap')} to approve`,
    detail: 'A coworker picked up a shift; it changes hands once you approve.',
  }),
  timeOff: i => ({
    tone: 'warning', icon: IconBeach, to: '/admin/time-off',
    title: `${plural(i.count, 'time off request')} to review`,
    detail: i.firstStart ? `The soonest starts ${shortDate(i.firstStart)}.` : null,
  }),
  statementsPastDue: i => ({
    tone: 'warning', icon: IconQuote, to: '/admin/house-accounts',
    title: `${plural(i.count, 'house account statement')} past due`,
    detail: `${formatCents(i.totalCents)} on those statements.`,
  }),
  outOfStock: i => ({
    tone: 'info', icon: IconInventory, to: '/admin/products',
    title: `${plural(i.count, 'product')} out of stock`,
    detail: `${listOf(i.names)}.`,
  }),
}

const rows = computed(() => {
  if (!data.value) return null
  const byKey = Object.fromEntries(data.value.items.map(i => [i.key, i]))
  return Object.keys(BUILDERS).filter(k => byKey[k]).map(k => ({ key: k, ...BUILDERS[k](byKey[k]) }))
})

const failedChecks = computed(() => (data.value?.errors ?? []).map(e => CHECK_NAMES[e.key] ?? e.key))

async function load() {
  error.value = null
  try {
    data.value = await apiFetch('/api/admin/attention')
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
defineExpose({ load })
</script>
