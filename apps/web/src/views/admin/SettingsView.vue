<template>
  <div class="max-w-xl">
    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <form v-else @submit.prevent="save" class="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div v-if="hasRates">
        <h2 class="font-display font-bold text-bark text-sm mb-1">Rates</h2>
        <p class="text-gray-500 text-xs mb-3 font-body">
          Per player. Online booking and the register (the Greens Fees / Cart Fees products) both charge these.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-for="key in RATE_KEYS" :key="key">
            <label :for="`rate-${key}`" class="label-sm">{{ RATE_LABELS[key] }}</label>
            <div class="flex items-center gap-1">
              <span class="text-gray-500 text-sm font-body">$</span>
              <input
                :id="`rate-${key}`"
                v-model="rateDollars[key]"
                type="number"
                inputmode="decimal"
                min="0"
                max="1000"
                step="0.01"
                required
                class="input-field w-32"
              />
            </div>
          </div>
        </div>

        <div class="mt-4">
          <label for="holiday-date" class="label-sm">Holidays (weekend rates)</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="d in holidayDates"
              :key="d"
              class="inline-flex items-center gap-1 rounded-full bg-gray-100 text-bark text-xs font-body pl-3 pr-1 py-1"
            >
              {{ formatLocalDate(d, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }}
              <button
                type="button"
                class="w-6 h-6 rounded-full hover:bg-gray-200"
                :aria-label="`Remove ${d}`"
                @click="holidayDates = holidayDates.filter(x => x !== d)"
              >×</button>
            </span>
            <span v-if="!holidayDates.length" class="text-gray-500 text-xs font-body">None. Saturdays and Sundays always get weekend rates.</span>
          </div>
          <div class="flex items-center gap-2">
            <input id="holiday-date" v-model="newHoliday" type="date" class="input-field w-44" />
            <button type="button" class="btn-outline-pine px-3 py-1.5 text-xs" :disabled="!isValidYmd(newHoliday)" @click="addHoliday">
              Add holiday
            </button>
          </div>
        </div>
      </div>

      <div :class="['grid grid-cols-2 gap-4', hasRates ? 'border-t border-gray-100 pt-5' : '']">
        <div>
          <label class="label-sm">Public Booking Window (days)</label>
          <input type="number" v-model.number="form.publicBookingDays" min="1" max="90" class="input-field w-full" />
        </div>
        <div>
          <label class="label-sm">Member Booking Window (days)</label>
          <input type="number" v-model.number="form.memberBookingDays" min="1" max="90" class="input-field w-full" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label-sm">First Tee Time</label>
          <input type="time" v-model="form.firstTeeTime" class="input-field w-full" />
        </div>
        <div>
          <label class="label-sm">Last Tee Time</label>
          <input type="time" v-model="form.lastTeeTime" class="input-field w-full" />
        </div>
      </div>

      <div>
        <label class="label-sm">Tee Time Interval (minutes)</label>
        <select v-model.number="form.intervalMinutes" class="input-field w-40">
          <option :value="8">8</option>
          <option :value="9">9</option>
          <option :value="10">10</option>
          <option :value="12">12</option>
          <option :value="15">15</option>
        </select>
      </div>

      <div class="border-t border-gray-100 pt-5">
        <h2 class="font-display font-bold text-bark text-sm mb-3">Payroll</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label-sm">Pay Period</label>
            <select v-model.number="form.payPeriodDays" class="input-field w-full">
              <option :value="7">Weekly</option>
              <option :value="14">Bi-weekly</option>
            </select>
          </div>
          <div>
            <label class="label-sm">A Pay Period Starts On</label>
            <input v-model="form.payPeriodAnchor" type="date" class="input-field w-full" />
          </div>
        </div>
        <p v-if="periodPreview" class="text-gray-400 text-xs mt-2 font-body">
          Workweeks start on {{ periodPreview.weekday }}. Current pay period:
          {{ periodPreview.label }}. Overtime is calculated per workweek.
        </p>
      </div>

      <div class="border-t border-gray-100 pt-5">
        <h2 class="font-display font-bold text-bark text-sm mb-3">Point of Sale</h2>
        <div>
          <label class="label-sm">Sales Tax Rate (%)</label>
          <input
            v-model="form.salesTaxPercent"
            type="number"
            min="0"
            max="20"
            step="0.01"
            class="input-field w-40"
          />
          <p class="text-gray-400 text-xs mt-1 font-body">
            Combined state, county and city rate. Applies to every category not marked tax-exempt
            (Admin → Products → Categories).
          </p>
        </div>
        <div class="grid sm:grid-cols-2 gap-4 mt-4">
          <div v-for="group in positionGroups" :key="group.field">
            <label class="label-sm">{{ group.label }}</label>
            <p class="text-gray-400 text-xs mb-2 font-body">{{ group.help }}</p>
            <div class="space-y-1 max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-2">
              <label
                v-for="p in employeePositions"
                :key="p.value"
                class="flex items-center gap-2 text-sm font-body text-bark cursor-pointer"
              >
                <input v-model="form[group.field]" type="checkbox" :value="p.value" class="rounded" />
                {{ p.label }}
              </label>
            </div>
          </div>
        </div>
        <div v-if="hasTipping" class="mt-4">
          <label class="flex items-center gap-2 text-sm font-body text-bark cursor-pointer">
            <input v-model="tipping.enabled" type="checkbox" class="rounded" />
            Ask for a tip on the card reader
          </label>
          <p class="text-gray-400 text-xs mt-1 font-body">
            Card sales at the register show these tip choices on the reader. Tips are charged on top of the sale,
            aren't sales or taxed, and show on the receipt and as "Card tips" on the reports. Refunds don't return the tip.
          </p>
          <div v-if="tipping.enabled" class="flex flex-wrap items-end gap-4 mt-2">
            <div>
              <label class="label-sm">Tip choices (%)</label>
              <div class="flex gap-2">
                <input
                  v-for="i in 3"
                  :key="i"
                  v-model.number="tipping.percentages[i - 1]"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  class="input-field w-20"
                />
              </div>
            </div>
            <label class="flex items-center gap-2 text-sm font-body text-bark cursor-pointer pb-2">
              <input v-model="tipping.preTax" type="checkbox" class="rounded" />
              Work out tips before tax
            </label>
          </div>
        </div>
      </div>

      <div v-if="hasCourse" class="border-t border-gray-100 pt-5">
        <h2 class="font-display font-bold text-bark text-sm mb-3">On Course</h2>
        <div>
          <label class="label-sm">Expected 18-Hole Round</label>
          <div class="flex items-center gap-2">
            <select v-model.number="course.hours" class="input-field w-24">
              <option v-for="h in [2, 3, 4, 5, 6]" :key="h" :value="h">{{ h }} h</option>
            </select>
            <select v-model.number="course.minutes" class="input-field w-28">
              <option v-for="m in [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]" :key="m" :value="m">{{ m }} min</option>
            </select>
          </div>
          <p class="text-gray-400 text-xs mt-1 font-body">
            Used until there's history: split across the holes by par (a 9-hole round takes that nine's share). Each
            night every hole's time is learned from the last {{ LEARN_DAYS }} days of tee-offs, position reports and
            finishes, and the On Course page estimates with those.
          </p>
        </div>
        <div class="mt-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <label class="label-sm mb-0">Learned Hole Times (minutes)</label>
            <button type="button" class="text-xs text-pine hover:underline font-body disabled:opacity-50" :disabled="relearning" @click="relearn">
              {{ relearning ? 'Recalculating…' : 'Recalculate now' }}
            </button>
          </div>
          <div class="grid grid-cols-9 gap-1 text-center text-xs font-body">
            <div v-for="h in holeTimes" :key="h.hole" class="rounded border border-gray-200 py-1">
              <div class="text-gray-400">{{ h.hole }} · P{{ h.par }}</div>
              <div class="font-semibold text-bark">{{ h.minutes.toFixed(1) }}</div>
            </div>
          </div>
          <p class="text-gray-400 text-xs mt-1 font-body">
            <template v-if="learnedTimes.updatedAt">
              From {{ learnedTimes.rounds }} round{{ learnedTimes.rounds === 1 ? '' : 's' }}, updated
              {{ new Date(learnedTimes.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) }}.
              18 holes ≈ {{ formatMinutes(learnedTotal) }}.
            </template>
            <template v-else>Not learned yet: showing the par split of the expected round.</template>
            <span v-if="relearnError" class="text-red-500"> {{ relearnError }}</span>
          </p>
        </div>
        <div class="mt-4">
          <label class="label-sm">Can Update Groups on the Course</label>
          <p class="text-gray-400 text-xs mb-2 font-body">
            Besides everyone who can use the register: record tee-offs, where groups are, and finishes.
          </p>
          <div class="space-y-1 max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-2 sm:w-1/2">
            <label
              v-for="p in employeePositions"
              :key="p.value"
              class="flex items-center gap-2 text-sm font-body text-bark cursor-pointer"
            >
              <input v-model="course.positions" type="checkbox" :value="p.value" class="rounded" />
              {{ p.label }}
            </label>
          </div>
        </div>
      </div>

      <div v-if="hasLateFee" class="border-t border-gray-100 pt-5">
        <h2 class="font-display font-bold text-bark text-sm mb-3">House Accounts</h2>
        <div>
          <label class="label-sm">Late Fee ($)</label>
          <input
            v-model="form.lateFeeDollars"
            type="number"
            min="0"
            max="500"
            step="0.01"
            class="input-field w-40"
          />
          <p class="text-gray-400 text-xs mt-1 font-body">
            0 = off. Added once to a monthly statement that's still unpaid the day after its due date, when the member
            is emailed a reminder.
          </p>
        </div>
      </div>

      <div class="pt-2 flex items-center gap-4">
        <button type="submit" :disabled="saving" class="btn-amber px-5 py-2 text-sm">
          {{ saving ? 'Saving…' : 'Save Settings' }}
        </button>
        <span v-if="saved" class="text-green-600 text-sm font-body">✓ Saved</span>
        <span v-if="saveError" class="text-red-500 text-sm font-body">{{ saveError }}</span>
        <span v-if="saveWarning" class="text-clay text-sm font-body">{{ saveWarning }}</span>
      </div>
    </form>

    <div class="mt-4 bg-gold/10 border border-gold/30 rounded-xl p-4 text-sm font-body text-bark">
      <strong class="font-semibold">Note:</strong> Changing price or booking window takes effect immediately for all new bookings.
      Existing pending/confirmed bookings are not affected.
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  DEFAULT_PAY_PERIOD, isValidYmd, localDate, payPeriodContaining, formatLocalDate,
} from '@/lib/timeclock'
import { employeePositions } from '@/data/employeePositions'
import { DEFAULT_ROUND_MINUTES, LEARN_DAYS, formatMinutes, perHoleMinutes } from '@/lib/pace'
import { holes } from '@/data/holes'
import { apiFetch } from '@/lib/api'
import { DEFAULT_RATES, RATE_KEYS, RATE_LABELS } from '@/lib/rates'

