<template>
  <aside class="flex flex-col min-h-0 bg-surface-container-low" aria-label="Current sale">
    <!-- Register name + toolbar -->
    <div class="flex-none flex items-center gap-1 pl-4 pr-1 pt-1 pb-1">
      <h2 class="flex-1 min-w-0 truncate text-title-m text-on-surface">{{ registerName }}</h2>
      <IconButton :icon="IconReceipt" label="Recent sales" tooltip @click="emit('recent-sales')" />
      <IconButton :icon="IconNoSale" label="No sale (open the drawer)" tooltip @click="emit('no-sale')" />
      <IconButton :icon="IconWallet" label="Account payment" tooltip @click="emit('account-payment')" />
      <RowActionsMenu :items="menuItems" label="More register actions" />
    </div>

    <!-- Reader + drawer status -->
    <div class="flex-none px-4 pb-2 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <StatusChip size="sm" :tone="readerChip.tone" :icon="readerChip.icon" :label="readerChip.label" />
        <StatusChip v-if="drawer?.session" size="sm" tone="success" :icon="IconLockOpen" :label="`Drawer open since ${formatTime(drawer.session.openedAt)}`" />
      </div>
      <p v-if="drawer?.session" class="text-body-s text-on-surface-variant">
        {{ drawer.session.openedBy?.firstName }} · start {{ formatCents(drawer.session.openingFloatCents) }}
        <template v-if="drawer.session.movements?.length"> · {{ drawer.session.movements.length }} paid in/out</template>
        <template v-if="drawer.session.expectedCents !== undefined"> · expected {{ formatCents(drawer.session.expectedCents) }}</template>
      </p>
      <div v-else-if="drawer" class="flex items-center gap-3 rounded-shape-md bg-warning-container text-on-warning-container pl-3 pr-2 py-2">
        <IconWarning class="w-5 h-5 flex-none" aria-hidden="true" />
        <span class="flex-1 text-body-m">Drawer closed. Open it to take cash.</span>
        <AppButton variant="gold" @click="emit('open-drawer')">Open drawer</AppButton>
      </div>
    </div>

    <!-- Customer -->
    <div class="flex-none border-y border-outline-variant px-4 py-1 min-h-14 flex items-center">
      <div v-if="customer" class="flex items-center gap-3 w-full">
        <IconPerson class="w-6 h-6 flex-none text-on-surface-variant" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <div class="text-body-l text-on-surface truncate">{{ customer.name || customer.email }}</div>
          <div :class="['text-body-s truncate', isMember ? 'text-secondary' : 'text-on-surface-variant']">
            <template v-if="isMember">Member pricing · {{ memberDiscountRateBps(customer.membershipTier) / 100 }}% off Pro Shop</template>
            <template v-else>{{ customer.role === 'MEMBER' ? 'Membership expired' : 'Not a member' }}</template>
          </div>
        </div>
        <IconButton :icon="IconPersonRemove" label="Remove customer" tooltip @click="emit('remove-customer')" />
      </div>
      <AppButton v-else variant="text" :icon="IconPersonAdd" class="-ml-3" @click="emit('attach-customer')">Attach customer</AppButton>
    </div>

    <!-- Lines -->
    <div ref="linesEl" class="md:flex-1 md:min-h-0 md:overflow-y-auto overscroll-contain">
      <ul v-if="lines.length" class="divide-y divide-outline-variant">
        <li
          v-for="line in lines"
          :key="line.key"
          :data-line-key="line.key"
          :class="['cart-line pl-4 pr-1 pt-2 pb-1', line.key === highlightKey ? 'bg-gold-container' : '']"
        >
          <div class="flex items-start gap-3 pr-3">
            <div class="min-w-0 flex-1">
              <div class="text-body-l text-on-surface">{{ line.description }}</div>
              <div class="text-body-s text-on-surface-variant">
                <template v-if="line.booking && line.balanceCents">Pay at course: balance due · no tax</template>
                <template v-else-if="line.booking">Prepaid tee time</template>
                <template v-else-if="line.newBooking">Booked when the sale completes</template>
                <template v-else>
                  {{ line.quantity }} @ {{ formatCents(line.unitPriceCents) }}<template v-if="line.taxRateBps === 0"> · no tax</template>
                </template>
              </div>
              <!-- Automatic for active members; the Discount button is the manager's discount (needs approval) -->
              <div v-if="line.memberDiscountCents" class="text-body-s text-secondary">
                Member {{ line.memberDiscountBps / 100 }}% −{{ formatCents(line.memberDiscountCents) }}
              </div>
              <div v-if="line.managerDiscountCents" class="text-body-s text-secondary">
                Discount −{{ formatCents(line.managerDiscountCents) }}
              </div>
            </div>
            <span class="text-body-l text-on-surface tabular-nums pt-px">{{ formatCents(line.subtotalCents) }}</span>
          </div>
          <div class="flex items-center">
            <template v-if="!line.booking && !line.newBooking">
              <IconButton :icon="IconRemove" :label="`One fewer ${line.description}`" @click="emit('change-qty', line, -1)" />
              <span class="w-8 text-center text-title-m tabular-nums" aria-live="polite">{{ line.quantity }}</span>
              <IconButton :icon="IconAdd" :label="`One more ${line.description}`" @click="emit('change-qty', line, 1)" />
              <IconButton
                :icon="IconSell"
                :label="line.managerDiscountCents ? `Change the discount on ${line.description}` : `Discount ${line.description}`"
                :variant="line.managerDiscountCents ? 'tonal' : 'standard'"
                class="ml-auto"
                tooltip
                @click="emit('discount', line)"
              />
            </template>
            <IconButton
              :icon="IconDelete"
              :label="`Remove ${line.description}`"
              :class="line.booking || line.newBooking ? 'ml-auto' : ''"
              tooltip
              @click="emit('remove-line', line)"
            />
          </div>
        </li>
      </ul>
      <EmptyState v-else compact :icon="IconCart" title="No items yet" message="Scan or tap products to start a sale." />
    </div>

    <!-- Totals -->
    <div class="flex-none border-t border-outline-variant px-4 pt-3 pb-4 bg-surface-container">
      <dl class="text-body-m text-on-surface-variant space-y-0.5">
        <div v-if="memberDiscountTotal" class="flex justify-between text-secondary">
          <dt>Member discount</dt><dd class="tabular-nums">−{{ formatCents(memberDiscountTotal) }}</dd>
        </div>
        <div v-if="totals.discountCents - memberDiscountTotal" class="flex justify-between">
          <dt>Discounts</dt><dd class="tabular-nums">−{{ formatCents(totals.discountCents - memberDiscountTotal) }}</dd>
        </div>
        <div class="flex justify-between"><dt>Subtotal</dt><dd class="tabular-nums">{{ formatCents(totals.subtotalCents) }}</dd></div>
        <div class="flex justify-between">
          <dt>Tax ({{ (salesTaxBps / 100).toFixed(2) }}%)</dt><dd class="tabular-nums">{{ formatCents(totals.taxCents) }}</dd>
        </div>
        <div class="flex items-baseline justify-between pt-1 text-on-surface">
          <dt class="text-title-l">Total</dt>
          <dd class="font-display text-display-s tabular-nums">{{ formatCents(totals.totalCents) }}</dd>
        </div>
      </dl>

      <!-- Errors and notes sit above the buttons -->
      <ErrorBanner v-if="error" class="mt-3" :message="error" @dismiss="emit('dismiss-error')" />
      <p v-if="needsCustomer" class="mt-3 flex items-start gap-2 text-body-m text-on-surface">
        <IconInfo class="w-5 h-5 flex-none mt-px text-secondary" aria-hidden="true" />
        Attach the customer to sell a membership, so it goes on their account.
      </p>

      <div class="mt-3 flex gap-2">
        <IconButton
          :icon="IconClearCart"
          label="Clear the sale"
          variant="outlined"
          size="lg"
          class="!w-16 !h-16"
          tooltip
          :disabled="!lines.length"
          @click="emit('clear')"
        />
        <AppButton variant="gold" size="xl" class="flex-1 min-w-0" :disabled="!lines.length || needsCustomer" @click="emit('charge')">
          Charge {{ formatCents(totals.totalCents) }}
        </AppButton>
      </div>
    </div>
  </aside>
