<template>
  <div>
    <!-- Everything on screen is print-hidden: only the current slip (below) prints -->
    <div class="print:hidden md:h-[calc(100dvh-4rem)]">
      <!-- Loading -->
      <div
        v-if="loading && !catalog"
        class="h-full md:grid md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <div class="p-4 space-y-4">
          <Skeleton variant="rect" height="56px" label="Loading the register" />
          <div class="flex gap-2">
            <Skeleton v-for="n in 4" :key="n" variant="rect" width="96px" height="48px" />
          </div>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
            <Skeleton v-for="n in 12" :key="n" variant="rect" height="96px" />
          </div>
        </div>
        <div class="hidden md:block bg-surface-container-low border-l border-outline-variant p-4">
          <Skeleton variant="text" :lines="8" />
        </div>
      </div>

      <div v-else-if="loadError && !catalog" class="p-4 md:p-8 max-w-xl">
        <ErrorBanner :message="loadError" title="Couldn't load the register" :retrying="loading" @retry="loadCatalog" />
      </div>

      <!-- Which register is this PC? -->
      <div v-else-if="catalog && !register" class="p-4 md:p-8">
        <div class="max-w-md rounded-shape-lg bg-surface-container-low border border-outline-variant p-6">
          <h2 class="font-display text-headline-s text-on-surface mb-1">Which register is this?</h2>
          <p class="text-body-m text-on-surface-variant mb-4">This is saved on this computer, so you only choose once.</p>
          <ul v-if="catalog.registers.length" class="space-y-2">
            <li v-for="r in catalog.registers" :key="r.id">
              <button
                type="button"
                class="state-layer w-full min-h-16 flex items-center gap-4 px-4 rounded-shape-md border border-outline-variant bg-surface-container-lowest text-left text-title-m text-on-surface cursor-pointer"
                @click="chooseRegister(r.id)"
              >
                <IconStore class="w-6 h-6 flex-none text-on-surface-variant" aria-hidden="true" />
                <span class="flex-1 min-w-0 truncate">{{ r.name }}</span>
                <IconChevron class="w-6 h-6 flex-none text-on-surface-variant" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <EmptyState
            v-else
            compact
            :icon="IconStore"
            title="No registers yet"
            message="An admin can add one in Admin → Registers."
          />
        </div>
      </div>

      <!-- The register: products | cart (side by side from md, each scrolling on its own; stacked on phones) -->
      <div
        v-else-if="catalog"
        class="md:h-full md:grid md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <RegisterProducts
          ref="productsRef"
          v-model:active-category-id="activeCategoryId"
          class="md:h-full"
          :search="search"
          :categories="catalog.categories"
          :products="visibleProducts"
          :price-label="productPriceLabel"
          :is-out-of-stock="isOutOfStock"
          :message="scanMessage"
          @update:search="v => { search = v; scanMessage = null }"
          @enter="onSearchEnter"
          @choose="chooseProduct"
          @custom="customItem = true"
        />
        <RegisterCart
          class="md:h-full border-t md:border-t-0 md:border-l border-outline-variant"
          :register-name="register.name"
          :lines="pricedLines"
          :totals="totals"
          :member-discount-total="memberDiscountTotal"
          :sales-tax-bps="catalog.salesTaxBps"
          :customer="customer"
          :is-member="isMember"
          :drawer="drawer"
          :has-card-reader="!!register.hasCardReader"
          :reader-online="readerOnline"
          :is-manager="authStore.isRegisterManager"
          :highlight-key="highlightLineKey"
          :needs-customer="needsCustomerForMembership"
          :error="registerError"
          @recent-sales="openRecentSales()"
          @no-sale="noSale"
          @account-payment="showAccountPayment = true"
          @end-of-day="printZReport"
          @change-register="changeRegister"
          @open-drawer="openDrawerForm()"
          @close-drawer="closeDrawerForm"
          @cash-movement="startCashMovement"
          @attach-customer="showCustomerPicker = true"
          @remove-customer="customer = null; focusSearch()"
          @change-qty="changeQty"
          @discount="openDiscount"
          @remove-line="removeLine"
          @clear="clearSale"
          @charge="openTender()"
          @dismiss-error="registerError = null"
        />
      </div>
    </div>

    <!-- Only the current slip prints -->
    <div v-if="printDoc" class="hidden print:block">
      <SaleReceipt v-if="printDoc.type === 'sale'" :sale="printDoc.sale" />
      <RefundReceipt v-else-if="printDoc.type === 'refund'" :sale="printDoc.sale" :refund="printDoc.refund" :register-name="register?.name" />
      <NoSaleSlip v-else-if="printDoc.type === 'noSale'" :at="printDoc.at" :register-name="register?.name" :approver-name="printDoc.approverName" />
      <ZReportSlip v-else-if="printDoc.type === 'z'" :report="printDoc.report" />
      <DrawerCloseSlip v-else-if="printDoc.type === 'drawer'" :session="printDoc.session" />
      <DrawerMovementSlip v-else-if="printDoc.type === 'movement'" :movement="printDoc.movement" :register-name="register?.name" />
      <AccountPaymentSlip
        v-else-if="printDoc.type === 'accountPayment'"
        :payment="printDoc.payment"
        :member-name="printDoc.memberName"
        :register-name="register?.name"
        :change-cents="printDoc.changeCents"
      />
    </div>

    <!-- Sale complete / refund done / drawer closed / account payment received -->
    <RegisterResultDialog
      :result="result"
      @print="printResult"
      @done="onResultDone"
      @email="emailCompletedReceipt"
      @teesheet="backToTeeSheet"
    />

    <RecentSalesModal
      v-if="showRecentSales"
      :register-id="registerId"
      :register-name="register?.name"
      :initial-sale-id="recentSaleId"
      @close="showRecentSales = false; focusSearch()"
      @print="s => printDocument({ type: 'sale', sale: s })"
      @void="s => startRefund(s, 'void')"
      @refund="s => startRefund(s, 'refund')"
    />
    <RefundModal
      v-if="refunding"
      :sale="refunding.sale"
      :mode="refunding.mode"
      :busy="refundBusy"
      :error="refundError"
      @submit="submitRefund"
      @cancel="cancelRefund"
    />
    <CashMovementModal
      v-if="cashMovement"
      :type="cashMovement.type"
      :busy="cashMovement.busy"
      :error="cashMovement.error"
      @submit="submitCashMovement"
      @cancel="cashMovement = null; focusSearch()"
    />
    <ApprovalModal
      v-if="approvalRequest"
      :action="approvalRequest.action"
      :title="approvalRequest.title"
      :reason="approvalRequest.reason"
      :register-id="registerId"
      @approved="onApproved"
      @cancel="onApprovalCancel"
    />

    <VariantPickerModal
      v-if="pickingProduct"
      :product="pickingProduct"
      :is-member="isMember"
      @pick="v => { addVariant(pickingProduct, v); pickingProduct = null }"
      @close="pickingProduct = null; focusSearch()"
    />
    <CustomerPickerModal
      v-if="showCustomerPicker"
      @pick="u => { customer = u; showCustomerPicker = false; focusSearch() }"
      @close="showCustomerPicker = false; focusSearch()"
    />
    <TenderModal
      v-if="tendering"
      :total-cents="totals.totalCents"
      :default-email="customer?.email ?? ''"
      :busy="submitting"
      :error="submitError"
      :card-blocked="cardBlocked"
      :account="customer?.houseAccount ?? null"
      :account-name="customer?.name || customer?.email || ''"
      :drawer-open="!!drawer?.session"
      :reader-online="readerOnline"
      :initial-method="tenderMethod || undefined"
      @complete="completeSale"
      @close="tendering = false; focusSearch()"
    />

    <AccountPaymentModal
      v-if="showAccountPayment"
      :register-id="registerId"
      :customer="customer?.houseAccount ? customer : null"
      :card-blocked="cardBlocked"
      @done="onAccountPaymentDone"
      @card="onAccountPaymentCard"
      @close="onAccountPaymentClose"
    />

    <CardPaymentModal
      v-if="cardPayment"
      :initial="cardPayment.checkout"
      :cash-cents="cardPayment.cashCents"
      @done="r => onCardDone(r)"
      @canceled="onCardCanceled"
      @pay-cash="onCardPayCash"
    />

    <DrawerDialog
      v-if="drawerForm"
      :key="drawerForm.mode"
      :mode="drawerForm.mode"
      :initial-cents="drawerForm.initialCents"
      :resume-tender="drawerForm.resumeTender"
      :busy="drawerForm.busy"
      :error="drawerForm.error"
      @submit="submitDrawer"
      @cancel="drawerForm = null; focusSearch()"
    />
    <DiscountDialog
      v-if="discounting"
      :description="discounting.line.description"
      :gross-cents="discounting.gross"
      :current-cents="discounting.line.managerDiscountCents"
      @apply="applyDiscount"
      @cancel="discounting = null; focusSearch()"
    />
    <CustomItemDialog v-if="customItem" @add="addCustomItem" @cancel="customItem = false; focusSearch()" />
  </div>
