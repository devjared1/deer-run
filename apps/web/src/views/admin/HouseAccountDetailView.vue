<template>
  <div class="max-w-5xl">
    <RouterLink to="/admin/house-accounts" class="text-sm text-lake hover:text-pine font-body print:hidden">
      ← All house accounts
    </RouterLink>

    <div v-if="loading && !data" class="text-gray-400 text-sm mt-4">
      Loading…
    </div>
    <div v-else-if="error && !data" class="text-red-500 text-sm mt-4">
      {{ error }}
    </div>

    <template v-else-if="data">
      <!-- Everything but the statement is hidden when printing one -->
      <div :class="statement ? 'print:hidden' : ''">
        <div class="bg-white rounded-xl border border-gray-200 p-5 mt-3 mb-5 flex flex-wrap gap-x-10 gap-y-4 items-start">
          <div class="min-w-[12rem]">
            <div class="font-display font-bold text-bark text-xl">
              {{ account.user?.name || account.user?.email }}
            </div>
            <div class="text-sm text-gray-500 font-body">
              {{ account.user?.email }}
            </div>
            <span :class="['inline-block mt-2 text-xs px-2 py-0.5 rounded-full', STATUS_CLASSES[account.status]]">{{ STATUS_LABELS[account.status] }}</span>
          </div>
          <div>
            <div class="stat-label">
              Balance
            </div>
            <div class="font-display font-bold text-2xl tabular-nums" :class="account.balanceCents > 0 ? 'text-bark' : 'text-pine'">
              {{ formatCents(account.balanceCents) }}
            </div>
            <div class="text-xs text-gray-400 font-body">
              {{ formatCents(account.availableCents) }} available of {{ formatCents(account.creditLimitCents) }}
            </div>
          </div>
          <div class="text-sm font-body space-y-1">
            <div>
              <span class="text-gray-400">PIN:</span>
              <span v-if="account.pinLocked" class="text-red-500 font-semibold"> locked</span>
              <span v-else>{{ account.hasPin ? ' set' : ' not set yet' }}</span>
            </div>
            <div>
              <span class="text-gray-400">Billing:</span>
              {{ account.autopayEnabled ? ` autopay (${cardLabel(account)})` : ' invoice (pays online or at the pro shop)' }}
            </div>
          </div>
          <div class="ml-auto flex flex-wrap gap-2">
            <button class="btn-outline-sm" @click="openEdit">
              Edit
            </button>
            <button v-if="account.hasPin || account.pinLocked" class="btn-outline-sm" @click="resetPin">
              Reset PIN
            </button>
            <button class="btn-outline-sm" @click="adjusting = { amount: '', kind: 'credit', reason: '', busy: false, error: null }">
              Adjust balance
            </button>
          </div>
        </div>
        <p v-if="notice" class="text-pine text-sm font-body mb-3">
          {{ notice }}
        </p>
        <p v-if="error" class="text-red-500 text-sm font-body mb-3">
          {{ error }}
        </p>

        <div class="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
          <!-- Ledger -->
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-100 font-semibold text-bark font-body text-sm">
              Activity
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm font-body">
                <tbody class="divide-y divide-gray-50">
                  <tr v-for="e in data.entries" :key="e.id">
                    <td class="td text-gray-500 whitespace-nowrap">
                      {{ formatWhen(e.createdAt) }}
                    </td>
                    <td class="td">
                      {{ e.description }}
                      <span class="text-xs text-gray-400"> · {{ ENTRY_TYPE_LABELS[e.type] }}</span>
                    </td>
                    <td class="td text-right tabular-nums" :class="e.amountCents < 0 ? 'text-pine' : 'text-bark'">
                      {{ e.amountCents < 0 ? '−' : '' }}{{ formatCents(Math.abs(e.amountCents)) }}
                    </td>
                  </tr>
                  <tr v-if="!data.entries.length">
                    <td class="td text-gray-400 text-center py-8" colspan="3">
                      No activity yet.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Statements -->
          <div class="space-y-5">
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <div class="font-semibold text-bark font-body text-sm mb-3">
                Statement for any dates
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="label-sm">From</label>
                  <input v-model="range.from" type="date" class="input-field w-full">
                </div>
                <div>
                  <label class="label-sm">To</label>
                  <input v-model="range.to" type="date" class="input-field w-full">
                </div>
              </div>
              <button class="btn-pine w-full mt-3 py-2 text-sm" :disabled="!range.from || !range.to" @click="showStatement(range.from, range.to)">
                Show statement
              </button>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div class="px-4 py-3 border-b border-gray-100 font-semibold text-bark font-body text-sm">
                Monthly statements
              </div>
              <ul class="divide-y divide-gray-50 font-body text-sm">
                <li v-for="s in data.statements" :key="s.id" class="px-4 py-2.5 flex items-center gap-2">
                  <button class="text-lake hover:text-pine text-left flex-1" @click="showStatement(s.periodStart, s.periodEnd, s)">
                    {{ formatLocalDate(s.periodStart, { month: 'long', year: 'numeric' }) }}
                  </button>
                  <span class="tabular-nums text-gray-600">{{ formatCents(s.closingCents) }}</span>
                  <span :class="['text-xs px-2 py-0.5 rounded-full', STATEMENT_STATUS_CLASSES[statementStatus(s)]]" :title="statementNote(s)">
                    {{ STATEMENT_STATUS_LABELS[statementStatus(s)] }}
                  </span>
                </li>
                <li v-if="!data.statements.length" class="px-4 py-4 text-gray-400 text-center">
                  None yet (they go out on the 1st)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Statement view -->
      <div v-if="statement" class="mt-6">
        <div class="flex flex-wrap items-center gap-2 mb-3 print:hidden">
          <span class="font-display font-bold text-bark">Statement</span>
          <button class="btn-outline-sm ml-auto" @click="print">
            🖨 Print
          </button>
          <button class="btn-outline-sm" :disabled="emailing" @click="emailStatement">
            {{ emailing ? 'Sending…' : `Email to ${account.user?.email}` }}
          </button>
          <button class="btn-outline-sm" @click="statement = null">
            Close
          </button>
        </div>
        <StatementDocument :statement="statement" :member="account.user" />
      </div>
    </template>

    <!-- Edit status / limit -->
    <div v-if="editing" class="modal-overlay print:hidden">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-4">
          Edit account
        </h2>
        <label class="label-sm">Credit limit ($)</label>
        <input v-model="editing.limit" type="number" min="0" step="50" class="input-field w-full">
        <label class="label-sm mt-3">Status</label>
        <select v-model="editing.status" class="input-field w-full">
          <option value="ACTIVE">
            Active
          </option>
          <option value="SUSPENDED">
            Suspended (no new charges; payments still accepted)
          </option>
          <option value="CLOSED">
            Closed (balance must be $0)
          </option>
        </select>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="editing = null">
            Cancel
          </button>
          <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="editing.busy" @click="saveEdit">
            Save
          </button>
        </div>
        <p v-if="editing.error" class="text-red-500 text-xs mt-2">
          {{ editing.error }}
        </p>
      </div>
    </div>

    <!-- Adjust -->
    <div v-if="adjusting" class="modal-overlay print:hidden">
      <div class="modal-box">
        <h2 class="font-display font-bold text-bark mb-1">
          Adjust balance
        </h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          For corrections. Payments at the pro shop are taken at the register (Account payment).
        </p>
        <div class="flex rounded-lg border border-gray-300 overflow-hidden w-fit mb-3">
          <button
            v-for="k in [{ v: 'credit', l: 'Credit (lower balance)' }, { v: 'charge', l: 'Charge (raise balance)' }]"
            :key="k.v"
            type="button"
            :class="['px-3 py-2 text-sm font-body', adjusting.kind === k.v ? 'bg-pine text-parch' : 'text-gray-600 hover:bg-gray-50']"
            @click="adjusting.kind = k.v"
          >
            {{ k.l }}
          </button>
        </div>
        <label class="label-sm">Amount ($)</label>
        <input v-model="adjusting.amount" type="number" min="0.01" step="0.01" class="input-field w-full">
        <label class="label-sm mt-3">Reason *</label>
        <input v-model="adjusting.reason" type="text" maxlength="200" class="input-field w-full" placeholder="e.g. Waived late tee time charge">
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="adjusting = null">
            Cancel
          </button>
          <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="adjusting.busy || !adjusting.amount || !adjusting.reason.trim()" @click="saveAdjustment">
            Save
          </button>
        </div>
        <p v-if="adjusting.error" class="text-red-500 text-xs mt-2">
          {{ adjusting.error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents, dollarsToCents } from '@/lib/money'
import { localDate, formatLocalDate, COURSE_TZ } from '@/lib/timeclock'
import {
  STATUS_LABELS, STATUS_CLASSES, STATEMENT_STATUS_LABELS, STATEMENT_STATUS_CLASSES, ENTRY_TYPE_LABELS, cardLabel, statementStatus,
} from '@/components/accounts/accountDisplay'
import StatementDocument from '@/components/accounts/StatementDocument.vue'

const route = useRoute()
const id = route.params.id

const data      = ref(null)
const loading   = ref(false)
const error     = ref(null)
const notice    = ref(null)
const editing   = ref(null)
const adjusting = ref(null)
const statement = ref(null)
const emailing  = ref(false)
const today     = localDate()
const range     = ref({ from: `${today.slice(0, 7)}-01`, to: today })

const account = computed(() => data.value?.account)

// Tooltip on a saved statement's status: autopay error, overdue reminder and late fee
function statementNote(s) {
  const when = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: COURSE_TZ })
  return [
    s.autopayError,
    s.reminderSentAt && `Reminder emailed ${when(s.reminderSentAt)}`,
    s.lateFeeAt && `Late fee added ${when(s.lateFeeAt)}`,
  ].filter(Boolean).join(' · ')
}

