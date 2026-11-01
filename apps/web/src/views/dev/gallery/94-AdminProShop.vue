<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2" role="group" aria-label="Preview page">
      <button
        v-for="p in pages"
        :key="p.key"
        type="button"
        :class="[
          'state-layer h-8 px-3 rounded-shape-sm border text-label-l cursor-pointer',
          current.key === p.key ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-on-surface-variant',
        ]"
        @click="show(p)"
      >
        {{ p.meta.title }}
      </button>
    </div>

    <!-- transform contains the shell's fixed/sticky parts; dialogs still teleport to <body> -->
    <div class="shell-box relative overflow-hidden rounded-shape-md border border-outline-variant" style="transform: translateZ(0)">
      <div class="h-full overflow-y-auto">
        <AdminLayout v-if="ready">
          <component :is="current.component" :key="current.key" />
        </AdminLayout>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Admin Pro Shop pages (preview)',
  galleryNote: 'Products, Sales, Registers and House Accounts with fake data: /api/admin/* is answered in the browser. ?section=adminproshop&page=sales picks a page.',
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef } from 'vue'
import { routeLocationKey } from 'vue-router'
import AdminLayout from '@/views/admin/AdminLayout.vue'
import ProductsView from '@/views/admin/ProductsView.vue'
import SalesView from '@/views/admin/SalesView.vue'
import RegistersView from '@/views/admin/RegistersView.vue'
import HouseAccountsView from '@/views/admin/HouseAccountsView.vue'
import HouseAccountDetailView from '@/views/admin/HouseAccountDetailView.vue'
import { useAuthStore } from '@/stores/auth'
import { localDate, addDays } from '@/lib/timeclock'

const pages = [
  { key: 'products', path: '/admin/products', component: ProductsView, meta: { title: 'Products & Inventory' } },
  { key: 'sales', path: '/admin/sales', component: SalesView, meta: { title: 'Sales & Reports' } },
  { key: 'registers', path: '/admin/registers', component: RegistersView, meta: { title: 'Registers' } },
  { key: 'accounts', path: '/admin/house-accounts', component: HouseAccountsView, meta: { title: 'House Accounts' } },
  {
    key: 'account',
    path: '/admin/house-accounts/ha1',
    params: { id: 'ha1' },
    component: HouseAccountDetailView,
    meta: { title: 'House Account', breadcrumbs: [{ label: 'House Accounts', to: '/admin/house-accounts' }] },
  },
]
const initial = pages.find(p => p.key === new URLSearchParams(location.search).get('page')) ?? pages[0]
const current = shallowRef(initial)

// The views and the shell read the route with useRoute(); give them a fake one
const fakeRoute = reactive({ path: initial.path, fullPath: initial.path, meta: initial.meta, params: initial.params ?? {}, query: {}, hash: '', matched: [] })
provide(routeLocationKey, fakeRoute)
function show(p) {
  Object.assign(fakeRoute, { path: p.path, fullPath: p.path, meta: p.meta, params: p.params ?? {} })
  current.value = p
}

// ── Fake data ──
const today = localDate()
const iso = (daysAgo, hhmm) => new Date(`${addDays(today, -daysAgo)}T${hhmm}:00-05:00`).toISOString()
const person = (firstName, lastName) => ({ firstName, lastName })

const categories = [
  { id: 'c1', name: 'Apparel', sortOrder: 10, taxExempt: false, memberDiscount: true, active: true, productCount: 3 },
  { id: 'c2', name: 'Golf Balls', sortOrder: 20, taxExempt: false, memberDiscount: true, active: true, productCount: 2 },
  { id: 'c3', name: 'Green Fees', sortOrder: 30, taxExempt: true, memberDiscount: false, active: true, productCount: 1 },
  { id: 'c4', name: 'Snacks', sortOrder: 40, taxExempt: false, memberDiscount: false, active: false, productCount: 0 },
]
const v = (id, size, color, stockQty, extra = {}) => ({ id, size, color, sku: null, barcode: null, priceCents: null, memberPriceCents: null, stockQty, active: true, ...extra })
const products = [
  { id: 'p1', categoryId: 'c1', name: 'Deer Run Polo', description: 'Moisture-wicking, embroidered logo', priceCents: 5500, memberPriceCents: null, trackInventory: true, active: true,
    variants: [v('v1', 'S', 'Navy', 4), v('v2', 'M', 'Navy', 0), v('v3', 'L', 'Navy', 7), v('v4', 'XL', 'Navy', 3)] },
  { id: 'p2', categoryId: 'c1', name: 'Rope Cap', description: '', priceCents: 2800, memberPriceCents: 2400, trackInventory: true, active: true, variants: [v('v5', '', '', 12, { sku: 'CAP-ROPE' })] },
  { id: 'p3', categoryId: 'c1', name: 'Quarter-Zip Pullover (2024)', description: 'Last season', priceCents: 7200, memberPriceCents: null, trackInventory: true, active: false, variants: [v('v6', 'M', 'Gray', 0), v('v7', 'L', 'Gray', 0)] },
  { id: 'p4', categoryId: 'c2', name: 'Pro V1 (dozen)', description: '', priceCents: 5499, memberPriceCents: null, trackInventory: true, active: true, variants: [v('v8', '', '', 18, { sku: 'PV1-12' })] },
  { id: 'p5', categoryId: 'c2', name: 'Range Bucket (large)', description: '', priceCents: 1000, memberPriceCents: null, trackInventory: false, active: true, variants: [v('v9', '', '', 0)] },
  { id: 'p6', categoryId: 'c3', name: 'Annual Membership', description: '12 months, Full tier', priceCents: 185000, memberPriceCents: null, trackInventory: false, active: true, membershipMonths: 12, membershipTier: 'Full', variants: [v('v10', '', '', 0)] },
].map(p => ({ ...p, totalStock: p.variants.reduce((s, x) => s + x.stockQty, 0) }))

