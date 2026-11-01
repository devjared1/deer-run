<template>
  <div class="max-w-4xl">
    <div v-if="loading" class="space-y-4">
      <Skeleton height="48px" label="Loading settings" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>

    <ErrorBanner v-else-if="error" :message="error" @retry="load" />

    <form v-else ref="formEl" novalidate @submit.prevent="save">
      <AppTabs v-model="tab" :tabs="tabs" label="Settings sections" :unmount="false" panel-class="pt-6 focus:outline-none">
        <!-- Booking & Rates -->
        <template #booking>
          <div data-tab="booking" class="space-y-6">
            <Card v-if="hasRates" variant="outlined" padding="lg" tag="section" aria-labelledby="rates-heading">
              <h2 id="rates-heading" class="font-display text-headline-s text-on-surface">Rates</h2>
              <p class="mt-1 text-body-m text-on-surface-variant">
                Per player. Online booking and the register (the Greens Fees / Cart Fees products) both charge these.
              </p>
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MoneyField
                  v-for="key in RATE_KEYS"
                  :key="key"
                  v-model="rateCents[key]"
                  :label="RATE_LABELS[key]"
                  :min="0"
                  :max="100000"
                  required
                />
              </div>

              <h3 class="mt-6 text-title-m text-on-surface">Holidays</h3>
              <p class="mt-1 text-body-m text-on-surface-variant">
                These dates get weekend rates. Saturdays and Sundays always do.
              </p>
              <ul v-if="holidayDates.length" class="mt-3 flex flex-wrap gap-2" aria-label="Holidays">
                <li
                  v-for="d in holidayDates"
                  :key="d"
                  class="inline-flex items-center gap-1 h-8 pl-3 rounded-shape-sm border border-outline text-label-l text-on-surface-variant"
                >
                  {{ formatLocalDate(d, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }}
                  <IconButton
                    :icon="IconClose"
                    size="sm"
                    :label="`Remove ${formatLocalDate(d, { month: 'long', day: 'numeric', year: 'numeric' })}`"
                    @click="holidayDates = holidayDates.filter(x => x !== d)"
                  />
                </li>
              </ul>
              <p v-else class="mt-3 text-body-m text-on-surface-variant">No holidays added.</p>
              <div class="mt-4 flex flex-wrap items-center gap-3">
                <TextField v-model="newHoliday" type="date" label="Holiday date" float-label class="w-full sm:w-56" />
                <AppButton variant="outlined" :icon="IconAdd" :disabled="!isValidYmd(newHoliday)" @click="addHoliday">
                  Add holiday
                </AppButton>
              </div>
            </Card>

            <Card variant="outlined" padding="lg" tag="section" aria-labelledby="booking-heading">
              <h2 id="booking-heading" class="font-display text-headline-s text-on-surface">Booking</h2>
              <p class="mt-1 text-body-m text-on-surface-variant">
                Changes take effect immediately for new bookings. Existing bookings aren't affected.
              </p>
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField
                  v-model.number="form.publicBookingDays"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="90"
                  required
                  label="Public booking window"
                  suffix="days"
                  helper="How far ahead guests can book"
                />
                <TextField
                  v-model.number="form.memberBookingDays"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="90"
                  required
                  label="Member booking window"
                  suffix="days"
                  helper="How far ahead members can book"
                />
                <TextField v-model="form.firstTeeTime" type="time" label="First tee time" float-label required />
                <TextField v-model="form.lastTeeTime" type="time" label="Last tee time" float-label required />
                <SelectField
                  v-model="form.intervalMinutes"
                  label="Tee time interval"
                  required
                  :options="INTERVALS.map(m => ({ value: m, label: `${m} minutes` }))"
                />
              </div>

              <template v-if="hasPayAtCourse">
                <h3 class="mt-6 text-title-m text-on-surface">Pay at course</h3>
                <p class="mt-1 text-body-m text-on-surface-variant">
                  Online golfers can pay just this fee to hold the tee time and the rest at the pro shop when they check in.
                  The fee isn't refunded if the booking is cancelled or missed. It's offered only when it's less than the
                  booking's total.
                </p>
                <MoneyField
                  v-model="form.payAtCourseFeeCents"
                  label="Hold fee per booking"
                  :min="0"
                  :max="MAX_PAY_AT_COURSE_FEE_CENTS"
                  :helper="`$0.00 = off (online bookings pay in full). Otherwise at least ${formatCents(MIN_PAY_AT_COURSE_FEE_CENTS)}.`"
                  :error="holdFeeError"
                  class="mt-4 w-full sm:max-w-sm"
                />
              </template>
            </Card>
          </div>
        </template>

        <!-- Payroll -->
        <template #payroll>
          <div data-tab="payroll" class="space-y-6">
            <Card variant="outlined" padding="lg" tag="section" aria-labelledby="payroll-heading">
              <h2 id="payroll-heading" class="font-display text-headline-s text-on-surface">Payroll</h2>
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  v-model="form.payPeriodDays"
                  label="Pay period"
                  required
                  :options="[{ value: 7, label: 'Weekly' }, { value: 14, label: 'Every two weeks' }]"
                />
                <TextField v-model="form.payPeriodAnchor" type="date" label="A pay period starts on" float-label required />
              </div>
              <p v-if="periodPreview" class="mt-4 text-body-m text-on-surface-variant">
                Workweeks start on {{ periodPreview.weekday }}. Current pay period: {{ periodPreview.label }}.
                Overtime is calculated per workweek.
              </p>
            </Card>
            <TimeClockDevices />
          </div>
        </template>

        <!-- Point of Sale -->
        <template #pos>
          <div data-tab="pos">
            <Card variant="outlined" padding="lg" tag="section" aria-labelledby="pos-heading">
              <h2 id="pos-heading" class="font-display text-headline-s text-on-surface">Point of Sale</h2>
              <TextField
                v-model="form.salesTaxPercent"
                type="number"
                inputmode="decimal"
                min="0"
                max="20"
                step="0.01"
                label="Sales tax rate"
                suffix="%"
                class="mt-4 w-full sm:w-56"
              />
              <p class="mt-1 px-4 text-body-s text-on-surface-variant">
                Combined state, county and city rate. Applies to every category not marked tax-exempt
                (Products → Categories).
              </p>
              <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <PositionChecklist
                  v-for="group in positionGroups"
                  :key="group.field"
                  v-model="form[group.field]"
                  :label="group.label"
                  :help="group.help"
                />
              </div>
            </Card>
          </div>
        </template>

        <!-- Tipping -->
        <template v-if="hasTipping" #tipping>
          <div data-tab="tipping">
            <Card variant="outlined" padding="lg" tag="section" aria-labelledby="tipping-heading">
              <h2 id="tipping-heading" class="font-display text-headline-s text-on-surface">Tipping</h2>
              <Switch
                v-model="tipping.enabled"
                label="Ask for a tip on the card reader"
                helper="Card sales at the register show these tip choices on the reader. Tips are charged on top of the sale, aren't sales or taxed, and show on the receipt and as &quot;Card tips&quot; on the reports. Refunds don't return the tip."
                class="mt-2"
              />
              <template v-if="tipping.enabled">
                <h3 class="mt-6 text-title-s text-on-surface">Tip choices</h3>
                <p class="mt-1 text-body-m text-on-surface-variant">Up to three. Leave a box empty to offer fewer.</p>
                <div class="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
                  <TextField
                    v-for="i in 3"
                    :key="i"
                    v-model.number="tipping.percentages[i - 1]"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="50"
                    step="1"
                    :label="`Choice ${i}`"
                    suffix="%"
                  />
                </div>
                <Switch v-model="tipping.preTax" label="Work out tips before tax" class="mt-4" />
              </template>
            </Card>
          </div>
        </template>

        <!-- On Course -->
        <template v-if="hasCourse" #course>
          <div data-tab="course" class="space-y-6">
            <Card variant="outlined" padding="lg" tag="section" aria-labelledby="round-heading">
              <h2 id="round-heading" class="font-display text-headline-s text-on-surface">Pace of play</h2>
              <fieldset class="mt-4">
                <legend class="text-title-s text-on-surface">Expected 18-hole round</legend>
                <div class="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
                  <SelectField
                    v-model="course.hours"
                    label="Hours"
                    required
                    :options="[2, 3, 4, 5, 6].map(h => ({ value: h, label: `${h} h` }))"
                  />
                  <SelectField
                    v-model="course.minutes"
                    label="Minutes"
                    required
                    :options="ROUND_MINUTE_STEPS.map(m => ({ value: m, label: `${m} min` }))"
                  />
                </div>
              </fieldset>
              <p class="mt-3 text-body-m text-on-surface-variant">
                Used until there's history: split across the holes by par (a 9-hole round takes that nine's share). Each
                night every hole's time is learned from the last {{ LEARN_DAYS }} days of tee-offs, position reports and
                finishes, and the On Course page estimates with those.
              </p>

              <div class="mt-6 flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-title-m text-on-surface">Learned hole times (minutes)</h3>
                <AppButton variant="text" :icon="IconRefresh" :loading="relearning" @click="relearn">
                  {{ relearning ? 'Recalculating…' : 'Recalculate now' }}
                </AppButton>
              </div>
              <ol class="mt-2 grid grid-cols-3 sm:grid-cols-6 xl:grid-cols-9 gap-2" aria-label="Minutes per hole">
                <li
                  v-for="h in holeTimes"
                  :key="h.hole"
                  class="rounded-shape-xs bg-surface-container-low px-1 py-2 text-center"
                >
                  <span class="block text-label-m text-on-surface-variant">Hole {{ h.hole }}</span>
                  <span class="block text-title-m text-on-surface tabular-nums">
                    {{ h.minutes.toFixed(1) }}<span class="sr-only"> minutes</span>
                  </span>
                  <span class="block text-body-s text-on-surface-variant">Par {{ h.par }}</span>
                </li>
              </ol>
              <p class="mt-3 text-body-m text-on-surface-variant">
                <template v-if="learnedTimes.updatedAt">
                  From {{ learnedTimes.rounds }} round{{ learnedTimes.rounds === 1 ? '' : 's' }}, updated
                  {{ new Date(learnedTimes.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) }}.
                  18 holes ≈ {{ formatMinutes(learnedTotal) }}.
                </template>
                <template v-else>Not learned yet: showing the par split of the expected round.</template>
              </p>
              <ErrorBanner v-if="relearnError" class="mt-3" :message="relearnError" @dismiss="relearnError = null" />
            </Card>

            <Card variant="outlined" padding="lg" tag="section" aria-labelledby="course-access-heading">
              <h2 id="course-access-heading" class="font-display text-headline-s text-on-surface">On Course page</h2>
              <PositionChecklist
                v-model="course.positions"
                label="Can update groups on the course"
                help="Besides everyone who can use the register: record tee-offs, where groups are, and finishes."
                class="mt-4 sm:max-w-md"
              />
            </Card>
          </div>
        </template>

        <!-- House Accounts -->
        <template v-if="hasLateFee" #house>
          <div data-tab="house">
            <Card variant="outlined" padding="lg" tag="section" aria-labelledby="house-heading">
              <h2 id="house-heading" class="font-display text-headline-s text-on-surface">House Accounts</h2>
              <MoneyField
                v-model="form.lateFeeCents"
                label="Late fee"
                :min="0"
                :max="50000"
                helper="$0.00 = off. Added once to a monthly statement that's still unpaid the day after its due date, when the member is emailed a reminder."
                class="mt-4 w-full sm:max-w-sm"
              />
            </Card>
          </div>
        </template>
      </AppTabs>

      <div
        v-if="saveWarning"
        role="status"
        class="mt-6 flex items-start gap-3 rounded-shape-md bg-warning-container text-on-warning-container pl-4 pr-1 py-1"
      >
        <IconWarning class="w-6 h-6 mt-3 flex-shrink-0" aria-hidden="true" />
        <p class="flex-1 py-3 text-body-m">{{ saveWarning }}</p>
        <IconButton :icon="IconClose" label="Dismiss" variant="inherit" @click="saveWarning = null" />
      </div>

      <!-- Sticky save bar: only while there are unsaved changes -->
      <div v-if="dirty || saving" class="sticky bottom-0 z-[2] mt-6 pb-4 print:hidden">
        <div class="rounded-shape-md bg-surface-container-high shadow-elevation-2 px-4 py-3 font-body">
          <ErrorBanner v-if="saveError" class="mb-3" :message="saveError" @dismiss="saveError = null" />
          <div class="flex items-center justify-end gap-1 sm:gap-2">
            <p class="flex-1 min-w-0 truncate text-title-s text-on-surface" role="status">Unsaved changes</p>
            <AppButton variant="text" :disabled="saving" @click="discard">Discard</AppButton>
            <AppButton type="submit" :icon="IconSave" :loading="saving">{{ saving ? 'Saving…' : 'Save' }}</AppButton>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  DEFAULT_PAY_PERIOD, isValidYmd, localDate, payPeriodContaining, formatLocalDate,
} from '@/lib/timeclock'
import { DEFAULT_ROUND_MINUTES, LEARN_DAYS, formatMinutes, perHoleMinutes } from '@/lib/pace'
import { holes } from '@/data/holes'
import { apiFetch } from '@/lib/api'
import {
  DEFAULT_PAY_AT_COURSE_FEE_CENTS, DEFAULT_RATES, MAX_PAY_AT_COURSE_FEE_CENTS, MIN_PAY_AT_COURSE_FEE_CENTS, RATE_KEYS, RATE_LABELS,
} from '@/lib/rates'
import { formatCents } from '@/lib/money'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppTabs from '@/components/ui/AppTabs.vue'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Card from '@/components/ui/Card.vue'
import TextField from '@/components/ui/TextField.vue'
import SelectField from '@/components/ui/SelectField.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import Switch from '@/components/ui/Switch.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import PositionChecklist from '@/components/admin/settings/PositionChecklist.vue'
import TimeClockDevices from '@/components/admin/settings/TimeClockDevices.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconRefresh from '~icons/material-symbols/refresh-rounded'
import IconSave from '~icons/material-symbols/save-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconEvent from '~icons/material-symbols/event-available-rounded'
import IconPayroll from '~icons/material-symbols/punch-clock-rounded'
import IconPos from '~icons/material-symbols/point-of-sale-rounded'
import IconTip from '~icons/material-symbols/volunteer-activism-rounded'
import IconGolf from '~icons/material-symbols/golf-course-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'

