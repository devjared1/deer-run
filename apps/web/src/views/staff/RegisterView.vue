<template>
  <div>
    <div class="print:hidden">
      <div v-if="loading && !catalog" class="text-gray-400 text-sm">Loading register…</div>
      <div v-else-if="loadError" class="text-red-500 text-sm">{{ loadError }}</div>

      <!-- Which register is this PC? -->
      <div v-else-if="catalog && !register" class="max-w-md bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="font-display font-bold text-bark mb-1">Which register is this?</h2>
        <p class="text-gray-500 text-sm font-body mb-4">This is saved on this computer, so you only choose once.</p>
        <div class="space-y-2">
          <button
            v-for="r in catalog.registers"
            :key="r.id"
            class="w-full text-left border border-gray-200 rounded-lg px-4 py-3 font-body text-bark hover:border-pine hover:bg-pine/5"
            @click="chooseRegister(r.id)"
          >
            {{ r.name }}
          </button>
        </div>
        <p v-if="!catalog.registers.length" class="text-gray-400 text-sm font-body">
          No registers are set up yet. An admin can add one in Admin → Registers.
        </p>
      </div>

      <div v-else-if="catalog" class="grid lg:grid-cols-[1fr_24rem] gap-5 items-start">
        <!-- Products -->
        <section>
          <div class="flex gap-3 mb-2">
            <input
              ref="searchInput"
              v-model="search"
              type="text"
              class="input-field flex-1 text-base"
              placeholder="Scan a barcode or search products"
              autocomplete="off"
              @keydown.enter.prevent="onSearchEnter"
              @input="scanMessage = null"
            />
            <button class="btn-outline-sm whitespace-nowrap" @click="openCustom">+ Custom Item</button>
          </div>
          <p v-if="scanMessage" class="text-clay text-sm font-body mb-2">{{ scanMessage }}</p>

          <div v-if="!search" class="flex flex-wrap gap-2 mb-4">
            <button
              v-for="c in catalog.categories"
              :key="c.id"
              :class="['px-3 py-1.5 rounded-lg text-sm font-body transition-colors',
                c.id === activeCategoryId ? 'bg-pine text-parch' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50']"
              @click="activeCategoryId = c.id"
            >
              {{ c.name }}
            </button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            <button
              v-for="p in visibleProducts"
              :key="p.id"
              class="bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-pine hover:shadow-sm transition min-h-[5.5rem] flex flex-col"
              @click="chooseProduct(p)"
            >
              <span class="font-body font-semibold text-bark text-sm leading-snug">{{ p.name }}</span>
              <span class="mt-auto pt-2 flex items-center justify-between gap-2">
                <span class="font-body text-gray-600 text-sm tabular-nums">{{ productPriceLabel(p) }}</span>
                <span v-if="p.variants.length > 1" class="text-xs text-gray-400 font-body">{{ p.variants.length }} options</span>
                <span v-else-if="isOutOfStock(p)" class="text-xs text-red-600 font-body">Out</span>
              </span>
            </button>
          </div>
          <p v-if="!visibleProducts.length" class="text-gray-400 text-sm font-body">No products{{ search ? ' match' : ' in this category' }}.</p>
        </section>

        <!-- Cart -->
        <aside class="bg-white rounded-xl border border-gray-200 flex flex-col lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)]">
          <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-body text-gray-500">
            <span class="font-semibold text-bark mr-auto">{{ register.name }}</span>
            <button class="text-lake hover:text-pine" @click="showRecentSales = true">Recent sales</button>
            <button class="text-lake hover:text-pine" @click="noSale">No sale</button>
            <button
              v-if="authStore.isRegisterManager"
              class="text-lake hover:text-pine"
              title="Print today's end-of-day (Z) report for this register"
              @click="printZReport"
            >
              End of day
            </button>
            <button class="text-lake hover:text-pine" @click="changeRegister">Change register</button>
          </div>
          <p v-if="registerError" class="px-4 pt-2 text-red-500 text-xs font-body">{{ registerError }}</p>

          <!-- Cash drawer -->
          <div v-if="drawer && !drawer.session" class="mx-4 mt-3 rounded-lg bg-amber/15 border border-amber/40 px-3 py-2 flex items-center gap-3">
            <span class="text-xs font-body text-bark flex-1">The cash drawer is closed. Count the starting cash and open it to take cash.</span>
            <button class="btn-amber px-3 py-1.5 text-xs whitespace-nowrap" @click="openDrawerForm">Open drawer</button>
          </div>
          <div v-else-if="drawer?.session" class="px-4 pt-2 flex items-center gap-2 text-xs font-body text-gray-400">
            <span class="flex-1 truncate">
              Drawer open since {{ formatTime(drawer.session.openedAt) }} ({{ drawer.session.openedBy?.firstName }})
              · start {{ formatCents(drawer.session.openingFloatCents) }}
              <template v-if="drawer.session.expectedCents !== undefined"> · expected {{ formatCents(drawer.session.expectedCents) }}</template>
            </span>
            <button class="text-lake hover:text-pine" @click="closeDrawerForm">Close drawer</button>
          </div>

          <!-- Customer -->
          <div class="px-4 py-3 border-b border-gray-100">
            <div v-if="customer" class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="font-body text-sm text-bark truncate">{{ customer.name || customer.email }}</div>
                <div class="text-xs font-body" :class="isMember ? 'text-lake' : 'text-gray-400'">
                  {{ isMember ? 'Member pricing' : customer.role === 'MEMBER' ? 'Membership expired' : 'Not a member' }}
                </div>
              </div>
              <button class="text-xs text-red-400 hover:text-red-600 font-body" @click="customer = null">Remove</button>
            </div>
            <button v-else class="text-sm text-lake hover:text-pine font-body" @click="showCustomerPicker = true">+ Attach customer</button>
          </div>

          <!-- Lines -->
          <div class="flex-1 overflow-y-auto divide-y divide-gray-50 min-h-[8rem]">
            <div v-for="line in pricedLines" :key="line.key" class="px-4 py-2.5">
              <div class="flex justify-between gap-2">
                <span class="font-body text-sm text-bark">{{ line.description }}</span>
                <span class="font-body text-sm text-bark tabular-nums">{{ formatCents(line.subtotalCents) }}</span>
              </div>
              <div v-if="line.booking || line.newBooking" class="flex items-center gap-2 mt-1">
                <span class="text-xs text-lake font-body">{{ line.newBooking ? 'Booked when the sale completes' : 'Prepaid tee time' }}</span>
                <button class="ml-auto text-xs text-red-400 hover:text-red-600 font-body" @click="removeLine(line)">Remove</button>
              </div>
              <div v-else class="flex items-center gap-2 mt-1">
                <button class="qty-btn" aria-label="Decrease quantity" @click="changeQty(line, -1)">−</button>
                <span class="w-6 text-center text-sm font-body tabular-nums">{{ line.quantity }}</span>
                <button class="qty-btn" aria-label="Increase quantity" @click="changeQty(line, 1)">+</button>
                <span class="text-xs text-gray-400 font-body">@ {{ formatCents(line.unitPriceCents) }}</span>
                <span v-if="line.taxRateBps === 0" class="text-xs text-gray-400 font-body">· no tax</span>
                <span class="ml-auto space-x-2 text-xs font-body">
                  <button class="text-lake hover:text-pine" @click="openDiscount(line)">
                    {{ line.discountCents ? `−${formatCents(line.discountCents)}` : 'Discount' }}
                  </button>
                  <button class="text-red-400 hover:text-red-600" @click="removeLine(line)">Remove</button>
                </span>
              </div>
            </div>
            <p v-if="!cart.length" class="px-4 py-8 text-center text-gray-400 text-sm font-body">Scan or tap products to start a sale.</p>
          </div>

          <!-- Totals -->
          <div class="border-t border-gray-100 px-4 py-3 font-body text-sm space-y-1">
            <div v-if="totals.discountCents" class="flex justify-between text-gray-500">
              <span>Discounts</span><span class="tabular-nums">−{{ formatCents(totals.discountCents) }}</span>
            </div>
            <div class="flex justify-between text-gray-500"><span>Subtotal</span><span class="tabular-nums">{{ formatCents(totals.subtotalCents) }}</span></div>
            <div class="flex justify-between text-gray-500">
              <span>Tax ({{ (catalog.salesTaxBps / 100).toFixed(2) }}%)</span><span class="tabular-nums">{{ formatCents(totals.taxCents) }}</span>
            </div>
            <div class="flex justify-between text-bark font-display font-bold text-xl pt-1">
              <span>Total</span><span class="tabular-nums">{{ formatCents(totals.totalCents) }}</span>
            </div>
          </div>
          <p v-if="needsCustomerForMembership" class="px-4 pb-2 text-clay text-xs font-body">
            Attach the customer to sell a membership, so it goes on their account.
          </p>
          <div class="px-4 pb-4 flex gap-2">
            <button class="btn-outline-sm" :disabled="!cart.length" @click="clearSale">Clear</button>
            <button class="btn-amber flex-1 py-3 text-base disabled:opacity-50" :disabled="!cart.length || needsCustomerForMembership" @click="openTender">
              Charge {{ formatCents(totals.totalCents) }}
            </button>
          </div>
        </aside>
      </div>
    </div>

    <!-- Sale complete -->
    <div v-if="completed" class="modal-overlay print:hidden">
      <div class="modal-box max-w-sm text-center">
        <div class="text-gray-400 text-xs font-body uppercase tracking-wider">Sale #{{ completed.sale.number }} complete</div>
        <template v-if="completed.sale.changeCents">
          <div class="text-gray-500 text-sm font-body mt-4">Change due</div>
          <div class="font-display font-bold text-pine text-5xl tabular-nums">{{ formatCents(completed.sale.changeCents) }}</div>
        </template>
        <div v-else class="font-display font-bold text-bark text-3xl mt-3 tabular-nums">{{ formatCents(completed.sale.totalCents) }}</div>

        <p v-for="w in completed.warnings" :key="w" class="text-clay text-sm font-body mt-3">{{ w }}</p>
        <p v-if="completed.membershipUntil" class="text-lake text-sm font-body mt-3">Membership active through {{ completed.membershipUntil }}</p>
        <p v-if="completed.emailError" class="text-clay text-sm font-body mt-3">Receipt email failed: {{ completed.emailError }}</p>
        <p v-else-if="completed.emailedTo" class="text-gray-500 text-sm font-body mt-3">Receipt emailed to {{ completed.emailedTo }}</p>

        <div class="mt-5 space-y-2">
          <button class="btn-outline-sm w-full" @click="printDocument({ type: 'sale', sale: completed.sale })">Print Receipt</button>
          <div class="flex gap-2">
            <input v-model="completed.emailInput" type="email" class="input-field flex-1" placeholder="Email receipt to…" />
            <button class="btn-outline-sm" :disabled="completed.sending || !completed.emailInput" @click="emailCompletedReceipt">
              {{ completed.sending ? 'Sending…' : 'Send' }}
            </button>
          </div>
          <button ref="newSaleButton" class="btn-amber w-full py-3 text-base" @click="startNewSale">New Sale</button>
        </div>
      </div>
    </div>

    <!-- Refund / void done -->
    <div v-if="refundResult" class="modal-overlay print:hidden">
      <div class="modal-box max-w-sm text-center">
        <div class="text-gray-400 text-xs font-body uppercase tracking-wider">
          Sale #{{ refundResult.sale.number }} {{ refundResult.refund.kind === 'VOID' ? 'voided' : 'refunded' }}
        </div>
        <div class="text-gray-500 text-sm font-body mt-4">Give the customer</div>
        <div class="font-display font-bold text-clay text-5xl tabular-nums">{{ formatCents(refundResult.refund.amountCents) }}</div>
        <div class="text-gray-400 text-xs font-body">cash</div>
        <div class="mt-5 space-y-2">
          <button class="btn-outline-sm w-full" @click="printDocument({ type: 'refund', sale: refundResult.sale, refund: refundResult.refund })">
            Print Refund Slip
          </button>
          <button class="btn-amber w-full py-3 text-base" @click="refundResult = null; focusSearch()">Done</button>
        </div>
      </div>
    </div>

    <!-- Open the drawer -->
    <div v-if="drawerForm?.mode === 'open'" class="modal-overlay print:hidden" @click.self="drawerForm = null">
      <div class="modal-box max-w-sm">
        <h2 class="font-display font-bold text-bark mb-1">Open the cash drawer</h2>
        <p class="text-gray-500 text-sm font-body mb-4">
          {{ drawerForm.resumeTender ? 'The drawer has to be open to take cash. ' : '' }}Count the cash in the drawer before the first sale.
        </p>
        <label class="label-sm">Starting cash ($)</label>
        <input ref="drawerAmountInput" v-model="drawerForm.amount" type="number" min="0" step="0.01" class="input-field w-full text-lg" @keyup.enter="submitDrawer" />
        <label class="label-sm mt-3">Note (optional)</label>
        <input v-model="drawerForm.note" type="text" maxlength="300" class="input-field w-full" />
        <p v-if="drawerForm.error" class="text-red-500 text-xs mt-2 font-body">{{ drawerForm.error }}</p>
        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-outline-sm" @click="drawerForm = null">Cancel</button>
          <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="drawerForm.busy || drawerForm.amount === ''" @click="submitDrawer">
            {{ drawerForm.busy ? 'Opening…' : 'Open Drawer' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Close the drawer (blind count: the expected amount shows after) -->
    <div v-if="drawerForm?.mode === 'close'" class="modal-overlay print:hidden" @click.self="!drawerForm.result && (drawerForm = null)">
      <div class="modal-box max-w-sm">
        <template v-if="!drawerForm.result">
          <h2 class="font-display font-bold text-bark mb-1">Close the cash drawer</h2>
          <p class="text-gray-500 text-sm font-body mb-4">Count all the cash in the drawer, including the starting cash.</p>
          <label class="label-sm">Counted cash ($)</label>
          <input ref="drawerAmountInput" v-model="drawerForm.amount" type="number" min="0" step="0.01" class="input-field w-full text-lg" @keyup.enter="submitDrawer" />
          <label class="label-sm mt-3">Note (optional)</label>
          <input v-model="drawerForm.note" type="text" maxlength="300" class="input-field w-full" placeholder="e.g. $20 to the safe at 2 PM" />
          <p v-if="drawerForm.error" class="text-red-500 text-xs mt-2 font-body">{{ drawerForm.error }}</p>
          <div class="flex justify-end gap-3 mt-5">
            <button class="btn-outline-sm" @click="drawerForm = null">Cancel</button>
            <button class="btn-amber px-4 py-2 text-sm disabled:opacity-50" :disabled="drawerForm.busy || drawerForm.amount === ''" @click="submitDrawer">
              {{ drawerForm.busy ? 'Closing…' : 'Close Drawer' }}
            </button>
          </div>
        </template>
        <template v-else>
          <div class="text-center">
            <div class="text-gray-400 text-xs font-body uppercase tracking-wider">Drawer closed</div>
            <div class="text-gray-500 text-sm font-body mt-4">
              {{ drawerForm.result.overShortCents === 0 ? 'Balanced' : drawerForm.result.overShortCents > 0 ? 'Over' : 'Short' }}
            </div>
            <div :class="['font-display font-bold text-5xl tabular-nums', drawerForm.result.overShortCents === 0 ? 'text-pine' : 'text-clay']">
              {{ formatCents(Math.abs(drawerForm.result.overShortCents)) }}
            </div>
            <div class="text-sm font-body text-gray-500 mt-3 space-y-0.5">
              <div>Expected {{ formatCents(drawerForm.result.expectedCents) }} · counted {{ formatCents(drawerForm.result.countedCents) }}</div>
              <div class="text-xs text-gray-400">
                Start {{ formatCents(drawerForm.result.openingFloatCents) }} + cash sales {{ formatCents(drawerForm.result.cashSalesCents) }}
                − cash refunds {{ formatCents(drawerForm.result.cashRefundsCents) }}
              </div>
            </div>
          </div>
          <div class="mt-5 space-y-2">
            <button class="btn-outline-sm w-full" @click="printDocument({ type: 'drawer', session: drawerForm.result })">Print Close Slip</button>
            <button class="btn-amber w-full py-3 text-base" @click="drawerForm = null; focusSearch()">Done</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Only the current slip prints -->
    <div v-if="printDoc" class="hidden print:block">
      <SaleReceipt v-if="printDoc.type === 'sale'" :sale="printDoc.sale" />
      <RefundReceipt v-else-if="printDoc.type === 'refund'" :sale="printDoc.sale" :refund="printDoc.refund" :register-name="register?.name" />
      <NoSaleSlip v-else-if="printDoc.type === 'noSale'" :at="printDoc.at" :register-name="register?.name" :approver-name="printDoc.approverName" />
      <ZReportSlip v-else-if="printDoc.type === 'z'" :report="printDoc.report" />
      <DrawerCloseSlip v-else-if="printDoc.type === 'drawer'" :session="printDoc.session" />
    </div>

    <RecentSalesModal
      v-if="showRecentSales"
      :register-id="registerId"
      :register-name="register?.name"
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
      @cancel="refunding = null"
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
      @complete="completeSale"
      @close="tendering = false; focusSearch()"
    />

    <!-- Line discount -->
    <div v-if="discounting" class="modal-overlay print:hidden" @click.self="discounting = null">
      <div class="modal-box max-w-xs">
        <h2 class="font-display font-bold text-bark mb-1">Discount</h2>
        <p class="text-gray-400 text-xs font-body mb-3">{{ discounting.line.description }} · {{ formatCents(discounting.gross) }}</p>
        <div class="flex gap-2 mb-2">
          <button
            v-for="m in ['$', '%']"
            :key="m"
            :class="['flex-1 py-1.5 rounded-lg text-sm font-body', discounting.mode === m ? 'bg-pine text-parch' : 'border border-gray-200 text-gray-600']"
            @click="discounting.mode = m"
          >
            {{ m === '$' ? 'Amount' : 'Percent' }}
          </button>
        </div>
        <input v-model="discounting.value" type="number" min="0" step="0.01" class="input-field w-full" @keyup.enter="applyDiscount" />
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn-outline-sm" @click="discounting.value = ''; applyDiscount()">Remove</button>
          <button class="btn-amber px-4 py-2 text-sm" @click="applyDiscount">Apply</button>
        </div>
      </div>
    </div>

    <!-- Custom item -->
    <div v-if="customItem" class="modal-overlay print:hidden" @click.self="customItem = null">
      <div class="modal-box max-w-sm">
        <h2 class="font-display font-bold text-bark mb-3">Custom Item</h2>
        <div class="space-y-3">
          <div>
            <label class="label-sm">Description</label>
            <input v-model="customItem.description" type="text" maxlength="100" class="input-field w-full" />
          </div>
          <div>
            <label class="label-sm">Price ($)</label>
            <input v-model="customItem.price" type="number" min="0.01" step="0.01" class="input-field w-full" @keyup.enter="addCustomItem" />
          </div>
          <p class="text-gray-400 text-xs font-body">Custom items are taxed at the course rate.</p>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn-outline-sm" @click="customItem = null">Cancel</button>
          <button class="btn-amber px-4 py-2 text-sm" :disabled="!customItemValid" @click="addCustomItem">Add</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents, dollarsToCents } from '@/lib/money'
import { unitPriceCents, priceLine, saleTotals, variantDescription } from '@/lib/pricing'
import { printReceipt } from '@/lib/printReceipt'
import { useAuthStore } from '@/stores/auth'
import { takeRegisterHandoff } from '@/lib/registerHandoff'
import { formatLocalDate, COURSE_TZ } from '@/lib/timeclock'
import SaleReceipt from '@/components/pos/SaleReceipt.vue'
import ZReportSlip from '@/components/pos/ZReportSlip.vue'
import DrawerCloseSlip from '@/components/pos/DrawerCloseSlip.vue'
import RefundReceipt from '@/components/pos/RefundReceipt.vue'
import NoSaleSlip from '@/components/pos/NoSaleSlip.vue'
import VariantPickerModal from '@/components/pos/VariantPickerModal.vue'
import CustomerPickerModal from '@/components/pos/CustomerPickerModal.vue'
import TenderModal from '@/components/pos/TenderModal.vue'
import ApprovalModal from '@/components/pos/ApprovalModal.vue'
import RecentSalesModal from '@/components/pos/RecentSalesModal.vue'
import RefundModal from '@/components/pos/RefundModal.vue'

const REGISTER_KEY = 'deerrun.registerId'
const authStore = useAuthStore()

const catalog   = ref(null)
const loading   = ref(false)
const loadError = ref(null)
const registerId = ref(localStorage.getItem(REGISTER_KEY))

const search           = ref('')
const scanMessage      = ref(null)
const activeCategoryId = ref(null)
const searchInput      = ref(null)

// { key, variantId, custom: { description, priceCents }, quantity, discountCents }
// Tee time lines ($0, quantity 1): { key, booking: { bookingId }, label } or { key, newBooking: {...}, label }
const cart     = ref([])
const customer = ref(null)

const pickingProduct     = ref(null)
const showCustomerPicker = ref(false)
const discounting        = ref(null)
const customItem         = ref(null)
const tendering          = ref(false)
const submitting         = ref(false)
const submitError        = ref(null)
const completed          = ref(null)
const newSaleButton      = ref(null)
const registerError      = ref(null)
const printDoc           = ref(null) // { type: 'sale' | 'refund' | 'noSale', ... } — what window.print() prints

// Manager approvals
const approvalRequest    = ref(null) // { action, title, reason, resolve } while the PIN prompt is open
const discountApprovalId = ref(null) // one approval covers every discount in the current sale

// Voids and refunds
const showRecentSales = ref(false)
const refunding       = ref(null) // { sale, mode: 'void' | 'refund' }
const refundBusy      = ref(false)
const refundError     = ref(null)
const refundResult    = ref(null) // { sale, refund } after it's done

// Cash drawer: { session, last } for this register; session is null while the drawer is closed
const drawer            = ref(null)
const drawerForm        = ref(null) // { mode: 'open' | 'close', amount, note, busy, error, result }
const drawerAmountInput = ref(null)

let keySeq = 0

// ─── Catalog lookups ────────────────────────────────────────────────────────

const register = computed(() => catalog.value?.registers.find(r => r.id === registerId.value) ?? null)
// The customer search returns isMember (active, not expired); fall back to the role for older data
const isMember = computed(() => customer.value?.isMember ?? customer.value?.role === 'MEMBER')

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

const visibleProducts = computed(() => {
  const products = catalog.value?.products ?? []
  const term = search.value.trim().toLowerCase()
  if (!term) return products.filter(p => p.categoryId === activeCategoryId.value)
  return products.filter(p => p.name.toLowerCase().includes(term) ||
    p.variants.some(v => v.sku?.toLowerCase().includes(term) || v.barcode?.toLowerCase().includes(term)))
})

function productPriceLabel(p) {
  const prices = p.variants.map(v => unitPriceCents(p, v, isMember.value))
  const min = Math.min(...prices)
  return Math.max(...prices) > min ? `from ${formatCents(min)}` : formatCents(min)
}

function isOutOfStock(p) {
  return p.trackInventory && p.variants.every(v => v.stockQty <= 0)
}

// ─── Cart ───────────────────────────────────────────────────────────────────

// Same pricing functions the server uses, so the total shown is the total charged
const pricedLines = computed(() => cart.value.map(line => {
  let unit, taxRateBps, description
  if (line.booking || line.newBooking) {
    unit = 0
    taxRateBps = 0
    description = line.label
  } else if (line.custom) {
    unit = line.custom.priceCents
    taxRateBps = catalog.value.salesTaxBps
    description = line.custom.description
  } else {
    const { product, variant } = variantIndex.value[line.variantId]
    unit = unitPriceCents(product, variant, isMember.value)
    taxRateBps = categoryById.value[product.categoryId]?.taxExempt ? 0 : catalog.value.salesTaxBps
    description = variantDescription(product.name, variant)
  }
  const discountCents = Math.min(line.discountCents, unit * line.quantity)
  return {
    ...line,
    description,
    unitPriceCents: unit,
    taxRateBps,
    discountCents,
    ...priceLine({ unitPriceCents: unit, quantity: line.quantity, discountCents, taxRateBps }),
  }
}))

const totals = computed(() => saleTotals(pricedLines.value))

function focusSearch() {
  nextTick(() => searchInput.value?.focus())
}

function addVariant(product, variant) {
  const existing = cart.value.find(l => l.variantId === variant.id && !l.discountCents)
  if (existing) existing.quantity += 1
  else cart.value.push({ key: keySeq++, variantId: variant.id, custom: null, quantity: 1, discountCents: 0 })
  focusSearch()
}

function chooseProduct(product) {
  if (product.variants.length === 1) addVariant(product, product.variants[0])
  else pickingProduct.value = product
}

function onSearchEnter() {
  const term = search.value.trim()
  if (!term) return
  const hit = codeIndex.value[term.toLowerCase()]
  if (hit) {
    addVariant(hit.product, hit.variant)
    search.value = ''
    return
  }
  if (visibleProducts.value.length === 1) {
    chooseProduct(visibleProducts.value[0])
    search.value = ''
    return
  }
  scanMessage.value = visibleProducts.value.length ? 'Pick a product below.' : `Nothing matches "${term}".`
}

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
  discounting.value = {
    line,
    gross: line.unitPriceCents * line.quantity,
    mode: '$',
    value: line.discountCents ? (line.discountCents / 100).toFixed(2) : '',
  }
}