</template>

<script setup>
// The register (POS). Layout and dialogs live in components/pos/register/*; this view owns the sale, the drawer, the
// approvals and printing. A USB scanner works from the search field (its Enter) or, through useScanner, anywhere
// no field or other dialog has focus, including over "Sale complete" (which then starts the next sale).
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { unitPriceCents, memberDiscountBps, memberDiscountCents, priceLine, saleTotals, variantDescription } from '@/lib/pricing'
import { printReceipt } from '@/lib/printReceipt'
import { useAuthStore } from '@/stores/auth'
import { useSnackbar } from '@/composables/useSnackbar'
import { takeRegisterHandoff } from '@/lib/registerHandoff'
import { formatLocalDate, localDate } from '@/lib/timeclock'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RegisterProducts from '@/components/pos/register/RegisterProducts.vue'
import RegisterCart from '@/components/pos/register/RegisterCart.vue'
import RegisterResultDialog from '@/components/pos/register/RegisterResultDialog.vue'
import DrawerDialog from '@/components/pos/register/DrawerDialog.vue'
import DiscountDialog from '@/components/pos/register/DiscountDialog.vue'
import CustomItemDialog from '@/components/pos/register/CustomItemDialog.vue'
import { useScanner } from '@/components/pos/register/useScanner'
import { beepAdded, beepError } from '@/components/pos/register/registerSounds'
import SaleReceipt from '@/components/pos/SaleReceipt.vue'
import ZReportSlip from '@/components/pos/ZReportSlip.vue'
import DrawerCloseSlip from '@/components/pos/DrawerCloseSlip.vue'
import DrawerMovementSlip from '@/components/pos/DrawerMovementSlip.vue'
import CashMovementModal from '@/components/pos/CashMovementModal.vue'
import RefundReceipt from '@/components/pos/RefundReceipt.vue'
import NoSaleSlip from '@/components/pos/NoSaleSlip.vue'
import VariantPickerModal from '@/components/pos/VariantPickerModal.vue'
import CustomerPickerModal from '@/components/pos/CustomerPickerModal.vue'
import TenderModal from '@/components/pos/TenderModal.vue'
import CardPaymentModal from '@/components/pos/CardPaymentModal.vue'
import AccountPaymentModal from '@/components/pos/AccountPaymentModal.vue'
import AccountPaymentSlip from '@/components/pos/AccountPaymentSlip.vue'
import ApprovalModal from '@/components/pos/ApprovalModal.vue'
import RecentSalesModal from '@/components/pos/RecentSalesModal.vue'
import RefundModal from '@/components/pos/RefundModal.vue'
import IconStore from '~icons/material-symbols/storefront-rounded'
import IconChevron from '~icons/material-symbols/chevron-right-rounded'