const registers = [
  { id: 'r1', name: 'Pro Shop', stripeReaderId: 'tmr_FAKE001', active: true },
  { id: 'r2', name: 'Grill', stripeReaderId: 'tmr_FAKE002', active: true },
  { id: 'r3', name: 'Cart Barn', stripeReaderId: null, active: false },
]
const readers = { configured: true, testMode: true, readers: [
  { id: 'tmr_FAKE001', label: 'Pro Shop WisePOS E', status: 'online', simulated: true },
  { id: 'tmr_FAKE002', label: 'Grill S700', status: 'offline', simulated: false },
] }

const cashiers = [person('Shelby', 'Tate'), person('Marcus', 'Reed')]
const customers = [null, { name: 'Jane Member', email: 'member@example.com' }, null, { name: 'Bob Guest', email: 'guest@example.com' }]
const statuses = ['COMPLETED', 'COMPLETED', 'PARTIALLY_REFUNDED', 'COMPLETED', 'VOIDED', 'COMPLETED', 'REFUNDED']
const methods = [['CARD_TERMINAL'], ['CASH'], ['HOUSE_ACCOUNT'], ['CASH', 'CARD_TERMINAL'], ['PREPAID_ONLINE']]
const sales = Array.from({ length: 12 }, (_, i) => ({
  id: `s${i}`,
  number: 1042 - i,
  status: statuses[i % statuses.length],
  isMemberPricing: i % 4 === 1,
  subtotalCents: 2500 + i * 1375,
  discountCents: 0,
  taxCents: Math.round((2500 + i * 1375) * 0.09),
  totalCents: Math.round((2500 + i * 1375) * 1.09) + (i === 3 ? 120000 : 0),
  refundedCents: statuses[i % statuses.length] === 'PARTIALLY_REFUNDED' ? 1200 : 0,
  createdAt: iso(0, `${String(16 - i).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`),
  register: registers[i % 2],
  cashier: cashiers[i % 2],
  customer: customers[i % 4],
  payments: methods[i % methods.length].map((method, j) => ({ id: `pay${i}${j}`, method, amountCents: 1000, tipCents: 0 })),
}))
const saleDetail = (s) => ({
  ...s,
  receiptEmail: null,
  changeCents: 0,
  items: [
    { id: 'i1', quantity: 2, description: 'Pro V1 (dozen)', unitPriceCents: 5499, discountCents: 0, memberDiscountCents: 0, taxRateBps: 900 },
    { id: 'i2', quantity: 1, description: 'Rope Cap', unitPriceCents: 2800, discountCents: 280, memberDiscountCents: 280, taxRateBps: 900 },
  ],
  refunds: s.refundedCents ? [{ id: 'rf1', kind: 'REFUND', amountCents: s.refundedCents, reason: 'Wrong size', createdAt: iso(0, '17:10'), cashier: cashiers[0], approval: { approver: person('Gina', 'Manager') }, restocked: true }] : [],
})

const drawerSessions = [
  { id: 'd1', register: registers[0], openedAt: iso(0, '07:02'), openedBy: cashiers[0], closedAt: null, openingFloatCents: 20000, cashSalesCents: 48250, cashRefundsCents: 1200, paidInCents: 0, paidOutCents: 2500, safeDropCents: 30000, expectedCents: 34550, countedCents: null, overShortCents: null, movements: [] },
  { id: 'd2', register: registers[1], openedAt: iso(1, '10:30'), openedBy: cashiers[1], closedAt: iso(1, '19:05'), closedBy: cashiers[1], openingFloatCents: 15000, cashSalesCents: 21075, cashRefundsCents: 0, paidInCents: 1000, paidOutCents: 0, safeDropCents: 0, expectedCents: 37075, countedCents: 37000, overShortCents: -75, closeNote: 'Short a quarter roll', movements: [] },
]

