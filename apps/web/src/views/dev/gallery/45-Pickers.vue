<template>
  <div class="space-y-10">
    <div class="space-y-4">
      <h3 class="text-title-m text-on-surface">SegmentedButton</h3>
      <SegmentedButton v-model="seg.view" label="Schedule view" :options="views" />
      <SegmentedButton v-model="seg.multi" multiple label="Days" :options="days" />
      <SegmentedButton v-model="seg.tender" label="Tender" size="lg" block :options="tenders" />
      <SegmentedButton v-model="seg.view" label="Disabled" :options="views" disabled />
      <p class="text-body-s text-on-surface-variant">Single: {{ seg.view }} · multiple: {{ seg.multi.join(', ') || 'none' }} · tender: {{ seg.tender }}</p>
    </div>

    <div class="space-y-2">
      <h3 class="text-title-m text-on-surface">ChipGroup / FilterChip</h3>
      <ChipGroup v-model="chips.filter" label="Event filters" :options="filters" />
      <ChipGroup v-model="chips.choice" type="choice" label="Refund reason" :options="reasons" />
      <ChipGroup v-model="chips.category" type="choice" scroll size="lg" label="Category" :options="categories" />
      <div class="flex flex-wrap gap-2 py-2">
        <FilterChip :selected="lone" label="Standalone" @click="lone = !lone" />
        <FilterChip :icon="IconGolf" label="With icon" />
        <FilterChip selected label="Disabled, selected" disabled />
        <FilterChip label="Disabled" disabled />
      </div>
    </div>

    <div>
      <h3 class="text-title-m text-on-surface mb-3">NumericKeypad</h3>
      <div class="grid gap-8 md:grid-cols-3">
        <div>
          <NumericKeypad
            v-model="pin"
            label="Manager PIN"
            masked
            :max-length="6"
            submit-label="Approve"
            :hint="pinResult || 'Click the display, then type on the keyboard too'"
            @submit="v => (pinResult = `Submitted ${v.length} digits`, pin = '')"
          />
        </div>
        <div>
          <NumericKeypad
            v-model="cash"
            label="Cash tendered"
            left-key="00"
            :format="v => formatCents(Number(v))"
            submit-label="Done"
            submit-variant="gold"
          />
        </div>
        <div>
          <NumericKeypad v-model="count" label="Drawer count" left-key="." placeholder="0.00" />
          <NumericKeypad v-model="count" class="mt-6" label="Disabled" disabled />
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="text-title-m text-on-surface">DateStepper</h3>
      <DateStepper v-model="day" today />
      <DateStepper v-model="week" step="week" />
      <DateStepper v-model="month" step="month" />
      <DateStepper v-model="bounded" :min="today" :max="addDays(today, 6)" today />
      <p class="text-body-s text-on-surface-variant">Last stepper is bounded to the next 7 days. Values: {{ day }} · {{ week }} · {{ month }} · {{ bounded }}</p>
      <DateStepper :model-value="today" disabled />
    </div>

    <div class="space-y-2 max-w-xl">
      <h3 class="text-title-m text-on-surface">DateRangeField</h3>
      <DateRangeField v-model="range" label="Dates" />
      <p class="text-body-s text-on-surface-variant">{{ range.from }} → {{ range.to }}</p>
    </div>

    <div class="space-y-2 max-w-md">
      <h3 class="text-title-m text-on-surface">CustomerSearch</h3>
      <p class="text-body-m text-on-surface-variant">
        Points at a URL that doesn't exist, so typing two letters shows the error state with Retry.
      </p>
      <CustomerSearch search-url="/api/dev/no-such-endpoint" @select="c => (picked = c)" />
      <p v-if="picked" class="text-body-s text-on-surface-variant">Picked: {{ picked.name }}</p>
    </div>
  </div>
</template>

<script>
export default { galleryTitle: 'Pickers & keypad' }
</script>

<script setup>
import { reactive, ref } from 'vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import CustomerSearch from '@/components/ui/CustomerSearch.vue'
import DateRangeField from '@/components/ui/DateRangeField.vue'
import DateStepper from '@/components/ui/DateStepper.vue'
import FilterChip from '@/components/ui/FilterChip.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import { formatCents } from '@/lib/money.js'
import { addDays, localDate } from '@/lib/timeclock.js'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconCard from '~icons/material-symbols/credit-card-outline'
import IconPerson from '~icons/material-symbols/person-rounded'

const views = [{ value: 'week', label: 'Week' }, { value: 'biweek', label: '2 weeks' }, { value: 'month', label: 'Month' }]
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => ({ value: d, label: d }))
const tenders = [
  { value: 'CASH', label: 'Cash', icon: IconPayments },
  { value: 'CARD', label: 'Card', icon: IconCard },
  { value: 'ACCOUNT', label: 'Account', icon: IconPerson },
]
const seg = reactive({ view: 'week', multi: ['Mon', 'Wed'], tender: 'CARD' })

const filters = [{ value: 'open', label: 'Open to public' }, { value: 'member', label: 'Members only' }, { value: 'past', label: 'Past events' }]
const reasons = ['Wrong size', 'Defective', 'Rang wrong', 'Changed mind'].map(r => ({ value: r, label: r }))
const categories = ['All', 'Balls', 'Gloves', 'Apparel', 'Hats', 'Clubs', 'Snacks', 'Drinks', 'Rentals', 'Gift cards', 'Memberships']
  .map(c => ({ value: c, label: c }))
const chips = reactive({ filter: ['open'], choice: null, category: 'All' })
const lone = ref(false)

const pin = ref('')
const pinResult = ref('')
const cash = ref('')
const count = ref('')

const today = localDate()
const day = ref(today)
const week = ref(today)
const month = ref(today)
const bounded = ref(today)
const range = ref({ from: today, to: today })

const picked = ref(null)
</script>
