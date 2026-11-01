<template>
  <div class="max-w-5xl font-body text-on-surface">
    <Teleport to="#admin-page-actions" defer>
      <!-- Phones: icon only, so the page title keeps its room -->
      <template v-if="account">
        <AppButton variant="gold" :icon="IconSwap" class="hidden sm:inline-flex" @click="openAdjust">Adjust balance</AppButton>
        <IconButton variant="filled" :icon="IconSwap" label="Adjust balance" class="sm:hidden" @click="openAdjust" />
      </template>
    </Teleport>

    <template v-if="loading && !data">
      <Skeleton variant="text" :lines="2" width="40%" label="Loading house account" />
      <div class="grid gap-4 sm:grid-cols-3 mt-6">
        <Skeleton v-for="n in 3" :key="n" variant="rect" height="104px" />
      </div>
      <Skeleton variant="rect" height="240px" class="mt-6" />
    </template>

    <template v-else-if="error && !data">
      <PageHeader :level="2" title="House account" :breadcrumbs="[{ label: 'House Accounts', to: '/admin/house-accounts' }, { label: 'Not loaded' }]" />
      <ErrorBanner :message="error" :retrying="loading" @retry="load" />
    </template>

    <template v-else-if="data">
      <!-- Everything but the statement is hidden when printing one -->
      <div :class="statement ? 'print:hidden' : ''">
        <PageHeader
          :level="2"
          :title="memberName"
          :breadcrumbs="[{ label: 'House Accounts', to: '/admin/house-accounts' }, { label: memberName }]"
        >
          <template #subtitle>
            <span class="inline-flex flex-wrap items-center gap-2">
              <span v-if="account.user?.name" class="break-all">{{ account.user.email }}</span>
              <StatusChip kind="houseAccount" :status="account.status" size="sm" />
            </span>
          </template>
          <template #secondary>
            <AppButton variant="outlined" :icon="IconEdit" @click="openEdit">Edit</AppButton>
            <AppButton
              v-if="account.hasPin || account.pinLocked"
              variant="outlined"
              :icon="IconLockReset"
              :loading="resettingPin"
              @click="resetPin"
            >
              {{ resettingPin ? 'Resetting…' : 'Reset PIN' }}
            </AppButton>
          </template>
        </PageHeader>

        <div class="grid gap-4 sm:grid-cols-3">
          <StatCard label="Balance" :value="money(account.balanceCents)" :icon="IconWallet">
            <p v-if="account.balanceCents > account.creditLimitCents" class="mt-1 text-body-s text-error">Over the credit limit</p>
          </StatCard>
          <StatCard label="Credit limit" :value="money(account.creditLimitCents)" :icon="IconCreditScore" />
          <StatCard label="Available" :value="money(account.availableCents)" :icon="IconSavings" />
        </div>

        <dl class="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr] text-body-m">
          <dt class="text-on-surface-variant">PIN</dt>
          <dd>
            <StatusChip v-if="account.pinLocked" label="Locked" tone="error" icon="lock" size="sm" />
            <template v-else>{{ account.hasPin ? 'Set' : 'Not set yet' }}</template>
          </dd>
          <dt class="text-on-surface-variant">Billing</dt>
          <dd>{{ account.autopayEnabled ? `Autopay (${cardLabel(account)})` : 'Invoice (pays online or at the pro shop)' }}</dd>
        </dl>

        <ErrorBanner v-if="error" :message="error" class="mt-4" @dismiss="error = null" />

        <!-- AppTabs renders no root element of its own (no class on it) -->
        <div class="mt-6">
          <AppTabs v-model="tab" :tabs="tabs" label="House account">
            <!-- Activity -->
            <template #activity>
              <DataTable
                :columns="entryColumns"
                :rows="data.entries"
                caption="Account activity"
                dense
                :manual-sort="true"
              >
                <template #cell-description="{ row }">
                  <span class="font-normal">{{ row.description }}</span>
                  <span class="block text-body-s font-normal text-on-surface-variant">{{ ENTRY_TYPE_LABELS[row.type] ?? row.type }}</span>
                </template>
                <template #cell-amount="{ row }">
                  <span :class="['tabular-nums', row.amountCents < 0 ? 'text-primary' : '']">{{ money(row.amountCents) }}</span>
                </template>
                <template #empty>
                  <EmptyState :icon="IconReceipt" title="No activity yet" message="Charges, payments and adjustments show here." compact />
                </template>
              </DataTable>
            </template>

            <!-- Statements -->
            <template #statements>
              <div class="grid gap-6 xl:grid-cols-[1fr_24rem] items-start">
                <DataTable
                  :columns="statementColumns"
                  :rows="data.statements"
                  caption="Monthly statements"
                  caption-visible
                  :row-label="s => `${statementMonth(s)} statement, ${money(s.closingCents)}`"
                  @row-click="s => showStatement(s.periodStart, s.periodEnd, s)"
                >
                  <template #cell-month="{ row }">
                    {{ statementMonth(row) }}
                    <span v-if="statementNote(row)" class="block text-body-s font-normal text-on-surface-variant">{{ statementNote(row) }}</span>
                  </template>
                  <template #cell-closing="{ row }">
                    <span class="tabular-nums">{{ money(row.closingCents) }}</span>
                  </template>
                  <template #cell-status="{ row }">
                    <StatusChip kind="statement" :status="statementStatus(row)" size="sm" />
                  </template>
                  <template #empty>
                    <EmptyState :icon="IconDescription" title="No statements yet" message="They go out on the 1st." compact />
                  </template>
                </DataTable>

                <Card variant="outlined" tag="section" aria-labelledby="any-dates-title">
                  <h3 id="any-dates-title" class="text-title-m text-on-surface mb-2">Statement for any dates</h3>
                  <DateRangeField v-model="range" label="Dates" :presets="['thisMonth', 'lastMonth']" />
                  <AppButton
                    variant="tonal"
                    block
                    :icon="IconDescription"
                    class="mt-3"
                    :loading="loadingStatement === 'range'"
                    :disabled="!range.from || !range.to || range.to < range.from"
                    @click="showStatement(range.from, range.to, null, 'range')"
                  >
                    Show statement
                  </AppButton>
                </Card>
              </div>
            </template>
          </AppTabs>
        </div>
      </div>

      <!-- Statement view -->
      <section v-if="statement" ref="statementEl" class="mt-8 scroll-mt-20" aria-labelledby="statement-title" tabindex="-1">
        <div class="flex flex-wrap items-center gap-2 mb-3 print:hidden">
          <h3 id="statement-title" class="flex-1 min-w-0 font-display text-headline-s text-primary">Statement</h3>
          <AppButton variant="outlined" :icon="IconPrint" @click="print">Print</AppButton>
          <AppButton variant="outlined" :icon="IconMail" :loading="emailing" @click="emailStatement">
            {{ emailing ? 'Sending…' : `Email to ${account.user?.email}` }}
          </AppButton>
          <IconButton :icon="IconClose" label="Close statement" @click="statement = null" />
        </div>
        <StatementDocument :statement="statement" :member="account.user" />
      </section>
    </template>

    <!-- Edit status / limit -->
    <AppDialog v-model:open="editOpen" title="Edit account" size="sm" persistent>
      <form v-if="editing" id="edit-account-form" novalidate class="space-y-1 pt-2" @submit.prevent="saveEdit">
        <MoneyField v-model="editing.limitCents" label="Credit limit" :min="0" data-autofocus />
        <SelectField v-model="editing.status" label="Status" :options="EDIT_STATUS_OPTIONS" />
        <ErrorBanner v-if="editing.error" :message="editing.error" />
      </form>
      <template #actions="{ close }">
        <AppButton variant="text" :disabled="editing?.busy" @click="close">Cancel</AppButton>
        <AppButton type="submit" form="edit-account-form" :loading="editing?.busy">{{ editing?.busy ? 'Saving…' : 'Save' }}</AppButton>
      </template>
    </AppDialog>

    <!-- Adjust -->
    <AppDialog v-model:open="adjustOpen" title="Adjust balance" size="sm" persistent>
      <template v-if="adjusting">
        <p class="text-body-m text-on-surface-variant mb-4">
          For corrections. Payments at the pro shop are taken at the register (Account payment).
        </p>
        <form id="adjust-form" novalidate class="space-y-3" @submit.prevent="saveAdjustment">
          <SegmentedButton v-model="adjusting.kind" label="Kind of adjustment" :options="ADJUST_KINDS" block />
          <div class="space-y-3">
            <MoneyField
              v-model="adjusting.amountCents"
              label="Amount"
              :min="1"
              required
              :helper="adjustHelper"
              data-autofocus
            />
            <TextField
              v-model="adjusting.reason"
              label="Reason"
              required
              maxlength="200"
              autocomplete="off"
              placeholder="e.g. Waived late tee time charge"
            />
          </div>
          <ErrorBanner v-if="adjusting.error" :message="adjusting.error" />
        </form>
      </template>
      <template #actions="{ close }">
        <AppButton variant="text" :disabled="adjusting?.busy" @click="close">Cancel</AppButton>
        <AppButton
          type="submit"
          form="adjust-form"
          :loading="adjusting?.busy"
          :disabled="!adjusting?.amountCents || !adjusting?.reason.trim()"
        >
          {{ adjusting?.busy ? 'Saving…' : 'Save' }}
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { localDate, formatLocalDate, COURSE_TZ } from '@/lib/timeclock'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import { ENTRY_TYPE_LABELS, cardLabel, statementStatus } from '@/components/accounts/accountDisplay'
import StatementDocument from '@/components/accounts/StatementDocument.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import DateRangeField from '@/components/ui/DateRangeField.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconButton from '@/components/ui/IconButton.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import SelectField from '@/components/ui/SelectField.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextField from '@/components/ui/TextField.vue'
import IconSwap from '~icons/material-symbols/swap-vert-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconLockReset from '~icons/material-symbols/lock-reset-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'
import IconCreditScore from '~icons/material-symbols/credit-score-rounded'
import IconSavings from '~icons/material-symbols/savings-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconDescription from '~icons/material-symbols/description-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconClose from '~icons/material-symbols/close-rounded'