function applyDiscount() {
  const { line, gross, mode, value } = discounting.value
  let cents = 0
  if (value !== '' && Number(value) > 0) {
    cents = mode === '%' ? Math.round((gross * Number(value)) / 100) : dollarsToCents(value)
  }
  cart.value.find(l => l.key === line.key).discountCents = Math.min(Math.max(cents || 0, 0), gross)
  discounting.value = null
  focusSearch()
}

function openCustom() {
  customItem.value = { description: '', price: '' }
}

const customItemValid = computed(() => customItem.value?.description.trim() && dollarsToCents(customItem.value.price) > 0)

function addCustomItem() {
  if (!customItemValid.value) return
  cart.value.push({
    key: keySeq++,
    variantId: null,
    custom: { description: customItem.value.description.trim(), priceCents: dollarsToCents(customItem.value.price) },
    quantity: 1,
    discountCents: 0,
  })
  customItem.value = null
  focusSearch()
}

function clearSale() {
  cart.value     = []
  customer.value = null
  discountApprovalId.value = null
  focusSearch()
}

// ─── Checkout ───────────────────────────────────────────────────────────────

function openTender() {
  submitError.value = null
  tendering.value   = true
}

async function completeSale(tender, { retried = false } = {}) {
  const { payments, print, receiptEmail } = tender
  submitting.value  = true
  submitError.value = null
  try {
    const hadMembership = cart.value.some(l => l.variantId && variantIndex.value[l.variantId]?.product.membershipMonths)
    const { sale, emailError, warnings = [] } = await apiFetch('/api/staff/sales', {
      method: 'POST',
      body: {
        registerId: registerId.value,
        customerId: customer.value?.id ?? null,
        items: pricedLines.value.map(saleItem),
        payments,
        expectedTotalCents: totals.value.totalCents,
        receiptEmail,
        approvalId: discountApprovalId.value,
      },
    })
    tendering.value = false
    cart.value      = []
    customer.value  = null
    discountApprovalId.value = null
    completed.value = {
      sale, emailError, warnings, emailedTo: emailError ? null : receiptEmail, emailInput: '', sending: false,
      membershipUntil: hadMembership && !warnings.length ? await membershipEnd(sale.customerId) : null,
    }
    if (print) await printDocument({ type: 'sale', sale })
    nextTick(() => newSaleButton.value?.focus())
    loadCatalog() // refresh stock counts
    if (sale.payments.some(p => p.method === 'CASH')) loadDrawer() // managers see the running expected amount
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

// What the API expects for each cart line (see buildSale)
function saleItem(l) {
  if (l.booking) return { booking: l.booking }
  if (l.newBooking) return { newBooking: l.newBooking }
  if (l.custom) return { custom: l.custom, quantity: l.quantity, discountCents: l.discountCents }
  return { variantId: l.variantId, quantity: l.quantity, discountCents: l.discountCents }
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
      ? { key: keySeq++, booking: { bookingId: handoff.bookingId }, label: handoff.label, quantity: 1, discountCents: 0 }
      : { key: keySeq++, newBooking: handoff.newBooking, label: handoff.label, quantity: 1, discountCents: 0 })
  }
  if (handoff.customer && !customer.value) customer.value = handoff.customer
}

