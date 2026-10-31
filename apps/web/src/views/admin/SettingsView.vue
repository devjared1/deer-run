<template>
  <div class="max-w-xl">
    <div v-if="loading" class="text-gray-400 text-sm">Loading…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <form v-else @submit.prevent="save" class="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <label class="label-sm">Price Per Player (cents)</label>
        <div class="flex items-center gap-3">
          <input type="number" v-model.number="form.pricePerPlayerCents" min="100" step="100" class="input-field w-40" />
          <span class="text-gray-400 text-sm font-body">=  ${{ (form.pricePerPlayerCents / 100).toFixed(2) }}</span>
        </div>
        <p class="text-gray-400 text-xs mt-1 font-body">Stored and charged in cents. e.g. 4500 = $45.00</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
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

    <div class="mt-4 bg-amber/10 border border-amber/30 rounded-xl p-4 text-sm font-body text-bark">
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

const form = ref({
  pricePerPlayerCents: 4500,
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
    form.value = {
      pricePerPlayerCents: data.pricePerPlayerCents,
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