const INTERVALS = [8, 9, 10, 12, 15]
const ROUND_MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

const positionGroups = [
  { field: 'registerPositions', label: 'Can use the register', help: 'Employees in these positions can ring sales.' },
  { field: 'managerPositions',  label: 'Register managers',    help: 'Can approve No Sale, voids and refunds.' },
]

const confirm  = useConfirm()
const snackbar = useSnackbar()

const loading   = ref(true)
const error     = ref(null)
const saving    = ref(false)
const saveError = ref(null)
const formEl    = ref(null)
const tab       = ref('booking')

// Rates (cents, saved onto the rate products) and holiday dates: only shown (and saved) once the API returns rates,
// i.e. the database has migration 11
const hasRates     = ref(false)
const rateCents    = ref({ ...DEFAULT_RATES })
const holidayDates = ref([])
const newHoliday   = ref('')

function addHoliday() {
  if (!isValidYmd(newHoliday.value)) return
  holidayDates.value = [...new Set([...holidayDates.value, newHoliday.value])].sort()
  newHoliday.value = ''
}

const form = ref({
  publicBookingDays: 7,
  memberBookingDays: 14,
  firstTeeTime: '07:30',
  lastTeeTime: '17:00',
  intervalMinutes: 10,
  payPeriodDays: DEFAULT_PAY_PERIOD.lengthDays,
  payPeriodAnchor: DEFAULT_PAY_PERIOD.anchor,
  salesTaxPercent: '0.00',
  registerPositions: [],
  managerPositions: [],
  lateFeeCents: 0,
  payAtCourseFeeCents: DEFAULT_PAY_AT_COURSE_FEE_CENTS,
})
// Only shown (and saved) once the database has CourseSettings.lateFeeCents
const hasLateFee = ref(false)
// Pay at course hold fee: only shown (and saved) once the database has CourseSettings.payAtCourseFeeCents
const hasPayAtCourse = ref(false)
// Stripe can't charge less than $0.50
const holdFeeError = computed(() => {
  const fee = form.value.payAtCourseFeeCents
  return fee > 0 && fee < MIN_PAY_AT_COURSE_FEE_CENTS ? `At least ${formatCents(MIN_PAY_AT_COURSE_FEE_CENTS)}, or $0.00 for off` : ''
})
// On-reader tipping: only shown (and saved) once the database has CourseSettings.tippingEnabled
const hasTipping  = ref(false)
const tipping     = ref({ enabled: false, percentages: [15, 18, 20], preTax: true })
const saveWarning = ref(null)
// On-course tracking: only shown (and saved) once the database has CourseSettings.roundMinutes
const hasCourse = ref(false)
const course    = ref({ hours: 4, minutes: 15, positions: [] })
const learnedTimes = ref({ holeSeconds: [], rounds: 0, updatedAt: null })
const relearning   = ref(false)
const relearnError = ref(null)