const REGISTER_KEY = 'deerrun.registerId'
const authStore = useAuthStore()
const router = useRouter()
const snackbar = useSnackbar()

const catalog   = ref(null)
const loading   = ref(false)
const loadError = ref(null)
const registerId = ref(localStorage.getItem(REGISTER_KEY))

const search           = ref('')
const scanMessage      = ref(null) // { text, error } under the search field
const activeCategoryId = ref(null)
const productsRef      = ref(null)
const highlightLineKey = ref(null) // the cart line just added to, briefly highlighted

// { key, variantId, custom: { description, priceCents }, quantity, discountCents }
// Tee time lines (quantity 1): { key, booking: { bookingId }, label, balanceCents? } or { key, newBooking: {...}, label };
// $0 except a pay-at-course booking's balance
const cart     = ref([])
const customer = ref(null)

const pickingProduct     = ref(null)
const showCustomerPicker = ref(false)
const discounting        = ref(null) // { line, gross } while the discount dialog is open
const customItem         = ref(false)
const tendering          = ref(false)
const tenderMethod       = ref(null) // preselected tender (CASH after "Pay with cash instead")
const submitting         = ref(false)
const submitError        = ref(null)
const registerError      = ref(null)
const printDoc           = ref(null) // { type: 'sale' | 'refund' | 'noSale' | …, ... } — what window.print() prints
// The result dialog: { kind: 'sale' | 'refund' | 'drawer' | 'accountPayment', ... } (see RegisterResultDialog)
const result             = ref(null)

// Manager approvals
const approvalRequest    = ref(null) // { action, title, reason, resolve } while the PIN prompt is open
const discountApprovalId = ref(null) // one approval covers every discount in the current sale

// Voids and refunds
const showRecentSales = ref(false)
const recentSaleId    = ref(null) // open Recent sales on this sale (back from a cancelled refund)
const refunding       = ref(null) // { sale, mode: 'void' | 'refund' }
const refundBusy      = ref(false)
const refundError     = ref(null)

// Cash drawer: { session, last } for this register; session is null while the drawer is closed
const drawer       = ref(null)
const drawerForm   = ref(null) // { mode: 'open' | 'close', initialCents, resumeTender, busy, error }
const cashMovement = ref(null) // { type: 'PAID_IN' | 'PAID_OUT' | 'SAFE_DROP', busy, error } while the form is open

let keySeq = 0

// ─── Catalog lookups ────────────────────────────────────────────────────────

const register = computed(() => catalog.value?.registers.find(r => r.id === registerId.value) ?? null)
// The customer search returns isMember (active, not expired); fall back to the role for older data
const isMember = computed(() => customer.value?.isMember ?? customer.value?.role === 'MEMBER')

// Reader status for the cart chip and the tender dialog: true online, false offline, null unknown. The staff catalog
// doesn't report it yet (only GET /api/admin/registers/readers asks Stripe), so this reads an optional
// `readerStatus: 'online' | 'offline'` on the register and is null until the API sends one.
const readerOnline = computed(() => {
  const status = register.value?.hasCardReader ? register.value.readerStatus : null
  return status === 'online' ? true : status === 'offline' ? false : null
})

// Membership products put months on the customer's account, so they need a customer attached
const needsCustomerForMembership = computed(() => !customer.value && cart.value.some(l =>
  l.variantId && variantIndex.value[l.variantId]?.product.membershipMonths))

const categoryById = computed(() => Object.fromEntries((catalog.value?.categories ?? []).map(c => [c.id, c])))

