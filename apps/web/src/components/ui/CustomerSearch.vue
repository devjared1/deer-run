<template>
  <div class="relative font-body">
    <TextField
      ref="field"
      v-model="query"
      :label="label"
      :leading-icon="IconSearch"
      :helper="helperText"
      :disabled="disabled"
      :placeholder="placeholder || undefined"
      type="text"
      enterkeyhint="search"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      aria-autocomplete="list"
      :aria-expanded="String(showPopup)"
      :aria-controls="listId"
      :aria-activedescendant="open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined"
      @keydown="onKeydown"
      @focus="onFocus"
      @blur="open = false"
    >
      <template #trailing>
        <ProgressIndicator v-if="loading" :size="24" label="Searching" class="text-primary" />
        <IconButton v-else-if="query" :icon="IconClose" label="Clear search" @click="clear" />
      </template>
    </TextField>

    <div
      v-show="showPopup"
      class="absolute inset-x-0 top-14 z-10 mt-1 max-h-80 overflow-y-auto rounded-shape-xs bg-surface-container shadow-elevation-2 py-2"
      @mousedown.prevent
    >
      <ul v-if="results.length" :id="listId" role="listbox" :aria-label="label">
        <li
          v-for="(c, i) in results"
          :id="`${listId}-${i}`"
          :key="c.id"
          role="option"
          :aria-selected="String(i === activeIndex)"
          :class="[
            'state-layer flex items-center gap-3 min-h-14 px-4 py-2 cursor-pointer text-on-surface',
            i === activeIndex ? 'bg-on-surface/[.08]' : '',
          ]"
          @mousemove="activeIndex = i"
          @click="choose(c)"
        >
          <IconPerson class="w-6 h-6 flex-none text-on-surface-variant" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block text-body-l truncate">{{ c.name || c.email }}</span>
            <span v-if="c.name && c.email" class="block text-body-m text-on-surface-variant truncate">{{ c.email }}</span>
          </span>
          <span v-if="c.isMember" class="flex-none rounded-full bg-primary-container text-on-primary-container text-label-m px-2 py-0.5">Member</span>
        </li>
      </ul>
      <!-- An empty listbox keeps aria-controls pointing somewhere while a status shows -->
      <ul v-else :id="listId" role="listbox" :aria-label="label" class="hidden" />

      <div v-if="!results.length && loading" class="flex items-center gap-3 px-4 min-h-12 text-body-m text-on-surface-variant">
        <ProgressIndicator :size="20" /> Searching…
      </div>
      <div v-else-if="failed" class="flex flex-wrap items-center gap-x-3 px-4 py-1 text-body-m">
        <span class="flex items-center gap-2 text-error">
          <IconError class="w-5 h-5 flex-none" aria-hidden="true" />
          Couldn't search customers{{ error ? `: ${error}` : '' }}
        </span>
        <AppButton variant="text" @click="search(query)">Retry</AppButton>
      </div>
      <p v-else-if="searched && !results.length" class="px-4 min-h-12 flex items-center text-body-m text-on-surface-variant">
        No customers match “{{ searched }}”
      </p>
    </div>

    <span class="sr-only" role="status">{{ status }}</span>
  </div>
</template>

<script>
let uid = 0
</script>

<script setup>
// Customer search box: debounced (300ms) search over GET /api/staff/register/customers?search= (or `searchUrl`),
// results in a listbox (name, email, Member badge). Arrow keys move, Enter picks, Escape closes.
//   <CustomerSearch autofocus @select="c => sale.customer = c" />
// Props: searchUrl (gets `search=<term>` appended; must return an array of { id, name, email, isMember? }),
// label, placeholder, minChars (default 2), clearOnSelect (empty the box after a pick; otherwise it shows the
// name), disabled, autofocus.
// Emits select(customer) with the API's full object (the register endpoint includes houseAccount and role).
// Exposes focus() and clear().
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiFetch } from '../../lib/api.js'
import AppButton from './AppButton.vue'
import IconButton from './IconButton.vue'
import ProgressIndicator from './ProgressIndicator.vue'
import TextField from './TextField.vue'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'
import IconError from '~icons/material-symbols/error-rounded'