const tabs = computed(() => [
  { key: 'booking', label: hasRates.value ? 'Booking & Rates' : 'Booking', icon: IconEvent },
  { key: 'payroll', label: 'Payroll', icon: IconPayroll },
  { key: 'pos', label: 'Point of Sale', icon: IconPos },
  ...(hasTipping.value ? [{ key: 'tipping', label: 'Tipping', icon: IconTip }] : []),
  ...(hasCourse.value ? [{ key: 'course', label: 'On Course', icon: IconGolf }] : []),
  ...(hasLateFee.value ? [{ key: 'house', label: 'House Accounts', icon: IconWallet }] : []),
])

// ─── Unsaved changes ────────────────────────────────────────────────────────
// Everything the Save button sends, as JSON: compared with the last loaded/saved copy

const editable = () => ({
  form: form.value,
  rateCents: rateCents.value,
  holidayDates: holidayDates.value,
  tipping: tipping.value,
  course: course.value,
})
const snapshot = ref('')
const takeSnapshot = () => { snapshot.value = JSON.stringify(editable()) }
const dirty = computed(() => !loading.value && !error.value && snapshot.value !== '' && JSON.stringify(editable()) !== snapshot.value)

function discard() {
  const saved = JSON.parse(snapshot.value)
  form.value = saved.form
  rateCents.value = saved.rateCents
  holidayDates.value = saved.holidayDates
  tipping.value = saved.tipping
  course.value = saved.course
  saveError.value = null
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return confirm({
    title: 'Discard unsaved changes?',
    message: "Your changes to the settings haven't been saved.",
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    destructive: true,
  })
})