const variantIndex = computed(() => {
  const index = {}
  for (const product of catalog.value?.products ?? []) {
    for (const variant of product.variants) index[variant.id] = { product, variant }
  }
  return index
})

// Barcode and SKU → variant, for scanning
const codeIndex = computed(() => {
  const index = {}
  for (const entry of Object.values(variantIndex.value)) {
    for (const code of [entry.variant.barcode, entry.variant.sku]) {
      if (code) index[code.toLowerCase()] = entry
    }
  }
  return index
})

function matchProducts(text) {
  const term = text.trim().toLowerCase()
  return (catalog.value?.products ?? []).filter(p => p.name.toLowerCase().includes(term) ||
    p.variants.some(v => v.sku?.toLowerCase().includes(term) || v.barcode?.toLowerCase().includes(term)))
}

const visibleProducts = computed(() => {
  if (!search.value.trim()) return (catalog.value?.products ?? []).filter(p => p.categoryId === activeCategoryId.value)
  return matchProducts(search.value)
})

// What a scan or a search's Enter finds: an exact barcode/SKU, else the one product that matches
function findMatch(term) {
  const hit = codeIndex.value[term.toLowerCase()]
  if (hit) return { kind: 'variant', ...hit }
  const matches = matchProducts(term)
  if (matches.length === 1) return { kind: 'product', product: matches[0] }
  return { kind: matches.length ? 'many' : 'none' }
}

function productPriceLabel(p) {
  const prices = p.variants.map(v => unitPriceCents(p, v, isMember.value))
  const min = Math.min(...prices)
  return Math.max(...prices) > min ? `from ${formatCents(min)}` : formatCents(min)
}

function isOutOfStock(p) {
  return p.trackInventory && p.variants.every(v => v.stockQty <= 0)
}

// ─── Cart ───────────────────────────────────────────────────────────────────

// Same pricing functions the server uses, so the total shown is the total charged. The cart line's discountCents
// is the manager's discount; priced lines carry discountCents (member + manager) and the two parts apart.
const pricedLines = computed(() => cart.value.map(line => {
  let unit, taxRateBps, description, bps = 0
  if (line.booking || line.newBooking) {
    // A pay-at-course booking's balance (untaxed, like the online price); otherwise $0
    unit = line.balanceCents ?? 0
    taxRateBps = 0
    description = line.label
  } else if (line.custom) {
    unit = line.custom.priceCents
    taxRateBps = catalog.value.salesTaxBps
    description = line.custom.description
  } else {
    const { product, variant } = variantIndex.value[line.variantId]
    unit = unitPriceCents(product, variant, isMember.value)
    const category = categoryById.value[product.categoryId]
    taxRateBps = category?.taxExempt ? 0 : catalog.value.salesTaxBps
    description = variantDescription(product.name, variant)
    bps = memberDiscountBps({ product, variant, category, isMember: isMember.value, tier: customer.value?.membershipTier })
  }
  const discountCents = Math.min(line.discountCents, unit * line.quantity - memberDiscountCents(unit, line.quantity, bps))
  return {
    ...line,
    description,
    unitPriceCents: unit,
    taxRateBps,
    memberDiscountBps: bps,
    ...priceLine({ unitPriceCents: unit, quantity: line.quantity, discountCents, memberDiscountBps: bps, taxRateBps }),
  }
}))

const memberDiscountTotal = computed(() => pricedLines.value.reduce((sum, l) => sum + l.memberDiscountCents, 0))

const totals = computed(() => saleTotals(pricedLines.value))

function focusSearch() {
  nextTick(() => productsRef.value?.focus())
}

// Flash the cart line (the cart scrolls it into view), so the cashier sees what a scan or tap added
let highlightTimer = null
function showLine(key) {
  beepAdded()
  clearTimeout(highlightTimer)
  highlightLineKey.value = null
  nextTick(() => {
    highlightLineKey.value = key
    highlightTimer = setTimeout(() => { highlightLineKey.value = null }, 1200)
  })
}

function addVariant(product, variant) {
  const existing = cart.value.find(l => l.variantId === variant.id && !l.discountCents)
  if (existing) existing.quantity += 1
  else cart.value.push({ key: keySeq++, variantId: variant.id, custom: null, quantity: 1, discountCents: 0 })
  showLine(existing ? existing.key : cart.value[cart.value.length - 1].key)
  focusSearch()
}

function chooseProduct(product) {
  if (product.variants.length === 1) addVariant(product, product.variants[0])
  else pickingProduct.value = product
}

function onSearchEnter() {
  const term = search.value.trim()
  if (!term) return
  const match = findMatch(term)
  if (match.kind === 'variant' || match.kind === 'product') {
    search.value = ''
    scanMessage.value = null
    if (match.kind === 'variant') addVariant(match.product, match.variant)
    else chooseProduct(match.product)
    return
  }
  if (match.kind === 'many') {
    scanMessage.value = { text: 'Pick a product below.', error: false }
    return
  }
  // A missed scan: tone, and select the text so the next scan replaces it instead of appending
  scanMessage.value = { text: `Nothing matches "${term}".`, error: true }
  beepError()
  nextTick(() => productsRef.value?.select())
}