</template>

<script setup>
// The register's cart column: register name + icon toolbar (Recent sales, No sale, Account payment, overflow menu with
// End of day, the drawer actions and Change register), reader and drawer status, the customer, the lines (48dp
// qty ± / discount / remove), totals and Charge. The parent owns the sale; this only shows it and emits.
// Props: registerName, lines (priced lines from the parent), totals (saleTotals()), memberDiscountTotal, salesTaxBps,
// customer, isMember, drawer ({ session, last } | null), hasCardReader, readerOnline (true | false | null = unknown),
// isManager (End of day), highlightKey (line to flash and scroll to), needsCustomer, error.
// Emits: recent-sales, no-sale, account-payment, end-of-day, change-register, open-drawer, close-drawer,
// cash-movement(type), attach-customer, remove-customer, change-qty(line, delta), discount(line), remove-line(line),
// clear, charge, dismiss-error.
import { computed, nextTick, ref, watch } from 'vue'
import { formatCents } from '@/lib/money'
import { memberDiscountRateBps } from '@/lib/pricing'
import { COURSE_TZ } from '@/lib/timeclock'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconNoSale from '~icons/material-symbols/money-off-rounded'
import IconWallet from '~icons/material-symbols/account-balance-wallet-rounded'
import IconSummarize from '~icons/material-symbols/summarize-rounded'
import IconSwap from '~icons/material-symbols/swap-horiz-rounded'
import IconLockOpen from '~icons/material-symbols/lock-open-rounded'
import IconCalculate from '~icons/material-symbols/calculate-rounded'
import IconPaidIn from '~icons/material-symbols/move-to-inbox-rounded'
import IconPaidOut from '~icons/material-symbols/outbox-rounded'
import IconSafe from '~icons/material-symbols/savings-rounded'
import IconWifi from '~icons/material-symbols/wifi-rounded'
import IconWifiOff from '~icons/material-symbols/wifi-off-rounded'
import IconCard from '~icons/material-symbols/credit-card-rounded'
import IconCardOff from '~icons/material-symbols/credit-card-off-rounded'
import IconWarning from '~icons/material-symbols/warning-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'
import IconPersonAdd from '~icons/material-symbols/person-add-rounded'
import IconPersonRemove from '~icons/material-symbols/person-remove-rounded'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconRemove from '~icons/material-symbols/remove-rounded'
import IconSell from '~icons/material-symbols/sell-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'
import IconCart from '~icons/material-symbols/shopping-cart-rounded'
import IconClearCart from '~icons/material-symbols/remove-shopping-cart-rounded'
import IconInfo from '~icons/material-symbols/info-rounded'

