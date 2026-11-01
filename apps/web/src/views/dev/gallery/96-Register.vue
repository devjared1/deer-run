<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-4">
      <SegmentedButton v-model="role" label="Cashier" :options="roleOptions" />
      <SegmentedButton :model-value="drawerState" label="Drawer" :options="drawerOptions" @update:model-value="v => { drawerState = v; version++ }" />
      <SegmentedButton v-model="reader" label="Card reader" :options="readerOptions" />
    </div>
    <p class="text-body-m text-on-surface-variant">
      RegisterView in the staff shell (register mode) with fake /api/staff/* answers. The box is one viewport tall, so
      the cart column fits as it does on the register PC. Type a code (e.g. <code>PV1-12</code>, <code>0001</code>) and
      press Enter anywhere outside a field to try the scanner buffer. URL: <code>&amp;drawer=closed&amp;reader=offline&amp;role=manager</code>
      (<code>&amp;full=1</code> fills the window).
    </p>

    <!-- &full=1 covers the window with the preview (screenshots at device sizes) -->
    <Teleport to="body" :disabled="!full">
      <div
        id="register-preview"
        :class="['register-box overflow-hidden', full ? 'fixed inset-0 z-drawer bg-surface' : 'relative rounded-shape-md border border-outline-variant']"
        style="transform: translateZ(0)"
      >
        <StaffLayout
          v-if="ready"
          :key="`${role}-${reader}-${version}`"
          contained
          register-mode
          preview-path="/staff/register"
          :clock="clock"
        >
          <RegisterView />
        </StaffLayout>
      </div>
    </Teleport>

    <h3 class="font-display text-headline-s text-primary pt-4">Result dialog</h3>
    <p class="text-body-m text-on-surface-variant">The one result dialog for sale complete (with a check-in), refund, drawer close and account payment.</p>
    <div class="flex flex-wrap gap-2">
      <AppButton v-for="r in sampleResults" :key="r.label" variant="tonal" @click="shownResult = r.result">{{ r.label }}</AppButton>
    </div>
    <RegisterResultDialog :result="shownResult" @done="shownResult = null" @print="() => {}" @email="() => {}" @teesheet="shownResult = null" />
  </div>
</template>

<script>
export default {
  galleryTitle: 'Register (preview)',
  galleryNote: 'The POS register with a mocked catalog, drawer, customers and recent sales (fetch is stubbed while this section is mounted). Dev only.',
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import StaffLayout from '@/views/staff/StaffLayout.vue'
import RegisterView from '@/views/staff/RegisterView.vue'
import RegisterResultDialog from '@/components/pos/register/RegisterResultDialog.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import AppButton from '@/components/ui/AppButton.vue'

const params = new URLSearchParams(location.search)
const pick = (name, options, fallback) => (options.some(o => o.value === params.get(name)) ? params.get(name) : fallback)

const roleOptions = [{ value: 'cashier', label: 'Cashier' }, { value: 'manager', label: 'Manager' }]
const drawerOptions = [{ value: 'open', label: 'Drawer open' }, { value: 'closed', label: 'Closed' }]
const readerOptions = [
  { value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' },
  { value: 'unknown', label: 'Unknown' }, { value: 'none', label: 'No reader' },
]
const full = params.get('full') === '1'
const role = ref(pick('role', roleOptions, 'cashier'))
const drawerState = ref(pick('drawer', drawerOptions, 'open'))
const version = ref(0) // bumped to remount the preview when the drawer toggle changes
const reader = ref(pick('reader', readerOptions, 'online'))

const now = Date.now()
const iso = minutesAgo => new Date(now - minutesAgo * 60000).toISOString()
const clock = { status: 'on', openEntry: { clockIn: iso(192), clockOut: null, breaks: [] }, serverTime: iso(0) }

// ── Fake data ──
const cat = (id, name, extra = {}) => ({ id, name, sortOrder: 0, active: true, taxExempt: false, memberDiscount: false, ...extra })
const categories = [
  cat('c1', 'Green Fees', { taxExempt: true }), cat('c2', 'Carts', { taxExempt: true }), cat('c3', 'Golf Balls', { memberDiscount: true }),
  cat('c4', 'Apparel', { memberDiscount: true }), cat('c5', 'Headwear', { memberDiscount: true }), cat('c6', 'Gloves', { memberDiscount: true }),
  cat('c7', 'Snacks'), cat('c8', 'Drinks'), cat('c9', 'Grill'), cat('c10', 'Range'), cat('c11', 'Rentals'), cat('c12', 'Memberships', { taxExempt: true }),
]
let vid = 0
const variant = (extra = {}) => ({ id: `v${++vid}`, size: null, color: null, sku: null, barcode: null, priceCents: null, memberPriceCents: null, stockQty: 10, active: true, sortOrder: vid, ...extra })
const product = (id, categoryId, name, priceCents, variants = [variant()], extra = {}) => ({
  id, categoryId, name, priceCents, memberPriceCents: null, trackInventory: false, sortOrder: 0, membershipMonths: null, membershipTier: null, variants, ...extra,
})
const products = [
  product('p1', 'c1', '18 holes walking', 4500, [variant({ barcode: '0001' })], { memberPriceCents: 0 }),
  product('p2', 'c1', '9 holes walking', 2800, undefined, { memberPriceCents: 0 }),
  product('p3', 'c1', 'Twilight 18 (after 3 PM)', 3200),
  product('p4', 'c1', 'Junior 18 holes', 2000),
  product('p5', 'c1', 'Senior weekday 18', 3800),
  product('p6', 'c1', 'Replay same day', 1500),
  product('p7', 'c2', 'Cart 18 holes (per rider)', 1800, [variant({ barcode: '0002' })]),
  product('p8', 'c2', 'Cart 9 holes (per rider)', 1000),
  product('p9', 'c2', 'Trail fee (own cart)', 1200),
  product('p10', 'c3', 'Pro V1 (dozen)', 5499, [variant({ sku: 'PV1-12', barcode: '885583123456', stockQty: 14 })], { trackInventory: true }),
  product('p11', 'c3', 'Tour Soft (dozen)', 2499, [variant({ sku: 'TS-12', stockQty: 0 })], { trackInventory: true }),
  product('p12', 'c3', 'Sleeve of 3 balls', 1499, [variant({ sku: 'SLV-3', stockQty: 22 })], { trackInventory: true }),
  product('p13', 'c4', 'Deer Run Polo', 5500, ['S', 'M', 'L', 'XL', 'XXL'].map((size, i) => variant({ size, color: 'Navy', stockQty: i === 1 ? 0 : 4 })), { trackInventory: true }),
  product('p14', 'c4', 'Quarter-Zip Pullover', 7200, ['M', 'L', 'XL'].map(size => variant({ size, color: 'Gray' })), { trackInventory: true }),
  product('p15', 'c5', 'Rope Cap', 2800, [variant({ sku: 'CAP-ROPE' })], { memberPriceCents: 2400 }),
  product('p16', 'c6', 'Leather Glove', 1999, ['ML', 'L', 'XL'].map(size => variant({ size }))),
  product('p17', 'c7', 'Peanut Butter Crackers', 150),
  product('p18', 'c8', 'Bottled Water', 200, [variant({ barcode: '0003' })]),
  product('p19', 'c8', 'Gatorade', 300),
  product('p20', 'c9', 'Hot Dog', 450),
  product('p21', 'c10', 'Range Bucket (large)', 1000),
  product('p22', 'c11', 'Club Rental Set', 3000),
  product('p23', 'c12', 'Annual Membership (Full)', 185000, undefined, { membershipMonths: 12, membershipTier: 'Full' }),
]

const customers = [
  { id: 'u1', name: 'Jane Member', email: 'member@example.com', role: 'MEMBER', isMember: true, membershipTier: 'Full', memberUntil: '2027-04-30', houseAccount: { id: 'ha1', status: 'ACTIVE', balanceCents: 48275, creditLimitCents: 100000, hasPin: true } },
  { id: 'u2', name: 'Bob Guest', email: 'guest@example.com', role: 'GUEST', isMember: false, houseAccount: null },
  { id: 'u3', name: 'Ray Lapsed', email: 'ray@example.com', role: 'MEMBER', isMember: false, membershipTier: 'Weekday', houseAccount: null },
]

const person = (firstName) => ({ firstName, lastName: '' })
const sales = Array.from({ length: 8 }, (_, i) => ({
  id: `s${i}`, number: 1042 - i, status: ['COMPLETED', 'COMPLETED', 'PARTIALLY_REFUNDED', 'COMPLETED', 'VOIDED'][i % 5],
  createdAt: iso(12 + i * 37), totalCents: 2500 + i * 1375, customer: i % 3 === 1 ? customers[0] : null,
}))
const saleDetail = s => ({
  ...s, register: { name: 'Pro Shop' }, cashier: person('Shelby'), taxCents: 225, refundedCents: s.status === 'PARTIALLY_REFUNDED' ? 1200 : 0,
  payments: [{ method: 'CASH', amountCents: s.totalCents }],
  items: [
    { id: 'i1', quantity: 2, description: 'Pro V1 (dozen)', unitPriceCents: 5499, discountCents: 0, memberDiscountCents: 0, taxRateBps: 900, subtotalCents: 10998, totalCents: 10998 },
    { id: 'i2', quantity: 1, description: 'Rope Cap', unitPriceCents: 2800, discountCents: 0, memberDiscountCents: 0, taxRateBps: 900, subtotalCents: 2800, totalCents: 2800, refundedQuantity: s.status === 'PARTIALLY_REFUNDED' ? 1 : 0 },
  ],
  refunds: s.status === 'PARTIALLY_REFUNDED' ? [{ id: 'r1', kind: 'REFUND', amountCents: 1200, createdAt: iso(5), reason: 'Wrong size', approval: { approver: person('Gina') } }] : [],
})

function drawerResponse() {
  const manager = role.value === 'manager'
  return {
    session: drawerState.value === 'open'
      ? { id: 'd1', openedAt: iso(300), openedBy: person('Shelby'), openingFloatCents: 20000, movements: [{ id: 'm1' }], ...(manager ? { expectedCents: 48550 } : {}) }
      : null,
    last: { openingFloatCents: 20000 },
  }
}

function route(method, path, url, body) {
  if (path === '/api/staff/register/catalog') {
    return {
      salesTaxBps: 900, categories, products, cardTestMode: true, isRegisterManager: role.value === 'manager',
      registers: [
        { id: 'preview-r1', name: 'Pro Shop', hasCardReader: reader.value !== 'none', ...(['online', 'offline'].includes(reader.value) ? { readerStatus: reader.value } : {}) },
        { id: 'preview-r2', name: 'Grill', hasCardReader: false },
      ],
    }
  }
  if (path === '/api/staff/register/drawer') {
    if (method === 'GET') return drawerResponse()
    if (body?.action === 'open') { drawerState.value = 'open'; return {} }
    if (body?.action === 'close') {
      return { session: { id: 'd1', openingFloatCents: 20000, cashSalesCents: 31250, cashRefundsCents: 1200, paidInCents: 0, paidOutCents: 2500, safeDropCents: 0, expectedCents: 47550, countedCents: body.countedCents, overShortCents: body.countedCents - 47550, closedAt: iso(0), openedAt: iso(300) } }
    }
    return {}
  }
  if (path === '/api/staff/register/customers') {
    const q = (url.searchParams.get('search') || '').toLowerCase()
    return customers.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(q))
  }
  if (path === '/api/staff/register/managers') return [{ id: 'e1', firstName: 'Gina', lastName: 'Manager' }]
  if (path === '/api/staff/approvals') return { approvalId: 'ap1', approverName: 'Gina Manager' }
  if (path === '/api/staff/sales' && method === 'GET') {
    const n = url.searchParams.get('number')
    return n ? sales.filter(s => String(s.number) === n) : sales
  }
  if (path.startsWith('/api/staff/sales/')) return saleDetail(sales.find(s => s.id === path.split('/').pop()) ?? sales[0])
  return null
}

const sampleResults = [
  { label: 'Sale complete (check-in)', result: { kind: 'sale', sale: { id: 's1', number: 1043, changeCents: 550, totalCents: 4450 }, warnings: [], membershipUntil: null, emailedTo: null, emailError: null, sending: false, checkIn: true } },
  { label: 'Refund (cash)', result: { kind: 'refund', sale: { number: 1038 }, refund: { kind: 'REFUND', method: 'CASH', amountCents: 2800 }, warnings: [], memberUntil: null } },
  { label: 'Drawer closed (short)', result: { kind: 'drawer', session: { overShortCents: -75, expectedCents: 47550, countedCents: 47475, openingFloatCents: 20000, cashSalesCents: 31250, cashRefundsCents: 1200, paidOutCents: 2500 } } },
  { label: 'Account payment', result: { kind: 'accountPayment', payment: { amountCents: -15000, balanceCents: 33275 }, changeCents: 0, memberName: 'Jane Member' } },
]
const shownResult = ref(null)

// Dev-only: a fake signed-in register employee, the preview register and the stubbed API; all restored on unmount
const auth = useAuthStore()
const savedProfile = auth.profile
const REGISTER_KEY = 'deerrun.registerId'
let savedRegister = null
const realFetch = window.fetch
const ready = ref(false)

function setProfile() {
  const manager = role.value === 'manager'
  auth.profile = {
    id: 'preview', email: 'preview@example.com', role: 'GUEST',
    canUseRegister: true, canTrackCourse: true, isRegisterManager: manager,
    employee: { id: 'preview-employee', firstName: manager ? 'Gina' : 'Shelby', lastName: manager ? 'Manager' : 'Tate', position: manager ? 'GENERAL_MANAGER' : 'PRO_SHOP_ATTENDANT', active: true },
  }
}

onMounted(() => {
  try { savedRegister = localStorage.getItem(REGISTER_KEY); localStorage.setItem(REGISTER_KEY, 'preview-r1') } catch { /* private mode */ }
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
    if (!url.pathname.startsWith('/api/staff/')) return realFetch(input, init)
    const method = (init.method || 'GET').toUpperCase()
    const result = route(method, url.pathname, url, init.body ? JSON.parse(init.body) : null)
    await new Promise(r => setTimeout(r, 200))
    return new Response(JSON.stringify(result ?? { error: 'Not in the preview' }), { status: result ? 200 : 404, headers: { 'Content-Type': 'application/json' } })
  }
  setProfile()
  ready.value = true
})

watch(role, setProfile)

onBeforeUnmount(() => {
  window.fetch = realFetch
  auth.profile = savedProfile
  try {
    if (savedRegister) localStorage.setItem(REGISTER_KEY, savedRegister)
    else localStorage.removeItem(REGISTER_KEY)
  } catch { /* private mode */ }
})
</script>

<style scoped>
/* One viewport tall: the register sizes its columns to 100dvh minus the 64px top bar */
.register-box { height: 100dvh; }
.register-box :deep(.min-h-screen) { min-height: 100dvh; }
</style>