// A scan from the document-level buffer (no field or dialog had focus): the same lookup as the search field.
// Over "Sale complete" it starts the next sale with that item; a miss there keeps the result (change due) on screen.
function onScan(code) {
  if (result.value?.kind === 'sale') {
    const match = findMatch(code)
    if (match.kind !== 'variant' && match.kind !== 'product') {
      beepError()
      snackbar.show({ message: `Nothing matches "${code}"`, tone: 'error' })
      return
    }
    startNewSale()
  }
  search.value = code
  scanMessage.value = null
  onSearchEnter()
}

// Any dialog other than "Sale complete" takes the keys for itself
const dialogOpen = computed(() => !!(pickingProduct.value || showCustomerPicker.value || discounting.value || customItem.value ||
  tendering.value || cardPayment.value || showRecentSales.value || refunding.value || drawerForm.value || cashMovement.value ||
  approvalRequest.value || showAccountPayment.value || (result.value && result.value.kind !== 'sale')))

useScanner(onScan, { canScan: () => !!register.value && !dialogOpen.value })

function changeQty(line, delta) {
  const target = cart.value.find(l => l.key === line.key)
  target.quantity += delta
  if (target.quantity <= 0) removeLine(line)
}

function removeLine(line) {
  cart.value = cart.value.filter(l => l.key !== line.key)
  focusSearch()
}

// ─── Manager approvals ──────────────────────────────────────────────────────

/**
 * Gets a manager's approval for an action. A manager at the register approves without a prompt;
 * anyone else gets the manager PIN prompt. Resolves to { approvalId, approverName } or null.
 */
async function requestApproval(action, title, reason = null) {
  registerError.value = null
  if (authStore.isRegisterManager) {
    try {
      return await apiFetch('/api/staff/approvals', { method: 'POST', body: { action, registerId: registerId.value, reason } })
    } catch (e) {
      registerError.value = e.message
      return null
    }
  }
  return new Promise(resolve => {
    approvalRequest.value = { action, title, reason, resolve }
  })
}

function onApproved(approval) {
  approvalRequest.value.resolve(approval)
  approvalRequest.value = null
}

function onApprovalCancel() {
  approvalRequest.value.resolve(null)
  approvalRequest.value = null
  focusSearch()
}

async function printDocument(doc) {
  printDoc.value = doc
  await nextTick()
  printReceipt()
}

// Managers print today's Z report for this register (it also opens the drawer for the count)
async function printZReport() {
  registerError.value = null
  try {
    const report = await apiFetch(`/api/staff/register/report?${new URLSearchParams({ registerId: registerId.value })}`)
    await printDocument({ type: 'z', report })
  } catch (e) {
    registerError.value = e.message
  }
  focusSearch()
}

async function noSale() {
  const approval = await requestApproval('NO_SALE', 'Open the cash drawer without a sale (No Sale).')
  if (approval) await printDocument({ type: 'noSale', at: new Date().toISOString(), approverName: approval.approverName })
  focusSearch()
}

// ─── Discounts (managers only) ──────────────────────────────────────────────

async function openDiscount(line) {
  if (!discountApprovalId.value) {
    const approval = await requestApproval('DISCOUNT', `Give a discount on ${line.description}.`)
    if (!approval) return
    discountApprovalId.value = approval.approvalId
  }
  // The manager's discount comes off what's left after any member discount
  discounting.value = { line, gross: line.unitPriceCents * line.quantity - line.memberDiscountCents }
}

function applyDiscount(cents) {
  const { line, gross } = discounting.value
  const target = cart.value.find(l => l.key === line.key)
  if (target) target.discountCents = Math.min(Math.max(cents || 0, 0), gross)
  discounting.value = null
  focusSearch()
}

function addCustomItem({ description, priceCents }) {
  const key = keySeq++
  cart.value.push({ key, variantId: null, custom: { description, priceCents }, quantity: 1, discountCents: 0 })
  showLine(key)
  customItem.value = false
  focusSearch()
}

function clearSale() {
  cart.value     = []
  customer.value = null
  discountApprovalId.value = null
  focusSearch()
}

// ─── Checkout ───────────────────────────────────────────────────────────────

function openTender({ method = null } = {}) {
  submitError.value  = null
  tenderMethod.value = method
  tendering.value    = true
}

