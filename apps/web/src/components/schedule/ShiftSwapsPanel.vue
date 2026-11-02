<template>
  <section
    v-if="offers.length || error"
    aria-labelledby="swaps-title"
    class="rounded-shape-md border border-outline-variant bg-surface-container-low print:hidden"
  >
    <button
      type="button"
      class="state-layer flex items-center gap-3 w-full min-h-12 px-4 rounded-shape-md text-left"
      :aria-expanded="String(expanded)"
      aria-controls="swaps-list"
      @click="expanded = !expanded"
    >
      <IconSwap class="w-5 h-5 flex-none text-primary" aria-hidden="true" />
      <span id="swaps-title" class="flex-1 text-label-l text-on-surface">
        Shift swaps<template v-if="toApprove"> · {{ toApprove }} to approve</template><template v-if="openCount"> · {{ openCount }} up for grabs</template>
      </span>
      <IconExpand :class="['w-6 h-6 flex-none transition-transform duration-short-4', expanded ? 'rotate-180' : '']" aria-hidden="true" />
    </button>

    <div v-show="expanded" id="swaps-list" class="px-4 pb-4">
      <ErrorBanner v-if="error" class="mb-3" :message="error" @retry="load" />
      <ul class="divide-y divide-outline-variant">
        <li v-for="o in offers" :key="o.id" class="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="flex-1 min-w-[14rem]">
            <p class="text-body-l text-on-surface">{{ when(o.shift) }}</p>
            <p class="text-body-m text-on-surface-variant">
              <template v-if="o.status === 'CLAIMED'">
                {{ name(o.claimedBy) }} wants to take {{ o.posted ? 'this open shift' : `${name(o.offeredBy)}'s shift` }}
              </template>
              <template v-else>
                {{ o.posted ? `Open shift (on ${name(o.offeredBy)}'s schedule until someone picks it up)` : `${name(o.offeredBy)} offered it` }}, nobody yet
              </template>
              <template v-if="o.note"> · “{{ o.note }}”</template>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <template v-if="o.status === 'CLAIMED'">
              <AppButton variant="filled" :icon="IconCheck" :loading="busy === `${o.id}:approve`" :disabled="!!busy" @click="decide(o, 'approve')">Approve</AppButton>
              <AppButton variant="text-danger" :icon="IconClose" :loading="busy === `${o.id}:deny`" :disabled="!!busy" @click="decide(o, 'deny')">Deny</AppButton>
            </template>
            <AppButton v-else variant="text" :icon="IconRemove" :loading="busy === `${o.id}:cancel`" :disabled="!!busy" @click="decide(o, 'cancel')">
              Take down
            </AppButton>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
// Admin → Schedule: shift swaps and open shifts waiting on a manager (GET /api/admin/shift-offers). Picked-up shifts can
// be approved (the shift moves to the coworker; both are emailed) or denied; open ones taken down. Emits `changed`
// after an approval, so the schedule reloads. Exposes load() (after posting an open shift). Starts expanded with
// `initiallyOpen` (the dashboard's "to approve" link: /admin/schedule?swaps=1).
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '@/lib/api'
import { formatLocalDate } from '@/lib/timeclock'
import { longTime } from '@/lib/schedule'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import IconSwap from '~icons/material-symbols/swap-horiz-rounded'
import IconExpand from '~icons/material-symbols/expand-more-rounded'
import IconCheck from '~icons/material-symbols/check-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconRemove from '~icons/material-symbols/do-not-disturb-on-outline-rounded'

const props = defineProps({
  initiallyOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])
const confirm  = useConfirm()
const snackbar = useSnackbar()

const offers   = ref([])
const error    = ref(null)
const busy     = ref(null)
const expanded = ref(props.initiallyOpen)

const toApprove = computed(() => offers.value.filter(o => o.status === 'CLAIMED').length)
const openCount = computed(() => offers.value.filter(o => o.status === 'OPEN').length)

const name = p => (p ? `${p.firstName} ${p.lastName}`.trim() : 'Someone')
const when = s => `${formatLocalDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${longTime(s.startTime)} – ${longTime(s.endTime)}`

async function load() {
  error.value = null
  try {
    offers.value = (await apiFetch('/api/admin/shift-offers')).offers
    if (toApprove.value && props.initiallyOpen) expanded.value = true
  } catch (e) {
    error.value = e.message
  }
}

async function decide(o, action) {
  if (action !== 'approve') {
    const ok = await confirm({
      title: action === 'deny' ? `Deny ${name(o.claimedBy)} taking this shift?` : 'Take this offer down?',
      message: action === 'deny'
        ? `${when(o.shift)} stays with ${name(o.offeredBy)}. Both are emailed.`
        : `${when(o.shift)} stays on ${name(o.offeredBy)}'s schedule.`,
      confirmLabel: action === 'deny' ? 'Deny' : 'Take down',
      destructive: action === 'deny',
    })
    if (!ok) return
  }
  busy.value = `${o.id}:${action}`
  try {
    const res = await apiFetch(`/api/admin/shift-offers/${o.id}`, { method: 'PUT', body: { action } })
    const done = { approve: `${when(o.shift)} is now ${name(o.claimedBy)}'s shift`, deny: 'Swap denied', cancel: 'Offer taken down' }[action]
    snackbar.show(res.emailErrors?.length ? { message: `${done}, but an email didn't send: ${res.emailErrors[0]}`, tone: 'error' } : done)
    if (action === 'approve') emit('changed')
    await load()
  } catch (e) {
    snackbar.show({ message: e.message, tone: 'error' })
  } finally {
    busy.value = null
  }
}

onMounted(load)
defineExpose({ load })
</script>
