<template>
  <div class="modal-overlay" @click.self="!busy && $emit('close')">
    <div class="modal-box max-w-md">
      <h2 class="font-display font-bold text-bark mb-4">
        House account payment
      </h2>

      <!-- Who's paying -->
      <template v-if="!member">
        <label class="label-sm">Member</label>
        <input v-model="search" type="text" class="input-field w-full" placeholder="Search name or email" @input="find">
        <ul v-if="results.length" class="border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100 max-h-56 overflow-y-auto">
          <li v-for="u in results" :key="u.id">
            <button
              class="w-full text-left px-3 py-2 text-sm font-body hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
              :disabled="!u.houseAccount || u.houseAccount.status === 'CLOSED'"
              @click="choose(u)"
            >
              {{ u.name || u.email }}
              <span class="text-xs text-gray-400">
                {{ u.houseAccount ? `owes ${formatCents(u.houseAccount.balanceCents)}` : 'no house account' }}
              </span>
            </button>
          </li>
        </ul>
      </template>

      <template v-else>
        <div class="flex items-start justify-between gap-3 bg-gray-50 rounded-lg px-4 py-3 mb-4 font-body">
          <div>
            <div class="font-semibold text-bark">
              {{ member.name || member.email }}
            </div>
            <div class="text-sm text-gray-500">
              Balance {{ formatCents(member.houseAccount.balanceCents) }}
            </div>
          </div>
          <button class="text-xs text-lake hover:text-pine" :disabled="busy" @click="member = null">
            Change
          </button>
        </div>

        <label class="label-sm">Payment ($)</label>
        <input v-model="amount" type="number" min="0.01" step="0.01" class="input-field w-full text-lg tabular-nums">

        <div class="grid grid-cols-2 gap-2 mt-4">
          <button :class="['method-btn', method === 'CASH' ? 'border-pine bg-pine text-parch' : 'border-gray-300 text-bark hover:bg-gray-50']" @click="method = 'CASH'">
            Cash
          </button>
          <button
            :class="['method-btn', method === 'CARD' ? 'border-pine bg-pine text-parch' : cardBlocked ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300 text-bark hover:bg-gray-50']"
            :disabled="!!cardBlocked"
            :title="cardBlocked || ''"
            @click="method = 'CARD'"
          >
            Card
          </button>
        </div>

        <template v-if="method === 'CASH'">
          <label class="label-sm mt-3">Cash received ($)</label>
          <input v-model="tendered" type="number" min="0" step="0.01" class="input-field w-full tabular-nums" :placeholder="amount">
          <p v-if="changeCents > 0" class="text-pine text-sm font-body mt-1">
            Change: <strong>{{ formatCents(changeCents) }}</strong>
          </p>
        </template>
      </template>

      <p v-if="error" class="text-red-500 text-sm font-body mt-3">
        {{ error }}
      </p>
      <div class="flex justify-end gap-3 mt-5">
        <button class="btn-outline-sm" :disabled="busy" @click="$emit('close')">
          Cancel
        </button>
        <button class="btn-amber px-5 py-2 text-sm disabled:opacity-50" :disabled="!canSubmit || busy" @click="submit">
          {{ busy ? 'Working…' : method === 'CARD' ? 'Charge Card' : 'Take Payment' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatCents, dollarsToCents } from '@/lib/money'

const props = defineProps({
  registerId:  { type: String, required: true },
  customer:    { type: Object, default: null }, // the customer attached to the sale, if they have an account
  cardBlocked: { type: String, default: null },
})
// done: { accountPayment, changeCents, member } (cash) · card: { cardCheckout, member, amountCents } (card on the reader)
const emit = defineEmits(['done', 'card', 'close'])

const member   = ref(props.customer?.houseAccount ? props.customer : null)
const search   = ref('')
const results  = ref([])
const amount   = ref(member.value ? (Math.max(0, member.value.houseAccount.balanceCents) / 100).toFixed(2) : '')
const method   = ref('CASH')
const tendered = ref('')
const busy     = ref(false)
const error    = ref(null)
let timer = null

const amountCents   = computed(() => dollarsToCents(amount.value) || 0)
const tenderedCents = computed(() => (tendered.value === '' ? amountCents.value : dollarsToCents(tendered.value) || 0))
const changeCents   = computed(() => Math.max(0, tenderedCents.value - amountCents.value))
const canSubmit = computed(() => member.value && amountCents.value > 0 &&
  (method.value === 'CARD' ? amountCents.value >= 50 : tenderedCents.value >= amountCents.value))

function find() {
  clearTimeout(timer)
  const term = search.value.trim()
  if (term.length < 2) { results.value = []; return }
  timer = setTimeout(async () => {
    try {
      results.value = await apiFetch(`/api/staff/register/customers?${new URLSearchParams({ search: term })}`)
    } catch (e) {
      error.value = e.message
    }
  }, 250)
}

function choose(u) {
  member.value = u
  amount.value = (Math.max(0, u.houseAccount.balanceCents) / 100).toFixed(2)
}

async function submit() {
  busy.value  = true
  error.value = null
  try {
    const res = await apiFetch('/api/staff/account-payments', {
      method: 'POST',
      body: {
        registerId: props.registerId,
        accountId: member.value.houseAccount.id,
        amountCents: amountCents.value,
        method: method.value,
        tenderedCents: method.value === 'CASH' ? tenderedCents.value : undefined,
      },
    })
    if (res.cardCheckout) emit('card', { cardCheckout: res.cardCheckout, member: member.value, amountCents: amountCents.value })
    else emit('done', { accountPayment: res.accountPayment, changeCents: res.changeCents, member: member.value })
  } catch (e) {
    error.value = e.message
    if (e.code === 'DRAWER_CLOSED') emit('close', { drawerClosed: true })
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.method-btn     { @apply border rounded-lg py-2 text-sm font-body font-semibold; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors disabled:opacity-40; }
@media print { .modal-overlay { display: none !important; } }
</style>