async function completeSale(tender, { retried = false } = {}) {
  const { payments, receiptEmail } = tender
  submitting.value  = true
  submitError.value = null
  try {
    const res = await apiFetch('/api/staff/sales', {
      method: 'POST',
      body: {
        registerId: registerId.value,
        customerId: customer.value?.id ?? null,
        items: pricedLines.value.map(saleItem),
        payments,
        expectedTotalCents: totals.value.totalCents,
        receiptEmail,
        approvalId: discountApprovalId.value,
        accountPin: tender.accountPin ?? undefined,
      },
    })
    tendering.value = false
    if (res.cardCheckout) {
      // The card is on the reader; the sale saves when it's approved (CardPaymentModal polls)
      const card = payments.find(p => p.method === 'CARD_TERMINAL')
      cardPayment.value = { checkout: res.cardCheckout, tender, cashCents: totals.value.totalCents - (card?.amountCents ?? 0) }
      return
    }
    await finishSale(res, tender)
  } catch (e) {
    if (e.code === 'APPROVAL_REQUIRED' && !retried) {
      // The discount approval expired (30 minutes); ask again and retry once
      discountApprovalId.value = null
      submitting.value = false
      const approval = await requestApproval('DISCOUNT', 'The discount approval expired. Approve the discounts on this sale again.')
      if (approval) {
        discountApprovalId.value = approval.approvalId
        return completeSale(tender, { retried: true })
      }
      submitError.value = 'Discounts need a manager\'s approval. Remove them or approve again.'
      return
    }
    submitError.value = e.message
    if (e.code === 'DRAWER_CLOSED') {
      // Swap the payment screen for the open-drawer form, then come back to payment once it's open
      tendering.value   = false
      submitError.value = null
      await loadDrawer()
      openDrawerForm({ resumeTender: true })
      return
    }
    // A price or product may have changed; refresh so the cart shows current prices
    loadCatalog()
  } finally {
    submitting.value = false
  }
}

// Card payment dialog: { checkout, tender, cashCents, kind?, member? } while the card is on the reader
const cardPayment = ref(null)

// Why this register can't take cards right now (null = it can)
const cardBlocked = computed(() => (register.value?.hasCardReader ? null : 'This register has no card reader (Admin → Registers)'))

// Shared end of a sale (cash, or card once approved): clear the cart and show the sale-complete screen
async function finishSale({ sale, emailError = null, warnings = [], notice = null }, { print, receiptEmail }) {
  const hadMembership = cart.value.some(l => l.variantId && variantIndex.value[l.variantId]?.product.membershipMonths)
  // A tee time from the Tee Sheet page (check-in or a walk-in booking): offer the way back
  const checkIn = cart.value.some(l => l.booking || l.newBooking)
  cart.value      = []
  customer.value  = null
  discountApprovalId.value = null
  const membershipUntil = hadMembership && !warnings.length ? await membershipEnd(sale.customerId) : null
  result.value = {
    kind: 'sale', sale, emailError, warnings: notice ? [notice, ...warnings] : warnings,
    emailedTo: emailError ? null : receiptEmail, sending: false, membershipUntil, checkIn,
  }
  if (print) await printDocument({ type: 'sale', sale })
  loadCatalog() // refresh stock counts
  if (sale.payments.some(p => p.method === 'CASH')) loadDrawer() // managers see the running expected amount
}

async function onCardDone(res, payment = cardPayment.value) {
  const { tender, member } = payment
  cardPayment.value = null
  if (res.accountPayment) {
    await showAccountPaymentResult({ accountPayment: res.accountPayment, changeCents: 0, member })
    return
  }
  await finishSale(res, tender)
}

// Cancelled before the card was charged: back to the payment screen with the cart as it was
function onCardCanceled() {
  const wasAccountPayment = cardPayment.value?.kind === 'account'
  cardPayment.value = null
  if (wasAccountPayment) showAccountPayment.value = true
  else openTender()
}

// "Pay with cash instead" after a decline: the card dialog cancels the checkout first (like Cancel → Back to the
// sale). Cancel again in case it didn't (the API answers 409 once it's cancelled); if the card had gone through after
// all, the cancel completes the sale instead. Then back to payment with Cash picked.
async function onCardPayCash() {
  const payment = cardPayment.value
  cardPayment.value = null
  if (!payment) return
  try {
    const res = await apiFetch(`/api/staff/card-checkouts/${payment.checkout.id}`, { method: 'POST', body: { action: 'cancel' } })
    if (res.sale || res.accountPayment) {
      await onCardDone({ ...res, warnings: res.warnings ?? [] }, payment)
      return
    }
  } catch {
    // Already cancelled
  }
  if (payment.kind === 'account') showAccountPayment.value = true
  else openTender({ method: 'CASH' })
}

// ─── House account payments (a member paying down their balance) ───────────

const showAccountPayment = ref(false)

async function showAccountPaymentResult({ accountPayment, changeCents, member }) {
  showAccountPayment.value = false
  result.value = { kind: 'accountPayment', payment: accountPayment, changeCents, memberName: member?.name || member?.email || '' }
  // Cash goes in the drawer: print the receipt now (it opens the drawer); card receipts print from the button
  if (accountPayment.method === 'CASH') {
    await printAccountSlip(result.value)
    loadDrawer()
  }
  if (customer.value?.houseAccount?.id === accountPayment.accountId) {
    customer.value = { ...customer.value, houseAccount: { ...customer.value.houseAccount, balanceCents: accountPayment.balanceCents } }
  }
}

function onAccountPaymentDone(res) {
  showAccountPaymentResult(res)
}

function onAccountPaymentCard({ cardCheckout, member }) {
  showAccountPayment.value = false
  cardPayment.value = { checkout: cardCheckout, tender: null, cashCents: 0, kind: 'account', member }
}