const EDIT_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended (no new charges; payments still accepted)' },
  { value: 'CLOSED', label: 'Closed (balance must be $0)' },
]
const ADJUST_KINDS = [
  { value: 'credit', label: 'Credit' },
  { value: 'charge', label: 'Charge' },
]

const route    = useRoute()
const id       = route.params.id
const confirm  = useConfirm()
const snackbar = useSnackbar()

const data       = ref(null)
const loading    = ref(false)
const error      = ref(null)
const tab        = ref('activity')
const editing    = ref(null)
const editOpen   = ref(false)
const adjusting  = ref(null)
const adjustOpen = ref(false)
const statement  = ref(null)
const statementEl = ref(null)
const loadingStatement = ref(null) // 'range' or a saved statement's id
const emailing   = ref(false)
const resettingPin = ref(false)
const today      = localDate()
const range      = ref({ from: `${today.slice(0, 7)}-01`, to: today })

const account    = computed(() => data.value?.account)
const memberName = computed(() => account.value?.user?.name || account.value?.user?.email || 'House account')

const tabs = computed(() => [
  { key: 'activity', label: 'Activity' },
  { key: 'statements', label: 'Statements', badge: data.value?.statements.filter(s => statementStatus(s) === 'OVERDUE').length || undefined },
])