function onBeforeUnload(e) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

// ─── On course ──────────────────────────────────────────────────────────────

// Learned times if there are any, otherwise the par split of the round length being edited
const holeTimes = computed(() => {
  const minutes = perHoleMinutes({
    roundMinutes: course.value.hours * 60 + course.value.minutes,
    holeSeconds: learnedTimes.value.holeSeconds,
  })
  return holes.map((h, i) => ({ hole: h.hole, par: h.par, minutes: minutes[i] }))
})
const learnedTotal = computed(() => holeTimes.value.reduce((s, h) => s + h.minutes, 0))

async function relearn() {
  relearning.value = true
  relearnError.value = null
  try {
    const data = await apiFetch('/api/admin/pace', { method: 'POST' })
    learnedTimes.value = { holeSeconds: data.holeSeconds, rounds: data.rounds, updatedAt: data.updatedAt }
    snackbar.show('Hole times recalculated')
  } catch (e) {
    relearnError.value = e.message
  } finally {
    relearning.value = false
  }
}

const periodPreview = computed(() => {
  const { payPeriodAnchor: anchor, payPeriodDays: lengthDays } = form.value
  if (!isValidYmd(anchor) || !lengthDays) return null
  const { start, end } = payPeriodContaining(localDate(), { anchor, lengthDays })
  return {
    weekday: formatLocalDate(anchor, { weekday: 'long' }),
    label: `${formatLocalDate(start, { month: 'short', day: 'numeric' })} – ${formatLocalDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`,
  }
})

