<template>
  <div class="space-y-4">
    <div v-for="g in groups" :key="g.title">
      <h3 class="text-title-m text-on-surface mb-2">{{ g.title }}</h3>
      <div class="flex flex-wrap gap-2">
        <AppButton v-for="p in g.items" :key="p.key" variant="outlined" :data-open="p.key" @click="open(p.key)">
          {{ p.label }}
        </AppButton>
      </div>
    </div>
    <p class="text-body-m text-on-surface-variant" aria-live="polite">Last event: {{ lastEvent || '—' }}</p>

    <TenderModal v-if="showing?.startsWith('tender')" v-bind="tenderProps" @complete="e => log('complete', e)" @close="log('close')" />

    <CardPaymentModal
      v-if="showing?.startsWith('card-')"
      :key="showing"
      :initial="checkouts[showing]"
      :cash-cents="showing === 'card-waiting' ? 1500 : 0"
      @done="e => log('done', e)"
      @canceled="log('canceled')"
      @pay-cash="e => log('pay-cash', e)"
    />

    <ApprovalModal
      v-if="showing === 'approval' || showing === 'approval-none'"
      :key="showing"
      action="REFUND"
      title="Refund $32.40 on sale #1042"
      register-id="reg1"
      @approved="e => log('approved', e)"
      @cancel="log('cancel')"
    />

    <RefundModal
      v-if="showing === 'refund' || showing === 'void' || showing === 'refund-error'"
      :key="showing"
      :sale="showing === 'void' ? sale : splitSale"
      :mode="showing === 'void' ? 'void' : 'refund'"
      :error="showing === 'refund-error' ? 'The cash drawer is closed. Open it to refund cash.' : null"
      @submit="e => log('submit', e)"
      @cancel="log('cancel')"
    />

    <CashMovementModal
      v-if="['PAID_IN', 'PAID_OUT', 'SAFE_DROP'].includes(showing)"
      :key="showing"
      :type="showing"
      @submit="e => log('submit', e)"
      @cancel="log('cancel')"
    />

    <AccountPaymentModal
      v-if="showing?.startsWith('account-')"
      :key="showing"
      register-id="reg1"
      :customer="showing === 'account-customer' ? members[0] : null"
      :card-blocked="null"
      @done="e => log('done', e)"
      @card="e => log('card', e)"
      @close="e => log('close', e)"
    />
  </div>
</template>

<script>
export default {
  galleryTitle: 'POS dialogs (preview)',
  galleryNote: 'Register dialogs in their states with mocked /api/staff responses (fetch is stubbed while this section is mounted). ?open=<key> opens one on load (keys are the buttons\' data-open). Approval PIN 1234 approves; anything else fails.',
}
</script>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import TenderModal from '@/components/pos/TenderModal.vue'
import CardPaymentModal from '@/components/pos/CardPaymentModal.vue'
import ApprovalModal from '@/components/pos/ApprovalModal.vue'
import RefundModal from '@/components/pos/RefundModal.vue'
import CashMovementModal from '@/components/pos/CashMovementModal.vue'
import AccountPaymentModal from '@/components/pos/AccountPaymentModal.vue'

const groups = [
  { title: 'Tender', items: [
    { key: 'tender-cash', label: 'Cash' },
    { key: 'tender-drawer-closed', label: 'Drawer closed' },
    { key: 'tender-offline', label: 'Reader offline' },
    { key: 'tender-split', label: 'Split' },
    { key: 'tender-account', label: 'House account' },
    { key: 'tender-email', label: 'Email receipt + error' },
    { key: 'tender-zero', label: '$0 (check-in)' },
  ] },
  { title: 'Card payment', items: [
    { key: 'card-waiting', label: 'Waiting' },
    { key: 'card-saving', label: 'Approved, saving' },
    { key: 'card-declined', label: 'Declined' },
    { key: 'card-charged', label: 'Charged, not saved' },
    { key: 'card-canceled', label: 'Cancelled' },
  ] },
  { title: 'Approval, refund, drawer, account', items: [
    { key: 'approval', label: 'Manager approval' },
    { key: 'approval-none', label: 'Approval: no managers' },
    { key: 'refund', label: 'Refund (card + cash)' },
    { key: 'refund-error', label: 'Refund with error' },
    { key: 'void', label: 'Void' },
    { key: 'PAID_IN', label: 'Paid in' },
    { key: 'PAID_OUT', label: 'Paid out' },
    { key: 'SAFE_DROP', label: 'Safe drop' },
    { key: 'account-search', label: 'Account payment' },
    { key: 'account-customer', label: 'Account payment (member attached)' },
  ] },
]