const props = defineProps({
  searchUrl:     { type: String, default: '/api/staff/register/customers' },
  label:         { type: String, default: 'Customer' },
  placeholder:   { type: String, default: 'Name or email' },
  minChars:      { type: Number, default: 2 },
  clearOnSelect: { type: Boolean, default: false },
  disabled:      { type: Boolean, default: false },
  autofocus:     { type: Boolean, default: false },
  // When the endpoint wraps the list in an object (e.g. /api/admin/users → { users }), the key holding the array
  resultsKey:    { type: String, default: '' },
})
const emit = defineEmits(['select'])

const listId = `customer-search-${++uid}`
const field = ref(null)
const query = ref('')
const results = ref([])
const loading = ref(false)
const failed = ref(false)
const error = ref('') // the API's message, when it had one
const searched = ref('') // the term the current results are for
const open = ref(false)
const activeIndex = ref(-1)
let timer = null
let requestNo = 0
let picked = '' // the text set by a pick, so it doesn't search again

const showPopup = computed(() => open.value && !!(results.value.length || loading.value || failed.value || searched.value))
const term = computed(() => query.value.trim())
const helperText = computed(() => (term.value && term.value.length < props.minChars ? `Type at least ${props.minChars} characters` : ''))
const status = computed(() => {
  if (loading.value) return 'Searching'
  if (failed.value) return "Couldn't search customers"
  if (!searched.value) return ''
  return results.value.length ? `${results.value.length} ${results.value.length === 1 ? 'customer' : 'customers'} found` : 'No customers found'
})

async function search(value) {
  const t = value.trim()
  const no = ++requestNo
  loading.value = true
  failed.value = false
  error.value = ''
  open.value = true
  try {
    const sep = props.searchUrl.includes('?') ? '&' : '?'
    const body = await apiFetch(`${props.searchUrl}${sep}search=${encodeURIComponent(t)}`)
    const data = props.resultsKey ? body?.[props.resultsKey] : body
    if (no !== requestNo) return
    if (!Array.isArray(data)) throw new Error('Unexpected response')
    results.value = data
    searched.value = t
    activeIndex.value = data.length ? 0 : -1
  } catch (e) {
    if (no !== requestNo) return
    results.value = []
    searched.value = ''
    failed.value = true
    // A proxy/HTML error page has no useful message; keep the text short
    error.value = e instanceof SyntaxError ? '' : e.message || ''
  } finally {
    if (no === requestNo) loading.value = false
  }
}

watch(term, t => {
  clearTimeout(timer)
  if (t === picked) return
  picked = ''
  if (t.length < props.minChars) {
    requestNo++
    loading.value = false
    failed.value = false
    error.value = ''
    results.value = []
    searched.value = ''
    open.value = false
    return
  }
  timer = setTimeout(() => search(t), 300)
})

function onFocus() {
  if (results.value.length || failed.value || searched.value) open.value = true
}

function choose(c) {
  emit('select', c)
  open.value = false
  picked = props.clearOnSelect ? '' : (c.name || c.email || '').trim()
  query.value = props.clearOnSelect ? '' : picked
}

function clear() {
  query.value = ''
  field.value?.focus()
}

function onKeydown(e) {
  const n = results.value.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) { open.value = !!(n || failed.value || searched.value); return }
    if (n) activeIndex.value = (activeIndex.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
  } else if (e.key === 'Enter') {
    if (open.value && activeIndex.value >= 0 && results.value[activeIndex.value]) {
      e.preventDefault()
      choose(results.value[activeIndex.value])
    }
  } else if (e.key === 'Escape') {
    if (open.value) {
      e.preventDefault()
      e.stopPropagation()
      open.value = false
    }
  }
}

watch(activeIndex, i => {
  if (i >= 0) document.getElementById(`${listId}-${i}`)?.scrollIntoView({ block: 'nearest' })
})

onMounted(() => { if (props.autofocus) field.value?.focus() })
onBeforeUnmount(() => clearTimeout(timer))

defineExpose({ focus: () => field.value?.focus(), clear })
</script>