// ─── Load / save ────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value   = null
  try {
    const data = await apiFetch('/api/admin/settings')
    hasRates.value = data.rates !== undefined
    if (hasRates.value) {
      rateCents.value = Object.fromEntries(RATE_KEYS.map(k => [k, data.rates[k] ?? DEFAULT_RATES[k]]))
      holidayDates.value = [...(data.holidayDates ?? [])].sort()
    }
    form.value = {
      publicBookingDays:   data.publicBookingDays,
      memberBookingDays:   data.memberBookingDays,
      firstTeeTime:        data.firstTeeTime,
      lastTeeTime:         data.lastTeeTime,
      intervalMinutes:     data.intervalMinutes,
      payPeriodDays:       data.payPeriodDays ?? DEFAULT_PAY_PERIOD.lengthDays,
      payPeriodAnchor:     data.payPeriodAnchor ?? DEFAULT_PAY_PERIOD.anchor,
      salesTaxPercent:     ((data.salesTaxBps ?? 0) / 100).toFixed(2),
      registerPositions:   data.registerPositions ?? [],
      managerPositions:    data.managerPositions ?? [],
      lateFeeCents:        data.lateFeeCents ?? 0,
      payAtCourseFeeCents: data.payAtCourseFeeCents ?? DEFAULT_PAY_AT_COURSE_FEE_CENTS,
    }
    hasLateFee.value = data.lateFeeCents !== undefined
    hasPayAtCourse.value = data.payAtCourseFeeCents !== undefined
    hasTipping.value = data.tippingEnabled !== undefined
    const percentages = [...(data.tipPercentages?.length ? data.tipPercentages : [15, 18, 20])]
    tipping.value = { enabled: !!data.tippingEnabled, percentages, preTax: data.tipPreTax !== false }
    hasCourse.value = data.roundMinutes !== undefined
    const roundMinutes = data.roundMinutes ?? DEFAULT_ROUND_MINUTES
    course.value = { hours: Math.floor(roundMinutes / 60), minutes: roundMinutes % 60, positions: data.coursePositions ?? [] }
    learnedTimes.value = { holeSeconds: data.holeSeconds ?? [], rounds: data.holeTimesRounds ?? 0, updatedAt: data.holeTimesUpdatedAt ?? null }
    if (!tabs.value.some(t => t.key === tab.value)) tab.value = 'booking'
    takeSnapshot()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// The form edits tax as a percentage; the API stores basis points (9.25% = 925). Money is edited in cents already.
function settingsPayload() {
  const { salesTaxPercent, lateFeeCents, payAtCourseFeeCents, ...rest } = form.value
  return {
    ...rest,
    salesTaxBps: Math.round(Number(salesTaxPercent || 0) * 100),
    ...(hasLateFee.value ? { lateFeeCents: lateFeeCents ?? 0 } : {}),
    ...(hasPayAtCourse.value ? { payAtCourseFeeCents: payAtCourseFeeCents ?? 0 } : {}),
    ...(hasTipping.value ? tippingPayload() : {}),
    ...(hasRates.value
      ? {
          rates: Object.fromEntries(RATE_KEYS.map(k => [k, rateCents.value[k] ?? 0])),
          holidayDates: holidayDates.value,
        }
      : {}),
    ...(hasCourse.value
      ? { roundMinutes: course.value.hours * 60 + course.value.minutes, coursePositions: course.value.positions }
      : {}),
  }
}

// Empty tip boxes are dropped, so the course can offer one, two or three choices
function tippingPayload() {
  const { enabled, percentages, preTax } = tipping.value
  return {
    tippingEnabled: enabled,
    tipPreTax: preTax,
    ...(enabled ? { tipPercentages: percentages.filter(p => p !== '' && p != null).map(Number) } : {}),
  }
}

// The panels stay mounted (hidden), so an invalid field may be on another tab: show that tab, then the message
async function firstInvalidField() {
  const bad = formEl.value?.querySelector(':invalid:not(fieldset):not(form)')
  if (!bad) return null
  const key = bad.closest('[data-tab]')?.dataset.tab
  if (key && key !== tab.value) {
    tab.value = key
    await nextTick()
  }
  bad.reportValidity()
  bad.focus()
  return bad
}

async function save() {
  if (await firstInvalidField()) return
  if (holdFeeError.value) {
    tab.value = 'booking'
    saveError.value = `Hold fee: ${holdFeeError.value}`
    return
  }
  saving.value      = true
  saveError.value   = null
  saveWarning.value = null
  try {
    const data = await apiFetch('/api/admin/settings', { method: 'PUT', body: settingsPayload() })
    saveWarning.value = data.warning ?? null
    takeSnapshot()
    snackbar.show('Settings saved')
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