const showing = ref(null)
const lastEvent = ref('')
function open(key) {
  showing.value = null
  delete live[key]
  setTimeout(() => { showing.value = key })
}
function log(name, payload) {
  lastEvent.value = `${name}${payload ? ` ${JSON.stringify(payload).slice(0, 200)}` : ''}`
  if (name !== 'submit' || showing.value !== 'refund-error') showing.value = null
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const account = { id: 'ha1', status: 'ACTIVE', hasPin: true, pinLocked: false, availableCents: 48500, balanceCents: 1500 }
const TENDER = {
  'tender-cash': { totalCents: 4237, cardBlocked: null, readerOnline: true },
  'tender-drawer-closed': { totalCents: 4237, cardBlocked: null, drawerOpen: false },
  'tender-offline': { totalCents: 4237, cardBlocked: null, readerOnline: false, account, accountName: 'Pat Member' },
  'tender-split': { totalCents: 8650, cardBlocked: null, initialMethod: 'SPLIT' },
  'tender-account': { totalCents: 4237, cardBlocked: null, account, accountName: 'Pat Member', initialMethod: 'ACCOUNT' },
  'tender-email': { totalCents: 4237, cardBlocked: null, defaultEmail: 'pat@example.com', error: 'A price changed since this sale started. The cart has been refreshed: check it and charge again.' },
  'tender-zero': { totalCents: 0, cardBlocked: null },
}
const tenderProps = computed(() => TENDER[showing.value] ?? TENDER['tender-cash'])

const base = { amountCents: 4237, tipping: true, testMode: true, lastError: null }
const checkouts = {
  'card-waiting': { ...base, id: 'card-waiting', status: 'PENDING' },
  'card-saving': { ...base, id: 'card-saving', status: 'COMPLETING' },
  'card-declined': { ...base, id: 'card-declined', status: 'PENDING', lastError: 'Your card has insufficient funds.' },
  'card-charged': { ...base, id: 'card-charged', status: 'SUCCEEDED', lastError: 'The card was charged but the sale didn\'t save: network error. Press "Save" to try again.' },
  'card-canceled': { ...base, id: 'card-canceled', status: 'CANCELED' },
}
const live = {} // the stubbed server's view of each checkout

const line = (id, description, quantity, unitCents, refundedQuantity = 0) => {
  const totalCents = quantity * unitCents
  const taxCents = Math.round(totalCents * 0.0925)
  return {
    id, description, quantity, refundedQuantity, totalCents: totalCents + taxCents, taxCents,
    refundedCents: Math.round(((totalCents + taxCents) * refundedQuantity) / quantity),
    refundedTaxCents: Math.round((taxCents * refundedQuantity) / quantity),
  }
}
const splitSale = {
  number: 1042,
  items: [
    line('i1', 'Deer Run Polo — L / Navy', 2, 4500, 0),
    line('i2', 'Titleist Pro V1 (dozen)', 1, 5499),
    line('i3', 'Golf glove — Men\'s M', 3, 1800, 1),
  ],
  payments: [{ method: 'CARD_TERMINAL', amountCents: 15000 }, { method: 'CASH', amountCents: 5000 }],
  refunds: [{ method: 'CARD_TERMINAL', amountCents: 1967 }],
}
const sale = { ...splitSale, number: 1043, refunds: [], items: splitSale.items.map(i => ({ ...i, refundedQuantity: 0, refundedCents: 0, refundedTaxCents: 0 })) }

const members = [
  { id: 'u1', name: 'Pat Member', email: 'member@example.com', isMember: true, houseAccount: { id: 'ha1', status: 'ACTIVE', balanceCents: 12850 } },
  { id: 'u2', name: 'Guest Golfer', email: 'guest@example.com', isMember: false, houseAccount: null },
  { id: 'u3', name: 'Closed Account', email: 'closed@example.com', isMember: true, houseAccount: { id: 'ha3', status: 'CLOSED', balanceCents: 0 } },
]

function mock(url, init = {}) {
  const u = new URL(url, location.origin)
  const method = (init.method || 'GET').toUpperCase()
  const body = JSON.parse(init.body || '{}')
  if (u.pathname === '/api/staff/register/managers') {
    return showing.value === 'approval-none' ? { body: [] } : { body: [
      { id: 'm1', firstName: 'Gina', lastName: 'Morrow' },
      { id: 'm2', firstName: 'Pete', lastName: 'Ross' },
      { id: 'm3', firstName: 'Sasha', lastName: 'Long-Hyphenated-Name' },
    ] }
  }
  if (u.pathname === '/api/staff/approvals') {
    return body.pin === '1234' ? { body: { id: 'ap1', action: body.action } } : { status: 401, body: { error: 'Wrong PIN. 4 tries left before the PIN locks.' } }
  }
  if (u.pathname.startsWith('/api/staff/card-checkouts/')) {
    const id = u.pathname.split('/').pop()
    const c = (live[id] ??= { ...checkouts[id] })
    if (method === 'POST') {
      if (body.action === 'cancel') Object.assign(c, { status: 'CANCELED', lastError: null })
      else if (body.action === 'retry') c.lastError = null
      else if (body.action === 'simulate' && body.decline) c.lastError = 'The card was declined (simulated).'
      else if (body.action === 'simulate' || body.action === 'complete') {
        Object.assign(c, { status: 'COMPLETED', lastError: null })
        return { body: { cardCheckout: c, sale: { id: 's1', number: 1044 } } }
      }
    }
    return { body: { cardCheckout: c } }
  }
  if (u.pathname === '/api/staff/register/customers') {
    const q = (u.searchParams.get('search') || '').toLowerCase()
    return { body: members.filter(m => `${m.name} ${m.email}`.toLowerCase().includes(q)) }
  }
  if (u.pathname === '/api/staff/account-payments') {
    if (body.method === 'CARD') return { body: { cardCheckout: { ...base, id: 'card-waiting', status: 'PENDING', amountCents: body.amountCents } } }
    return { body: { accountPayment: { id: 'p1', amountCents: body.amountCents }, changeCents: body.tenderedCents - body.amountCents } }
  }
  return null
}

const realFetch = window.fetch
onMounted(() => {
  window.fetch = async (url, init) => {
    const result = typeof url === 'string' && url.startsWith('/api/staff/') ? mock(url, init) : null
    if (!result) return realFetch(url, init)
    await new Promise(r => setTimeout(r, 300))
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  }
  const initial = new URLSearchParams(location.search).get('open')
  if (initial) open(initial)
})
onBeforeUnmount(() => { window.fetch = realFetch })
</script>