const positionGroups = [
  { field: 'registerPositions', label: 'Can Use the Register', help: 'Employees in these positions can ring sales.' },
  { field: 'managerPositions',  label: 'Register Managers',    help: 'Can approve No Sale, voids and refunds.' },
]

const authStore = useAuthStore()
const loading   = ref(true)
const error     = ref(null)
const saving    = ref(false)
const saved     = ref(false)
const saveError = ref(null)

// Rates (edited in dollars, saved in cents onto the rate products) and holiday dates: only shown (and saved) once
// the API returns rates, i.e. the database has migration 11
const hasRates     = ref(false)
const rateDollars  = ref(Object.fromEntries(RATE_KEYS.map(k => [k, (DEFAULT_RATES[k] / 100).toFixed(2)])))
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
  lateFeeDollars: '0.00',
})
// Only shown (and saved) once the database has CourseSettings.lateFeeCents
const hasLateFee = ref(false)
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

async function load() {
  loading.value = true
  error.value   = null
  try {
    const res = await fetch('/api/admin/settings', {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    const data = await res.json()
    hasRates.value = data.rates !== undefined
    if (hasRates.value) {
      rateDollars.value = Object.fromEntries(RATE_KEYS.map(k => [k, ((data.rates[k] ?? DEFAULT_RATES[k]) / 100).toFixed(2)]))
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
      lateFeeDollars:      ((data.lateFeeCents ?? 0) / 100).toFixed(2),
    }
    hasLateFee.value = data.lateFeeCents !== undefined
    hasTipping.value = data.tippingEnabled !== undefined
    const percentages = [...(data.tipPercentages?.length ? data.tipPercentages : [15, 18, 20])]
    tipping.value = { enabled: !!data.tippingEnabled, percentages, preTax: data.tipPreTax !== false }
    hasCourse.value = data.roundMinutes !== undefined
    const roundMinutes = data.roundMinutes ?? DEFAULT_ROUND_MINUTES
    course.value = { hours: Math.floor(roundMinutes / 60), minutes: roundMinutes % 60, positions: data.coursePositions ?? [] }
    learnedTimes.value = { holeSeconds: data.holeSeconds ?? [], rounds: data.holeTimesRounds ?? 0, updatedAt: data.holeTimesUpdatedAt ?? null }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// The form edits tax as a percentage; the API stores basis points (9.25% = 925). The late fee is edited in dollars.
function settingsPayload() {
  const { salesTaxPercent, lateFeeDollars, ...rest } = form.value
  return {
    ...rest,
    salesTaxBps: Math.round(Number(salesTaxPercent || 0) * 100),
    ...(hasLateFee.value ? { lateFeeCents: Math.round(Number(lateFeeDollars || 0) * 100) } : {}),
    ...(hasTipping.value ? tippingPayload() : {}),
    ...(hasRates.value
      ? {
          rates: Object.fromEntries(RATE_KEYS.map(k => [k, Math.round(Number(rateDollars.value[k] || 0) * 100)])),
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

async function save() {
  saving.value   = true
  saved.value    = false
  saveError.value = null
  saveWarning.value = null
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.getToken()}` },
      body: JSON.stringify(settingsPayload()),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || res.statusText)
    saveWarning.value = data.warning ?? null
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.input-field { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm    { @apply block text-xs text-gray-500 mb-1 font-body; }
</style>