async function onAccountPaymentClose(info) {
  showAccountPayment.value = false
  if (info?.drawerClosed) {
    await loadDrawer()
    openDrawerForm()
  } else {
    focusSearch()
  }
}

function printAccountSlip(r) {
  return printDocument({ type: 'accountPayment', payment: r.payment, memberName: r.memberName, changeCents: r.changeCents })
}

// What the API expects for each cart line (see buildSale). The server works out the member discount itself.
function saleItem(l) {
  if (l.booking) return { booking: l.booking }
  if (l.newBooking) return { newBooking: l.newBooking }
  if (l.custom) return { custom: l.custom, quantity: l.quantity, discountCents: l.managerDiscountCents }
  return { variantId: l.variantId, quantity: l.quantity, discountCents: l.managerDiscountCents }
}

// The customer's new membership end date, for the sale-complete screen
async function membershipEnd(userId) {
  if (!userId) return null
  try {
    const [match] = (await apiFetch(`/api/staff/register/customers?id=${encodeURIComponent(userId)}`))
    return match?.memberUntil ? formatLocalDate(match.memberUntil, { month: 'short', day: 'numeric', year: 'numeric' }) : null
  } catch {
    return null
  }
}

// A tee time sent from the Tee Sheet page (check-in or a walk-in/phone booking)
function applyHandoff() {
  const handoff = takeRegisterHandoff()
  if (!handoff) return
  const exists = cart.value.some(l => (handoff.kind === 'booking' && l.booking?.bookingId === handoff.bookingId) ||
    (handoff.kind === 'newBooking' && l.newBooking))
  if (!exists) {
    cart.value.push(handoff.kind === 'booking'
      ? {
          key: keySeq++, booking: { bookingId: handoff.bookingId }, label: handoff.label, quantity: 1, discountCents: 0,
          ...(handoff.balanceCents > 0 ? { balanceCents: handoff.balanceCents } : {}),
        }
      : { key: keySeq++, newBooking: handoff.newBooking, label: handoff.label, quantity: 1, discountCents: 0 })
  }
  if (handoff.customer && !customer.value) customer.value = handoff.customer
}

// ─── Result dialog ──────────────────────────────────────────────────────────

function printResult() {
  const r = result.value
  if (!r) return
  if (r.kind === 'sale') printDocument({ type: 'sale', sale: r.sale })
  else if (r.kind === 'refund') printDocument({ type: 'refund', sale: r.sale, refund: r.refund })
  else if (r.kind === 'drawer') printDocument({ type: 'drawer', session: r.session })
  else printAccountSlip(r)
}

function onResultDone() {
  if (result.value?.kind === 'sale') startNewSale()
  else {
    result.value = null
    focusSearch()
  }
}

function backToTeeSheet() {
  result.value = null
  router.push('/staff/teesheet')
}

async function emailCompletedReceipt(email) {
  const r = result.value
  if (r?.kind !== 'sale') return
  r.sending = true
  r.emailError = null
  try {
    await apiFetch(`/api/staff/sales/${r.sale.id}`, { method: 'POST', body: { action: 'email', email } })
    r.emailedTo = email
  } catch (e) {
    r.emailError = e.message
  } finally {
    r.sending = false
  }
}

function startNewSale() {
  result.value = null
  focusSearch()
}

// ─── Voids and refunds ──────────────────────────────────────────────────────

function openRecentSales(saleId = null) {
  recentSaleId.value = saleId
  showRecentSales.value = true
}

// Recent sales closes while the refund dialog is up (one dialog at a time) and comes back on that sale if it's cancelled
function startRefund(sale, mode) {
  refundError.value     = null
  showRecentSales.value = false
  refunding.value       = { sale, mode }
}

function cancelRefund() {
  const saleId = refunding.value?.sale.id
  refunding.value = null
  openRecentSales(saleId)
}

async function submitRefund({ items, restock, reason, totalCents, method }) {
  const { sale, mode } = refunding.value
  const verb = mode === 'void' ? 'Void' : 'Refund'
  const approval = await requestApproval(
    mode === 'void' ? 'VOID' : 'REFUND',
    `${verb} sale #${sale.number}: ${formatCents(totalCents)} back ${{ CARD_TERMINAL: 'to the card', HOUSE_ACCOUNT: 'to the house account' }[method] ?? 'in cash'}. Reason: ${reason}`,
    reason,
  )
  if (!approval) return

  refundBusy.value  = true
  refundError.value = null
  try {
    const res = await apiFetch(`/api/staff/sales/${sale.id}`, {
      method: 'POST',
      body: { action: mode, approvalId: approval.approvalId, reason, registerId: registerId.value, items, restock, method },
    })
    const refund = res.sale.refunds.find(r => r.id === res.refund.id)
    refunding.value       = null
    showRecentSales.value = false
    // Refunded membership months come off the customer's end date (warnings if that didn't save)
    const until = res.memberUntil
    result.value = {
      kind: 'refund', sale: res.sale, refund, warnings: res.warnings ?? [],
      memberUntil: until
        ? { label: formatLocalDate(until, { month: 'short', day: 'numeric', year: 'numeric' }), ended: until < localDate() }
        : null,
    }
    // Printing the refund slip opens the drawer for the cash (card refunds print from the button instead)
    if (refund.method === 'CASH') await printDocument({ type: 'refund', sale: res.sale, refund })
    loadCatalog() // stock may have changed
    loadDrawer()
  } catch (e) {
    refundError.value = e.message
    if (e.code === 'DRAWER_CLOSED') {
      refunding.value = null
      showRecentSales.value = false
      await loadDrawer()
      openDrawerForm()
    }
  } finally {
    refundBusy.value = false
  }
}

