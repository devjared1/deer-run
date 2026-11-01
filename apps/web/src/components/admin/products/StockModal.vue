<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-box max-w-2xl overflow-y-auto max-h-[92vh]">
      <h2 class="font-display font-bold text-bark mb-1">Stock · {{ product.name }}</h2>
      <p class="text-gray-400 text-xs font-body mb-4">Every change is logged with who made it and why.</p>

      <!-- Variant picker -->
      <div class="flex flex-wrap gap-2 mb-4">
        <button
          v-for="v in variants"
          :key="v.id"
          :class="['px-3 py-1.5 rounded-lg border text-sm font-body transition-colors',
            v.id === selectedId ? 'border-pine bg-pine text-parch' : 'border-gray-200 text-bark hover:bg-gray-50',
            !v.active && v.id !== selectedId ? 'opacity-50' : '']"
          @click="select(v.id)"
        >
          {{ variantLabel(v) }}
          <span :class="['ml-1 tabular-nums', v.id === selectedId ? 'text-parch/80' : stockClass(v.stockQty)]">{{ v.stockQty }}</span>
        </button>
      </div>

      <!-- Adjustment form -->
      <div class="bg-gray-50 rounded-lg p-4">
        <div class="flex gap-2 mb-3">
          <button
            v-for="m in modes"
            :key="m.value"
            :class="['px-3 py-1.5 rounded-lg text-sm font-body', adj.mode === m.value ? 'bg-gold text-bark font-semibold' : 'bg-white border border-gray-200 text-gray-600']"
            @click="setMode(m.value)"
          >
            {{ m.label }}
          </button>
        </div>
        <div class="grid sm:grid-cols-3 gap-3">
          <div>
            <label class="label-sm">{{ adj.mode === 'count' ? 'Counted On Hand' : 'Quantity' }}</label>
            <input v-model="adj.quantity" type="number" min="0" step="1" class="input-field w-full" />
          </div>
          <div>
            <label class="label-sm">Reason</label>
            <select v-model="adj.reason" class="input-field w-full">
              <option v-for="r in reasonsFor(adj.mode)" :key="r" :value="r">{{ reasonLabels[r] }}</option>
            </select>
          </div>
          <div>
            <label class="label-sm">Note</label>
            <input v-model="adj.note" type="text" class="input-field w-full" placeholder="Invoice #, etc." />
          </div>
        </div>
        <div class="flex items-center gap-3 mt-3">
          <button :disabled="saving || adj.quantity === ''" class="btn-amber px-4 py-2 text-sm disabled:opacity-50" @click="submit">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
          <span v-if="preview !== null" class="text-gray-500 text-sm font-body">
            {{ selected.stockQty }} → <strong class="text-bark">{{ preview }}</strong>
          </span>
        </div>
        <p v-if="error" class="text-red-500 text-xs mt-2">{{ error }}</p>
      </div>

      <!-- History -->
      <h3 class="font-display font-bold text-bark text-sm mt-5 mb-2">History</h3>
      <div v-if="loadingHistory" class="text-gray-400 text-sm">Loading…</div>
      <div v-else class="divide-y divide-gray-100 border border-gray-200 rounded-lg">
        <div v-for="h in history" :key="h.id" class="px-4 py-2 flex flex-wrap items-center gap-x-4 text-sm font-body">
          <span :class="['w-12 tabular-nums font-semibold', h.quantityChange >= 0 ? 'text-pine' : 'text-clay']">
            {{ h.quantityChange > 0 ? '+' : '' }}{{ h.quantityChange }}
          </span>
          <span class="text-gray-500 w-20 tabular-nums">→ {{ h.stockAfter }}</span>
          <span class="text-bark">{{ reasonLabels[h.reason] }}</span>
          <span v-if="h.note" class="text-gray-400">· {{ h.note }}</span>
          <span class="text-gray-400 text-xs ml-auto">{{ formatWhen(h.createdAt) }}<template v-if="h.by"> · {{ h.by }}</template></span>
        </div>
        <div v-if="!history.length" class="px-4 py-3 text-gray-400 text-sm">No stock changes yet.</div>
      </div>

      <div class="flex justify-end mt-5">
        <button class="btn-outline-sm" @click="$emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'
import { COURSE_TZ } from '@/lib/timeclock'

const props = defineProps({
  product: { type: Object, required: true },
})
const emit = defineEmits(['close', 'changed'])

const modes = [
  { value: 'add',    label: 'Receive / Add' },
  { value: 'remove', label: 'Remove' },
  { value: 'count',  label: 'Set Count' },
]
const reasonLabels = {
  INITIAL: 'Starting stock',
  RECEIVED: 'Received',
  COUNT_CORRECTION: 'Count correction',
  DAMAGED: 'Damaged / lost',
  RETURNED_TO_VENDOR: 'Returned to vendor',
  OTHER: 'Other',
}
const reasonsFor = (mode) => ({
  add: ['RECEIVED', 'OTHER'],
  remove: ['DAMAGED', 'RETURNED_TO_VENDOR', 'OTHER'],
  count: ['COUNT_CORRECTION'],
}[mode])

const variants = ref(props.product.variants.map(v => ({ ...v })))
const selectedId = ref(variants.value.find(v => v.active)?.id ?? variants.value[0]?.id)
const selected = computed(() => variants.value.find(v => v.id === selectedId.value))
const adj = ref({ mode: 'add', quantity: '', reason: 'RECEIVED', note: '' })
const history = ref([])
const loadingHistory = ref(false)
const saving = ref(false)
const error  = ref(null)

const preview = computed(() => {
  if (adj.value.quantity === '' || !selected.value) return null
  const q = Number(adj.value.quantity)
  if (!Number.isInteger(q)) return null
  return { add: selected.value.stockQty + q, remove: selected.value.stockQty - q, count: q }[adj.value.mode]
})

function variantLabel(v) {
  return [v.size, v.color].filter(Boolean).join(' / ') || 'Stock'
}

function stockClass(qty) {
  if (qty <= 0) return 'text-red-600'
  if (qty <= 3) return 'text-gold'
  return 'text-gray-500'
}

function formatWhen(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: COURSE_TZ })
}

function setMode(mode) {
  adj.value = { ...adj.value, mode, reason: reasonsFor(mode)[0] }
}

async function loadHistory() {
  if (!selectedId.value) return
  loadingHistory.value = true
  try {
    history.value = (await apiFetch(`/api/admin/inventory/${selectedId.value}`)).history
  } catch (e) {
    error.value = e.message
  } finally {
    loadingHistory.value = false
  }
}

function select(id) {
  selectedId.value = id
  error.value = null
  loadHistory()
}

async function submit() {
  saving.value = true
  error.value  = null
  try {
    const { stockQty } = await apiFetch(`/api/admin/inventory/${selectedId.value}`, {
      method: 'POST',
      body: { ...adj.value, quantity: Number(adj.value.quantity) },
    })
    selected.value.stockQty = stockQty
    adj.value = { ...adj.value, quantity: '', note: '' }
    emit('changed')
    await loadHistory()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(loadHistory)
</script>

<style scoped>
.modal-overlay  { @apply fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4; }
.modal-box      { @apply bg-white rounded-2xl shadow-2xl p-6 w-full; }
.input-field    { @apply border border-gray-300 rounded-lg px-3 py-2 text-sm font-body text-bark focus:outline-none focus:ring-2 focus:ring-pine/40; }
.label-sm       { @apply block text-xs text-gray-500 mb-1 font-body; }
.btn-outline-sm { @apply border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg font-body hover:bg-gray-50 transition-colors; }
</style>