const entryColumns = [
  { key: 'createdAt', label: 'When', format: v => formatWhen(v), class: 'whitespace-nowrap' },
  { key: 'description', label: 'Description', primary: true },
  { key: 'amount', label: 'Amount', align: 'right' },
]
const statementColumns = [
  { key: 'month', label: 'Month', primary: true },
  { key: 'closing', label: 'Balance', align: 'right' },
  { key: 'status', label: 'Status' },
]

const money = (cents) => (cents === null || cents === undefined
  ? '—'
  : `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

const adjustHelper = computed(() => {
  const a = adjusting.value
  if (!a?.amountCents || !account.value) return a?.kind === 'credit' ? 'Lowers the balance' : 'Raises the balance'
  const after = account.value.balanceCents + (a.kind === 'credit' ? -a.amountCents : a.amountCents)
  return `Balance ${money(account.value.balanceCents)} → ${money(after)}`
})

const statementMonth = (s) => formatLocalDate(s.periodStart, { month: 'long', year: 'numeric' })

// A saved statement's autopay error, overdue reminder and late fee
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

async function showStatement(from, to, saved = null, key = saved?.id) {
  error.value = null
  loadingStatement.value = key ?? 'range'
  try {
    const res = await apiFetch(`/api/admin/house-accounts/${id}?${new URLSearchParams({ from, to })}`)
    // A saved monthly statement keeps its own due date
    statement.value = { ...res.statement, dueDate: saved?.dueDate ?? null }
    range.value = { from, to }
    // It renders below the tabs: bring it into view (and move focus there for keyboard and screen reader users)
    await nextTick()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    statementEl.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    statementEl.value?.focus({ preventScroll: true })
  } catch (e) {
    error.value = e.message
  } finally {
    loadingStatement.value = null
  }
}

function print() {
  window.print()
}

async function emailStatement() {
  emailing.value = true
  error.value  = null
  try {
    const res = await apiFetch(`/api/admin/house-accounts/${id}`, {
      method: 'POST', body: { action: 'email_statement', from: statement.value.periodStart, to: statement.value.periodEnd },
    })
    snackbar.show(`Statement emailed to ${res.to}`)
  } catch (e) {
    error.value = e.message
  } finally {
    emailing.value = false
  }
}

function openEdit() {
  editing.value = { limitCents: account.value.creditLimitCents, status: account.value.status, busy: false, error: null }
  editOpen.value = true
}

async function saveEdit() {
  const e = editing.value
  if (!e || e.busy) return
  e.busy = true
  e.error = null
  try {
    await apiFetch(`/api/admin/house-accounts/${id}`, {
      method: 'PUT', body: { creditLimitCents: e.limitCents ?? 0, status: e.status },
    })
    editOpen.value = false
    snackbar.show('Account updated')
    await load()
  } catch (err) {
    e.error = err.message
  } finally {
    e.busy = false
  }
}

async function resetPin() {
  const ok = await confirm({
    title: 'Clear this PIN?',
    message: `${memberName.value} sets a new one in My Account before charging again.`,
    confirmLabel: 'Clear PIN',
    destructive: true,
  })
  if (!ok) return
  error.value = null
  resettingPin.value = true
  try {
    await apiFetch(`/api/admin/house-accounts/${id}`, { method: 'PUT', body: { resetPin: true } })
    snackbar.show('PIN cleared. The member can set a new one in My Account.')
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    resettingPin.value = false
  }
}

function openAdjust() {
  adjusting.value = { amountCents: null, kind: 'credit', reason: '', busy: false, error: null }
  adjustOpen.value = true
}

async function saveAdjustment() {
  const a = adjusting.value
  if (!a || a.busy || !a.amountCents || !a.reason.trim()) return
  a.busy = true
  a.error = null
  try {
    await apiFetch(`/api/admin/house-accounts/${id}`, {
      method: 'POST', body: { action: 'adjust', amountCents: a.kind === 'credit' ? -a.amountCents : a.amountCents, reason: a.reason },
    })
    adjustOpen.value = false
    snackbar.show(a.kind === 'credit' ? `Credited ${money(a.amountCents)}` : `Charged ${money(a.amountCents)}`)
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