// ─── Cash drawer ────────────────────────────────────────────────────────────

async function loadDrawer() {
  if (!registerId.value) return
  try {
    drawer.value = await apiFetch(`/api/staff/register/drawer?registerId=${encodeURIComponent(registerId.value)}`)
  } catch (e) {
    registerError.value = e.message
  }
}

function openDrawerForm({ resumeTender = false } = {}) {
  // Most courses start each day with the same amount, so suggest the last starting cash
  const last = drawer.value?.last?.openingFloatCents
  drawerForm.value = { mode: 'open', initialCents: last ?? null, resumeTender, busy: false, error: null }
}

function closeDrawerForm() {
  drawerForm.value = { mode: 'close', initialCents: null, resumeTender: false, busy: false, error: null }
}

async function submitDrawer({ cents, note }) {
  const f = drawerForm.value
  if (!f || f.busy) return
  f.busy  = true
  f.error = null
  try {
    if (f.mode === 'open') {
      await apiFetch('/api/staff/register/drawer', { method: 'POST', body: { action: 'open', registerId: registerId.value, floatCents: cents, note } })
      drawerForm.value = null
      if (f.resumeTender && cart.value.length) openTender()
      else focusSearch()
    } else {
      const { session } = await apiFetch('/api/staff/register/drawer', {
        method: 'POST',
        body: { action: 'close', sessionId: drawer.value.session.id, countedCents: cents, note },
      })
      drawerForm.value = null
      result.value = { kind: 'drawer', session }
      await printDocument({ type: 'drawer', session })
    }
    await loadDrawer()
  } catch (e) {
    f.error = e.message
  } finally {
    f.busy = false
  }
}

// Paid in / paid out / safe drop on the open drawer: a manager approves (no prompt for a manager at the
// register), then the slip prints, which opens the drawer
const MOVEMENT_TITLES = { PAID_IN: 'Paid in', PAID_OUT: 'Paid out', SAFE_DROP: 'Safe drop' }

function startCashMovement(type) {
  registerError.value = null
  cashMovement.value = { type, busy: false, error: null }
}

async function submitCashMovement({ amountCents, reason, recipient }) {
  const m = cashMovement.value
  if (!m || m.busy) return
  m.busy  = true
  m.error = null
  const what = [reason, recipient && `to ${recipient}`].filter(Boolean).join(' ')
  const summary = `${MOVEMENT_TITLES[m.type]} ${formatCents(amountCents)}${what ? `: ${what}` : ''}`
  try {
    const approval = await requestApproval(m.type, `${summary}.`, summary)
    if (!approval) {
      m.error = registerError.value
      registerError.value = null
      return
    }
    const { movement } = await apiFetch('/api/staff/register/drawer', {
      method: 'POST',
      body: { action: 'movement', registerId: registerId.value, type: m.type, amountCents, reason, recipient, approvalId: approval.approvalId },
    })
    cashMovement.value = null
    await printDocument({ type: 'movement', movement })
    loadDrawer()
    focusSearch()
  } catch (e) {
    if (e.code === 'DRAWER_CLOSED') {
      cashMovement.value = null
      await loadDrawer()
      openDrawerForm()
      return
    }
    m.error = e.message
  } finally {
    m.busy = false
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

function chooseRegister(id) {
  localStorage.setItem(REGISTER_KEY, id)
  registerId.value = id
  loadDrawer()
  focusSearch()
}

// Switching a PC to a different register needs a manager (the first choice doesn't)
async function changeRegister() {
  const approval = await requestApproval('CHANGE_REGISTER', `Switch this computer from ${register.value?.name} to a different register.`)
  if (!approval) return
  localStorage.removeItem(REGISTER_KEY)
  registerId.value = null
  drawer.value = null
}

async function loadCatalog() {
  loading.value   = true
  loadError.value = null
  try {
    const data = await apiFetch('/api/staff/register/catalog')
    // Drop cart lines whose product is no longer for sale
    const available = new Set(data.products.flatMap(p => p.variants.map(v => v.id)))
    cart.value = cart.value.filter(l => l.custom || l.booking || l.newBooking || available.has(l.variantId))
    catalog.value = data
    if (!data.categories.some(c => c.id === activeCategoryId.value)) {
      activeCategoryId.value = data.categories.find(c => data.products.some(p => p.categoryId === c.id))?.id ?? null
    }
  } catch (e) {
    loadError.value = e.message
    // A refresh after a sale that fails keeps the register usable; say so in the cart
    if (catalog.value) registerError.value = `Couldn't refresh products: ${e.message}`
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadCatalog()
  applyHandoff()
  loadDrawer()
  focusSearch()
})
</script>
