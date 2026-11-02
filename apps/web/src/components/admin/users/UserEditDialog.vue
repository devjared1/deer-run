<template>
  <AppDialog :open="!!user" title="Edit user" persistent @update:open="v => { if (!v) emit('close') }">
    <template v-if="user">
      <p class="mb-4 text-body-m text-on-surface-variant break-words">
        <template v-if="user.name">{{ user.name }} · </template>{{ user.email }}
      </p>
      <form id="user-form" class="space-y-5" @submit.prevent="save">
        <RadioGroup
          v-model="newRole"
          label="Role"
          :options="ROLES.map(r => ({ value: r, label: statusInfo('role', r).label, description: ROLE_DESC[r] }))"
        />
        <div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <TextField v-model="membership.until" type="date" label="Member until" />
          <SelectField
            v-model="membership.tier"
            label="Tier"
            placeholder="None"
            :options="membershipTiers.map(t => ({ value: t.name, label: t.name }))"
          />
        </div>
        <p class="-mt-2 text-body-s text-on-surface-variant">
          Last day of membership. Leave it empty for no end date. Memberships sold at the register set this
          automatically; members drop to Guest after it passes.
        </p>
      </form>
      <ErrorBanner v-if="formError" class="mt-4" :message="formError" />
    </template>
    <template #actions="{ close }">
      <AppButton variant="text" @click="close">Cancel</AppButton>
      <AppButton type="submit" form="user-form" :loading="saving" :disabled="!changed">Save</AppButton>
    </template>
  </AppDialog>
</template>

<script setup>
// Edit a user's role and membership (PUT /api/admin/users/:id), with a confirmation before making someone an admin and
// Undo on the snackbar. Used by Admin → Users and the customer page.
// Props: user ({ id, name, email, role, memberUntil, membershipTier } or null = closed).
// Emits: close, saved (after a save or an undo: reload).
import { computed, ref, watch } from 'vue'
import { apiFetch } from '@/lib/api'
import { membershipTiers } from '@/data/membershipTiers'
import { useConfirm } from '@/composables/useConfirm'
import { useSnackbar } from '@/composables/useSnackbar'
import { statusInfo } from '@/components/ui/statusChips.js'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import ErrorBanner from '@/components/ui/ErrorBanner.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'

const props = defineProps({
  user: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const confirm  = useConfirm()
const snackbar = useSnackbar()

const ROLES = ['GUEST', 'MEMBER', 'ADMIN']
const ROLE_DESC = {
  GUEST:  'Limited access, no member pricing',
  MEMBER: 'Extended booking window + member-only slots',
  ADMIN:  'Full admin panel access',
}

const newRole    = ref('')
const membership = ref({ until: '', tier: null })
const saving     = ref(false)
const formError  = ref(null)

watch(() => props.user, user => {
  if (!user) return
  newRole.value = user.role
  membership.value = { until: user.memberUntil ?? '', tier: user.membershipTier ?? null }
  formError.value = null
}, { immediate: true })

const changed = computed(() => !!props.user && (newRole.value !== props.user.role ||
  membership.value.until !== (props.user.memberUntil ?? '') || (membership.value.tier ?? '') !== (props.user.membershipTier ?? '')))

const putUser = (id, body) => apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body })

async function save() {
  const user = props.user
  if (!user || !changed.value) return
  const who = user.name || user.email
  if (newRole.value === 'ADMIN' && user.role !== 'ADMIN' && !(await confirm({
    title: `Make ${who} an admin?`,
    message: "They'll get full access to the admin panel.",
    confirmLabel: 'Make admin',
  }))) return

  saving.value = true
  formError.value = null
  try {
    await putUser(user.id, {
      ...(newRole.value !== user.role ? { role: newRole.value } : {}),
      memberUntil: membership.value.until || null,
      membershipTier: membership.value.tier || null,
    })
    emit('close')
    // Undo puts the old role and membership back through the same API
    const before = { role: user.role, memberUntil: user.memberUntil ?? null, membershipTier: user.membershipTier ?? null }
    const roleChanged = newRole.value !== user.role
    snackbar.show({
      message: `Saved ${who}`,
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          await putUser(user.id, roleChanged ? before : { memberUntil: before.memberUntil, membershipTier: before.membershipTier })
          snackbar.show(`Restored ${who}`)
          emit('saved')
        } catch (e) {
          snackbar.show({ message: `Couldn't undo: ${e.message}`, tone: 'error' })
        }
      },
    })
    emit('saved')
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>