const props = defineProps({
  registerName:        { type: String, default: '' },
  lines:               { type: Array, default: () => [] },
  totals:              { type: Object, required: true },
  memberDiscountTotal: { type: Number, default: 0 },
  salesTaxBps:         { type: Number, default: 0 },
  customer:            { type: Object, default: null },
  isMember:            { type: Boolean, default: false },
  drawer:              { type: Object, default: null },
  hasCardReader:       { type: Boolean, default: false },
  readerOnline:        { type: Boolean, default: null }, // null = unknown (no status from the API)
  isManager:           { type: Boolean, default: false },
  highlightKey:        { type: Number, default: null },
  needsCustomer:       { type: Boolean, default: false },
  error:               { type: String, default: null },
})
const emit = defineEmits([
  'recent-sales', 'no-sale', 'account-payment', 'end-of-day', 'change-register', 'open-drawer', 'close-drawer',
  'cash-movement', 'attach-customer', 'remove-customer', 'change-qty', 'discount', 'remove-line', 'clear', 'charge',
  'dismiss-error',
])

const linesEl = ref(null)

const readerChip = computed(() => {
  if (!props.hasCardReader) return { tone: 'neutral', icon: IconCardOff, label: 'No card reader' }
  if (props.readerOnline === true) return { tone: 'success', icon: IconWifi, label: 'Reader online' }
  if (props.readerOnline === false) return { tone: 'error', icon: IconWifiOff, label: 'Reader offline' }
  return { tone: 'neutral', icon: IconCard, label: 'Card reader' }
})

const menuItems = computed(() => {
  const open = !!props.drawer?.session
  return [
    open
      ? { label: 'Close drawer', icon: IconCalculate, onClick: () => emit('close-drawer') }
      : { label: 'Open drawer', icon: IconLockOpen, disabled: !props.drawer, onClick: () => emit('open-drawer') },
    // Paid in / paid out / safe drop: each needs a manager and prints a slip, which opens the drawer
    { label: 'Paid in', icon: IconPaidIn, disabled: !open, onClick: () => emit('cash-movement', 'PAID_IN') },
    { label: 'Paid out', icon: IconPaidOut, disabled: !open, onClick: () => emit('cash-movement', 'PAID_OUT') },
    { label: 'Safe drop', icon: IconSafe, disabled: !open, onClick: () => emit('cash-movement', 'SAFE_DROP') },
    ...(props.isManager ? [{ label: 'End of day (Z report)', icon: IconSummarize, onClick: () => emit('end-of-day') }] : []),
    { label: 'Change register', icon: IconSwap, onClick: () => emit('change-register') },
  ]
})

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}

// Scroll the line that was just added to into view (the parent sets highlightKey and clears it after a moment).
// Only where the cart is its own column (md+): on phones it's below the products and the page would jump.
watch(() => props.highlightKey, key => {
  if (key === null || !window.matchMedia('(min-width: 768px)').matches) return
  nextTick(() => linesEl.value?.querySelector(`[data-line-key="${key}"]`)?.scrollIntoView({ block: 'nearest' }))
})
</script>

<style scoped>
/* The just-added line's highlight fades out (no fade with reduced motion) */
.cart-line { transition: background-color 0.6s ease-out; }
@media (prefers-reduced-motion: reduce) { .cart-line { transition: none; } }
</style>
