<template>
  <AppDialog
    :open="true"
    title="Manager approval"
    :icon="IconManager"
    size="lg"
    persistent
    initial-focus="[data-autofocus]"
  >
    <div class="font-body">
      <p class="text-center text-body-l text-on-surface mb-4">{{ title }}</p>

      <div v-if="loading" class="flex items-center justify-center gap-3 py-8 text-body-m text-on-surface-variant">
        <ProgressIndicator :size="24" class="text-primary" /> Loading managers…
      </div>

      <template v-else>
        <ErrorBanner
          v-if="!managers.length && !loadError"
          tone="warning"
          message="No manager has set a PIN yet. A manager can set one under Staff → Manager PIN."
          class="mb-4"
        />

        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] items-start">
          <!-- Who's approving: one big button per manager. Toggle buttons, not radios: picking one moves focus to
               the keypad, so there's no arrow-key radio group to promise -->
          <div
            v-if="managers.length"
            role="group"
            aria-label="Manager"
            class="grid grid-cols-1 gap-2 sm:max-h-[24rem] sm:overflow-y-auto"
          >
            <button
              v-for="m in managers"
              :key="m.id"
              type="button"
              :aria-pressed="String(managerId === m.id)"
              :class="[
                'state-layer flex items-center gap-3 min-h-16 px-4 rounded-shape-lg border text-left text-title-m cursor-pointer',
                managerId === m.id
                  ? 'bg-secondary-container text-on-secondary-container border-transparent'
                  : 'border-outline text-on-surface',
              ]"
              @mousedown.prevent
              @click="pick(m)"
            >
              <component :is="managerId === m.id ? IconCheck : IconPerson" class="w-6 h-6 flex-none" aria-hidden="true" />
              <span class="min-w-0 truncate">{{ m.firstName }} {{ m.lastName }}</span>
            </button>
          </div>

          <div class="w-full max-w-[22rem] mx-auto sm:w-[22rem] rounded-shape-lg bg-surface-container-lowest p-2">
            <NumericKeypad
              ref="keypad"
              v-model="pin"
              data-autofocus
              label="PIN"
              :hint="managerId ? `${managerName} types their PIN` : 'Pick your name first'"
              masked
              :max-length="6"
              :disabled="!managers.length"
              @submit="approve"
            />
          </div>
        </div>
      </template>

      <ErrorBanner v-if="error" :message="error" class="mt-4" />
    </div>

    <template #actions>
      <AppButton variant="outlined" size="xl" :disabled="busy" @click="$emit('cancel')">Cancel</AppButton>
      <AppButton size="xl" :disabled="!managerId || pin.length < 4" :loading="busy" @click="approve">
        {{ busy ? 'Checking…' : 'Approve' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Manager sign-off at the register: big name buttons (GET /api/staff/register/managers) and a masked PIN keypad
// (Enter or Approve submits). POST /api/staff/approvals { action, managerId, pin, registerId, reason } returns a
// single-use approval. A wrong PIN clears the keypad and shows the error above the buttons.
//   <ApprovalModal action="REFUND" title="Refund $12.00 on sale #1042" :register-id="registerId" @approved="go" @cancel="stop" />
// Props: action, title (what's being approved), registerId, reason. Emits approved(approval) and cancel.
import { ref, computed, onMounted, nextTick } from 'vue'
import { apiFetch } from '@/lib/api'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import NumericKeypad from '@/components/ui/NumericKeypad.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import ProgressIndicator from '@/components/ui/ProgressIndicator.vue'
import IconManager from '~icons/material-symbols/shield-person-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'
import IconCheck from '~icons/material-symbols/check-circle-rounded'

const props = defineProps({
  action: { type: String, required: true },
  title: { type: String, required: true },
  registerId: { type: String, default: null },
  reason: { type: String, default: null },
})
const emit = defineEmits(['approved', 'cancel'])

const managers  = ref([])
const managerId = ref('')
const pin       = ref('')
const loading   = ref(true)
const loadError = ref(false)
const busy      = ref(false)
const error     = ref(null)
const keypad    = ref(null)

const managerName = computed(() => {
  const m = managers.value.find(x => x.id === managerId.value)
  return m ? m.firstName : ''
})

function pick(m) {
  managerId.value = m.id
  keypad.value?.focus()
}

async function approve() {
  if (busy.value) return
  if (!managerId.value) { error.value = 'Pick the manager who is approving.'; return }
  if (pin.value.length < 4) return
  busy.value  = true
  error.value = null
  try {
    const approval = await apiFetch('/api/staff/approvals', {
      method: 'POST',
      body: { action: props.action, managerId: managerId.value, pin: pin.value, registerId: props.registerId, reason: props.reason },
    })
    emit('approved', approval)
  } catch (e) {
    error.value = e.message
    pin.value = ''
    nextTick(() => keypad.value?.focus())
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    managers.value = await apiFetch('/api/staff/register/managers')
    if (managers.value.length === 1) managerId.value = managers.value[0].id
  } catch (e) {
    loadError.value = true
    error.value = e.message
  } finally {
    loading.value = false
    nextTick(() => keypad.value?.focus())
  }
})
</script>