const report = () => ({
  from: today, to: today, register: null,
  net: { salesCents: 312450, taxCents: 28120, totalCents: 340570 },
  sales: { count: 64, grossCents: 330000, discountCents: 9550, noChargeCount: 3 },
  returns: { voidCount: 1, voidCents: 4000, voidTaxCents: 330, refundCount: 2, refundCents: 4400, refundTaxCents: 360 },
  cashExpectedCents: 68125, drawerCashCents: 35625, noSaleCount: 2,
  tenders: [
    { method: 'CARD_TERMINAL', label: 'Card', count: 41, collectedCents: 241000, refundedCents: 2400, netCents: 238600 },
    { method: 'CASH', label: 'Cash', count: 18, collectedCents: 69325, refundedCents: 1200, netCents: 68125 },
    { method: 'HOUSE_ACCOUNT', label: 'House account', count: 5, collectedCents: 33845, refundedCents: 0, netCents: 33845 },
  ],
  cardTips: { count: 6, totalCents: 4200 },
  categories: [
    { name: 'Green Fees', quantity: 52, refundedQuantity: 0, salesCents: 182000, refundCents: 0, netCents: 182000, netTaxCents: 0 },
    { name: 'Apparel', quantity: 14, refundedQuantity: 1, salesCents: 81200, refundCents: 2800, netCents: 78400, netTaxCents: 7056 },
    { name: 'Golf Balls', quantity: 9, refundedQuantity: 0, salesCents: 49491, refundCents: 0, netCents: 49491, netTaxCents: 4454 },
  ],
  accountPayments: { rows: [{ method: 'CASH', label: 'Cash', count: 1, amountCents: 15000 }], totalCents: 15000 },
  cashMovements: { rows: [{ id: 'm1', type: 'PAID_OUT', createdAt: iso(0, '12:15'), reason: 'Ice delivery', recipient: 'Lawrence Ice Co.', employee: cashiers[0], approval: { approver: person('Gina', 'Manager') }, amountCents: 2500 }],
    paidInCount: 0, paidInCents: 0, paidOutCount: 1, paidOutCents: 2500, safeDropCount: 1, safeDropCents: 30000 },
  drawerSessions,
})

const user = (name, email) => ({ id: email, name, email })
const accounts = [
  { id: 'ha1', user: user('Jane Member', 'member@example.com'), balanceCents: 48275, creditLimitCents: 100000, status: 'ACTIVE', autopayEnabled: true, cardBrand: 'visa', cardLast4: '4242', hasPin: true, pinLocked: false },
  { id: 'ha2', user: user('Robert Fairway', 'bob.fairway@example.com'), balanceCents: 132050, creditLimitCents: 100000, status: 'ACTIVE', autopayEnabled: false, hasPin: true, pinLocked: true },
  { id: 'ha3', user: user(null, 'dlong@example.com'), balanceCents: 0, creditLimitCents: 50000, status: 'SUSPENDED', autopayEnabled: false, hasPin: false, pinLocked: false },
  { id: 'ha4', user: user('Pat Green', 'pat@example.com'), balanceCents: 0, creditLimitCents: 25000, status: 'CLOSED', autopayEnabled: false, hasPin: true, pinLocked: false },
]
const entries = [
  { id: 'e1', createdAt: iso(1, '15:20'), type: 'CHARGE', description: 'Receipt #1031 · Pro Shop', amountCents: 6825 },
  { id: 'e2', createdAt: iso(4, '09:05'), type: 'PAYMENT', description: 'Autopay · Visa •••• 4242', amountCents: -41450 },
  { id: 'e3', createdAt: iso(9, '13:40'), type: 'CHARGE', description: 'Receipt #998 · Grill', amountCents: 1850 },
  { id: 'e4', createdAt: iso(12, '11:00'), type: 'ADJUSTMENT', description: 'Waived late tee time charge', amountCents: -2500 },
]
const statements = [
  { id: 'st1', periodStart: `${addDays(today, -32).slice(0, 7)}-01`, periodEnd: addDays(`${today.slice(0, 7)}-01`, -1), closingCents: 41450, status: 'PAID', dueDate: `${today.slice(0, 7)}-20` },
  { id: 'st2', periodStart: `${addDays(today, -62).slice(0, 7)}-01`, periodEnd: addDays(`${addDays(today, -32).slice(0, 7)}-01`, -1), closingCents: 23810, status: 'OPEN', dueDate: addDays(today, -15), reminderSentAt: iso(14, '06:15'), lateFeeAt: iso(14, '06:15') },
]