// ─── Voids and refunds ──────────────────────────────────────────────────────

function startRefund(sale, mode) {
  refundError.value = null
  refunding.value   = { sale, mode }
}

async function submitRefund({ items, restock, reason, totalCents }) {
  const { sale, mode } = refunding.value
  const verb = mode === 'void' ? 'Void' : 'Refund'
  const approval = await requestApproval(
    mode === 'void' ? 'VOID' : 'REFUND',
    `${verb} sale #${sale.number}: ${formatCents(totalCents)} cash back. Reason: ${reason}`,
    reason,
  )
  if (!approval) return

  refundBusy.value  = true
  refundError.value = null
  try {
    const result = await apiFetch(`/api/staff/sales/${sale.id}`, {
      method: 'POST',
      body: { action: mode, approvalId: approval.approvalId, reason, registerId: registerId.value, items, restock },
    })
    const refund = result.sale.refunds.find(r => r.id === result.refund.id)
    refunding.value       = null
    showRecentSales.value = false
    refundResult.value    = { sale: result.sale, refund }
    // Printing the refund slip opens the drawer for the cash
    await printDocument({ type: 'refund', sale: result.sale, refund })
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

async function emailCompletedReceipt() {
  const c = completed.value
  c.sending = true
  c.emailError = null
  try {
    await apiFetch(`/api/staff/sales/${c.sale.id}`, { method: 'POST', body: { action: 'email', email: c.emailInput } })
    c.emailedTo = c.emailInput
    c.emailInput = ''
  } catch (e) {
    c.emailError = e.message
  } finally {
    c.sending = false
  }
}

function startNewSale() {
  completed.value = null
  focusSearch()
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
  drawerForm.value = {
    mode: 'open', amount: last !== undefined ? (last / 100).toFixed(2) : '', note: '', busy: false, error: null, result: null,
    resumeTender,
  }
  nextTick(() => drawerAmountInput.value?.select())
}

function closeDrawerForm() {
  drawerForm.value = { mode: 'close', amount: '', note: '', busy: false, error: null, result: null }
  nextTick(() => drawerAmountInput.value?.focus())
}

async function submitDrawer() {
  const f = drawerForm.value
  if (f.busy || f.amount === '') return
  f.busy  = true
  f.error = null
  try {
    const cents = dollarsToCents(f.amount)
    if (f.mode === 'open') {
      await apiFetch('/api/staff/register/drawer', { method: 'POST', body: { action: 'open', registerId: registerId.value, floatCents: cents, note: f.note } })
      drawerForm.value = null
      if (f.resumeTender && cart.value.length) openTender()
      else focusSearch()
    } else {
      const { session } = await apiFetch('/api/staff/register/drawer', {
        method: 'POST',
        body: { action: 'close', sessionId: drawer.value.session.id, countedCents: cents, note: f.note },
      })
      f.result = session
      await printDocument({ type: 'drawer', session })
    }
    await loadDrawer()
  } catch (e) {
    f.error = e.message
  } finally {
    f.busy = false
  }
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
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

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
/* Dialogs never print (only the slip does). Needed because this scoped display: flex outranks print:hidden. */
@media print { .modal-overlay { display: none !important; } }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.qty-btn        { @apply w-7 h-7 rounded-lg border border-gray-300 text-bark font-body leading-none hover:bg-gray-50; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40; }
</style>
