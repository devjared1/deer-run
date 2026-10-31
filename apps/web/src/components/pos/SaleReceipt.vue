<template>
  <div class="receipt">
    <div class="center">
      <div class="title">Deer Run Golf Course</div>
      <div>1175 County Road 100</div>
      <div>Moulton, AL 35650</div>
      <div>(256) 974-7384</div>
    </div>
    <div class="rule" />

    <div class="row"><span>Receipt #{{ sale.number }}</span><span>{{ when }}</span></div>
    <div>{{ sale.register?.name }} · {{ sale.cashier?.firstName }}</div>
    <div v-if="sale.customer">
      {{ sale.customer.name || sale.customer.email }}<template v-if="sale.isMemberPricing"> (Member)</template>
    </div>
    <div class="rule" />

    <div v-for="item in sale.items" :key="item.id" class="item">
      <div class="row">
        <span>{{ item.quantity }} × {{ item.description }}</span>
        <span>{{ money(item.unitPriceCents * item.quantity) }}</span>
      </div>
      <div v-if="item.quantity > 1" class="sub">@ {{ money(item.unitPriceCents) }} each</div>
      <!-- discountCents is the member and manager discounts together; memberDiscountCents is the member part -->
      <div v-if="item.memberDiscountCents" class="row sub"><span>Member discount</span><span>−{{ money(item.memberDiscountCents) }}</span></div>
      <div v-if="item.discountCents - (item.memberDiscountCents ?? 0)" class="row sub">
        <span>Discount</span><span>−{{ money(item.discountCents - (item.memberDiscountCents ?? 0)) }}</span>
      </div>
      <div v-if="item.taxRateBps === 0" class="sub">Not taxed</div>
    </div>
    <div class="rule" />

    <div class="row"><span>Subtotal</span><span>{{ money(sale.subtotalCents) }}</span></div>
    <div class="row"><span>Tax</span><span>{{ money(sale.taxCents) }}</span></div>
    <div class="row total"><span>Total</span><span>{{ money(sale.totalCents) }}</span></div>
    <div class="rule" />

    <div v-for="p in sale.payments" :key="p.id" class="row">
      <span>{{ paymentLabel(p.method) }}</span>
      <span>{{ money(p.tenderedCents ?? p.amountCents) }}</span>
    </div>
    <div v-if="sale.changeCents" class="row"><span>Change</span><span>{{ money(sale.changeCents) }}</span></div>
    <template v-if="tipCents">
      <div class="row"><span>Tip</span><span>{{ money(tipCents) }}</span></div>
      <div class="row total"><span>Total with tip</span><span>{{ money(sale.totalCents + tipCents) }}</span></div>
    </template>
    <div v-if="!sale.payments.length" class="center sub">No payment due</div>

    <div class="rule" />
    <div class="center">Thank you for visiting Deer Run!</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COURSE_TZ } from '@/lib/timeclock'

const props = defineProps({
  sale: { type: Object, required: true },
})

const PAYMENT_LABELS = {
  CASH: 'Cash',
  CARD_TERMINAL: 'Card',
  HOUSE_ACCOUNT: 'House account',
  PREPAID_ONLINE: 'Paid online',
  GIFT_CARD: 'Gift card',
}

const when = computed(() => new Date(props.sale.createdAt).toLocaleString('en-US', {
  month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ,
}))

// Tips added on the card reader are on the card payment (tipCents), on top of the sale total
const tipCents = computed(() => props.sale.payments.reduce((sum, p) => sum + (p.tipCents ?? 0), 0))

const money = (cents) => `$${(cents / 100).toFixed(2)}`
const paymentLabel = (method) => PAYMENT_LABELS[method] ?? method
</script>

<style scoped>
/* Sized for 80 mm thermal paper (about 72 mm printable) */
.receipt { width: 72mm; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; background: #fff; }
.center  { text-align: center; }
.title   { font-weight: bold; font-size: 14px; }
.rule    { border-top: 1px dashed #000; margin: 6px 0; }
.row     { display: flex; justify-content: space-between; gap: 8px; }
.row > span:first-child { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.row > span:last-child  { white-space: nowrap; }
.sub     { padding-left: 12px; font-size: 10px; }
.item    { margin-bottom: 3px; }
.total   { font-weight: bold; font-size: 13px; }
</style>