async function load() {
  loading.value = true
  error.value   = null
  try {
    data.value = await apiFetch(`/api/admin/house-accounts/${id}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function showStatement(from, to, saved = null) {
  error.value = null
  try {
    const res = await apiFetch(`/api/admin/house-accounts/${id}?${new URLSearchParams({ from, to })}`)
    // A saved monthly statement keeps its own due date
    statement.value = { ...res.statement, dueDate: saved?.dueDate ?? null }
    range.value = { from, to }
  } catch (e) {
    error.value = e.message
  }
}

function print() {
  window.print()
}

async function emailStatement() {
  emailing.value = true
  notice.value = null
  error.value  = null
  try {
    const res = await apiFetch(`/api/admin/house-accounts/${id}`, {
      method: 'POST', body: { action: 'email_statement', from: statement.value.periodStart, to: statement.value.periodEnd },
    })
    notice.value = `Statement emailed to ${res.to}.`
  } catch (e) {
    error.value = e.message
  } finally {
    emailing.value = false
  }
}

function openEdit() {
  editing.value = { limit: (account.value.creditLimitCents / 100).toFixed(2), status: account.value.status, busy: false, error: null }
}

async function saveEdit() {
  const e = editing.value
  e.busy = true
  e.error = null
  try {
    await apiFetch(`/api/admin/house-accounts/${id}`, {
      method: 'PUT', body: { creditLimitCents: dollarsToCents(e.limit) ?? 0, status: e.status },
    })
    editing.value = null
    await load()
  } catch (err) {
    e.error = err.message
  } finally {
    e.busy = false
  }
}

async function resetPin() {
  if (!confirm('Clear this member\'s PIN? They set a new one in My Account before charging again.')) return
  error.value = null
  try {
    await apiFetch(`/api/admin/house-accounts/${id}`, { method: 'PUT', body: { resetPin: true } })
    notice.value = 'PIN cleared. The member can set a new one in My Account.'
    await load()
  } catch (e) {
    error.value = e.message
  }
}

async function saveAdjustment() {
  const a = adjusting.value
  a.busy = true
  a.error = null
  try {
    const cents = dollarsToCents(a.amount) ?? 0
    await apiFetch(`/api/admin/house-accounts/${id}`, {
      method: 'POST', body: { action: 'adjust', amountCents: a.kind === 'credit' ? -cents : cents, reason: a.reason },
    })
    adjusting.value = null
    await load()
  } catch (e) {
    a.error = e.message
  } finally {
    a.busy = false
  }
}

function formatWhen(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}

onMounted(load)
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.stat-label     { @apply text-gray-400 text-xs font-body uppercase tracking-wider mb-1; }
.td             { @apply px-5 py-2.5; }
.btn-pine       { @apply bg-pine text-parch rounded-lg font-body font-semibold hover:bg-pine/90 transition-colors disabled:opacity-50; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40; }
@media print { .modal-overlay { display: none !important; } }
</style>