function route(method, path, url) {
  if (path === '/api/admin/time-off/count') return { pending: 2 }
  // Saves: echo something plausible
  if (method !== 'GET') {
    if (path.startsWith('/api/admin/products')) return { ...products[0], warnings: [] }
    if (path === '/api/admin/house-accounts') return { id: 'ha1' }
    if (path.startsWith('/api/admin/house-accounts/')) return { to: accounts[0].user.email }
    if (path.startsWith('/api/admin/inventory/')) return { stockQty: 9 }
    return {}
  }
  if (path === '/api/admin/settings') return { salesTaxBps: 0 }
  if (path === '/api/admin/product-categories') return categories
  if (path === '/api/admin/products') {
    const q = url.searchParams
    return products.filter(p => (!q.get('categoryId') || p.categoryId === q.get('categoryId'))
      && (q.get('status') === 'all' || !q.get('status') || (q.get('status') === 'active') === p.active)
      && (!q.get('search') || p.name.toLowerCase().includes(q.get('search').toLowerCase())))
  }
  if (path.startsWith('/api/admin/inventory/')) {
    return method === 'POST' ? { stockQty: 9 } : { history: [
      { id: 'h1', quantityChange: 12, stockAfter: 12, reason: 'RECEIVED', note: 'Invoice 4471', createdAt: iso(6, '10:00'), by: 'Gina Manager' },
      { id: 'h2', quantityChange: -1, stockAfter: 11, reason: 'SALE', note: null, createdAt: iso(3, '14:22'), by: null },
      { id: 'h3', quantityChange: -2, stockAfter: 9, reason: 'DAMAGED', note: 'Water damage', createdAt: iso(1, '08:30'), by: 'Shelby Tate' },
    ] }
  }
  if (path === '/api/admin/registers/readers') return readers
  if (path === '/api/admin/registers') return registers
  if (path === '/api/admin/sales') {
    const n = url.searchParams.get('number')
    const rows = n ? sales.filter(s => String(s.number) === n) : sales
    return { sales: rows, total: n ? rows.length : 132, page: Number(url.searchParams.get('page') || 1), limit: 50 }
  }
  if (path === '/api/admin/sales/report') return report()
  if (path.startsWith('/api/admin/sales/')) return saleDetail(sales.find(s => s.id === path.split('/').pop()) ?? sales[0])
  if (path === '/api/admin/drawer-sessions') return { sessions: drawerSessions }
  if (path === '/api/admin/house-accounts') return { accounts, totals: { count: accounts.length, owedCents: accounts.reduce((s, a) => s + a.balanceCents, 0) } }
  if (path.startsWith('/api/admin/house-accounts/')) {
    const account = { ...accounts[0], availableCents: accounts[0].creditLimitCents - accounts[0].balanceCents }
    const from = url.searchParams.get('from')
    return {
      account, entries, statements,
      statement: from ? { periodStart: from, periodEnd: url.searchParams.get('to'), openingCents: 41450, chargesCents: 8675, creditsCents: 43950, closingCents: 6175, entries } : undefined,
    }
  }
  if (path === '/api/admin/users') return { users: [user('Jane Member', 'member@example.com'), user('Joe Golfer', 'joe@example.com')].map(u => ({ ...u, role: 'MEMBER' })), total: 2 }
  return null
}

// Answer /api/admin/* in the browser (plain Vite has no Functions); everything else goes to the real fetch
const realFetch = window.fetch
const ready = ref(false)
const authStore = useAuthStore()
let savedProfile = null
onMounted(() => {
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
    if (!url.pathname.startsWith('/api/admin/')) return realFetch(input, init)
    const body = route((init.method || 'GET').toUpperCase(), url.pathname, url)
    await new Promise(r => setTimeout(r, 250))
    return new Response(JSON.stringify(body ?? {}), { status: body ? 200 : 404, headers: { 'Content-Type': 'application/json' } })
  }
  savedProfile = authStore.profile
  if (!savedProfile) authStore.profile = { email: 'gm@example.com', name: 'Gina Manager', role: 'ADMIN', employee: { active: true } }
  ready.value = true
})
onBeforeUnmount(() => {
  window.fetch = realFetch
  authStore.profile = savedProfile
})
</script>

<style scoped>
.shell-box { height: 900px; }
/* The shell sizes itself to the viewport; in the preview the box is the viewport */
.shell-box :deep(.h-screen) { height: 900px; }
.shell-box :deep(.min-h-screen) { min-height: 900px; }
</style>
