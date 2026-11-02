<template>
  <AppDialog
    :open="open"
    aria-label="Search the admin panel"
    size="md"
    initial-focus="#admin-search-input"
    @update:open="v => emit('update:open', v)"
    @after-leave="reset"
  >
    <div class="relative">
      <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-on-surface-variant pointer-events-none" aria-hidden="true" />
      <input
        id="admin-search-input"
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="admin-search-results"
        :aria-expanded="items.length ? 'true' : 'false'"
        :aria-activedescendant="active >= 0 ? `admin-search-item-${active}` : undefined"
        aria-describedby="admin-search-help"
        placeholder="Customers, receipt #, bookings, employees, pages"
        class="w-full h-14 pl-12 pr-4 rounded-shape-xs border border-outline bg-surface-container-lowest text-body-l text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:border-2 focus:outline-none"
        @keydown="onKeydown"
      >
    </div>
    <p id="admin-search-help" class="sr-only">Arrow keys move through the results, Enter opens one.</p>

    <div class="mt-3 min-h-[8rem] max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain -mx-2 px-2">
      <p v-if="error" class="text-body-m text-error px-2 py-3">{{ error }}</p>

      <ul v-if="items.length" id="admin-search-results" role="listbox" aria-label="Search results">
        <template v-for="(group, g) in groups" :key="group.title">
          <li role="presentation" :class="['px-2 pb-1 text-label-l text-on-surface-variant', g ? 'pt-3' : 'pt-1']">{{ group.title }}</li>
          <li
            v-for="item in group.items"
            :id="`admin-search-item-${item.index}`"
            :key="item.key"
            role="option"
            :aria-selected="item.index === active ? 'true' : 'false'"
            :class="[
              'state-layer flex items-center gap-3 min-h-14 px-2 rounded-shape-sm cursor-pointer',
              item.index === active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface',
            ]"
            @click="go(item)"
            @mousemove="active = item.index"
          >
            <component :is="item.icon" class="flex-none w-6 h-6" aria-hidden="true" />
            <span class="flex-1 min-w-0">
              <span class="block text-body-l truncate">{{ item.label }}</span>
              <span v-if="item.sub" class="block text-body-s text-on-surface-variant truncate">{{ item.sub }}</span>
            </span>
          </li>
        </template>
      </ul>

      <p v-else-if="loading" class="flex items-center gap-2 px-2 py-3 text-body-m text-on-surface-variant">
        <ProgressIndicator :size="20" label="Searching" /> Searching…
      </p>
      <p v-else-if="query.trim().length >= 2" class="px-2 py-3 text-body-m text-on-surface-variant" role="status">
        Nothing matches “{{ query.trim() }}”.
      </p>
      <p v-else class="px-2 py-3 text-body-m text-on-surface-variant">
        Type a name, email, receipt number or booking reference, or the page you want.
        <span class="block mt-1 text-body-s">Open this from anywhere with Ctrl+K (⌘K on a Mac) or /.</span>
      </p>
    </div>
  </AppDialog>
</template>

<script setup>
// The admin search (Ctrl+K / ⌘K / "/" or the search button in the admin top bar): customers, receipts, bookings and
// employees from GET /api/admin/search, plus the admin pages by name. A combobox: arrow keys move through the
// results, Enter opens one. Props: open (v-model:open), pages ([{ label, group, to, icon }], the admin nav items).
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { formatCents } from '@/lib/money'
import { teeTime } from '@/lib/teesheet'
import { formatLocalDate, toUtcIso } from '@/lib/timeclock'
import { positionLabel } from '@/data/employeePositions'
import { statusInfo } from '@/components/ui/statusChips'
import AppDialog from '@/components/ui/AppDialog.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'
import IconReceipt from '~icons/material-symbols/receipt-long-rounded'
import IconBookOnline from '~icons/material-symbols/book-online-rounded'
import IconBadge from '~icons/material-symbols/badge-rounded'

const props = defineProps({
  open:  { type: Boolean, default: false },
  pages: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:open'])
const router = useRouter()

const query   = ref('')
const results = ref(null)
const loading = ref(false)
const error   = ref(null)
const active  = ref(-1)

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const shortDate = iso => new Date(toUtcIso(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })

const groups = computed(() => {
  const term = query.value.trim().toLowerCase()
  const out = []
  const r = results.value
  if (r?.customers.length) {
    out.push({ title: 'Customers', items: r.customers.map(c => ({
      key: `c${c.id}`, icon: IconPerson, label: c.name || c.email,
      sub: [c.name ? c.email : '', statusInfo('role', c.role).label].filter(Boolean).join(' · '),
      to: `/admin/users/${c.id}`,
    })) })
  }
  if (r?.sales.length) {
    out.push({ title: 'Receipts', items: r.sales.map(s => ({
      key: `s${s.id}`, icon: IconReceipt, label: `Receipt #${s.number}`,
      sub: [formatCents(s.totalCents), shortDate(s.createdAt), s.customerName].filter(Boolean).join(' · '),
      to: { path: '/admin/sales', query: { sale: s.id } },
    })) })
  }
  if (r?.bookings.length) {
    out.push({ title: 'Bookings', items: r.bookings.map(b => ({
      key: `b${b.id}`, icon: IconBookOnline, label: `${b.name} · ${b.reference}`,
      sub: [b.slot ? `${formatLocalDate(b.slot.date)}, ${teeTime(b.slot.startTime)}` : '', plural(b.players, 'player'),
        statusInfo('booking', b.status).label].filter(Boolean).join(' · '),
      to: b.userId ? `/admin/users/${b.userId}` : { path: '/admin/bookings', query: { search: b.reference } },
    })) })
  }
  if (r?.employees.length) {
    out.push({ title: 'Employees', items: r.employees.map(e => ({
      key: `e${e.id}`, icon: IconBadge, label: `${e.firstName} ${e.lastName}`.trim(),
      sub: [positionLabel(e.position), e.active ? '' : 'Inactive'].filter(Boolean).join(' · '),
      to: '/admin/employees',
    })) })
  }
  const pages = term ? props.pages.filter(p => `${p.label} ${p.group ?? ''}`.toLowerCase().includes(term)) : []
  if (pages.length) {
    out.push({ title: 'Pages', items: pages.map(p => ({ key: `p${p.to}`, icon: p.icon, label: p.label, sub: p.group, to: p.to })) })
  }
  // One running index across the groups, for the keyboard and aria-activedescendant
  let i = 0
  return out.map(g => ({ ...g, items: g.items.map(item => ({ ...item, index: i++ })) }))
})
const items = computed(() => groups.value.flatMap(g => g.items))

watch(items, list => { active.value = list.length ? 0 : -1 })

let timer = null
let seq = 0
watch(query, q => {
  clearTimeout(timer)
  error.value = null
  if (q.trim().length < 2) {
    results.value = null
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const res = await apiFetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`)
      if (mine === seq) results.value = res
    } catch (e) {
      if (mine === seq) error.value = e.message
    } finally {
      if (mine === seq) loading.value = false
    }
  }, 250)
})

function onKeydown(e) {
  const n = items.value.length
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    active.value = (active.value + 1) % n
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
  } else if (e.key === 'Enter' && active.value >= 0) {
    e.preventDefault()
    go(items.value[active.value])
  } else {
    return
  }
  document.getElementById(`admin-search-item-${active.value}`)?.scrollIntoView({ block: 'nearest' })
}

function go(item) {
  emit('update:open', false)
  router.push(item.to)
}

function reset() {
  query.value = ''
  results.value = null
  error.value = null
  active.value = -1
}
</script>
