<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-4">
      <SegmentedButton v-model="role" label="Role" :options="roleOptions" />
      <SegmentedButton v-model="clockState" label="Clock" :options="clockOptions" />
    </div>
    <p class="text-body-m text-on-surface-variant">
      Current page: <code>{{ page }}</code>{{ registerMode ? ' (register mode: full-bleed, rail at lg+)' : '' }}.
      The breakpoints follow the window width, not this box. URL: <code>&amp;role=register&amp;page=/staff/register&amp;clock=on</code>.
    </p>

    <div
      class="relative overflow-hidden rounded-shape-md border border-outline-variant h-[680px]"
      style="transform: translateZ(0)"
    >
      <StaffLayout
        :key="role"
        v-model:preview-path="page"
        contained
        :register-mode="registerMode"
        :clock="clockData"
      >
        <div v-if="registerMode" class="h-full grid lg:grid-cols-[1fr_24rem]" aria-hidden="true">
          <div class="p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            <div v-for="n in 12" :key="n" class="h-24 rounded-shape-md bg-surface-container-high" />
          </div>
          <div class="hidden lg:block bg-surface-container-low border-l border-outline-variant p-4 space-y-3">
            <div v-for="n in 6" :key="n" class="h-6 rounded-full bg-surface-container-highest" />
          </div>
        </div>
        <div v-else class="space-y-3 max-w-3xl" aria-hidden="true">
          <div class="h-8 w-1/2 rounded-full bg-surface-container-highest" />
          <div v-for="n in 18" :key="n" :class="['h-4 rounded-full bg-surface-container-high', n % 3 === 0 ? 'w-2/3' : 'w-full']" />
        </div>
      </StaffLayout>
    </div>
  </div>
</template>

<script>
export default {
  galleryTitle: 'Staff shell (preview)',
  galleryNote: 'StaffLayout with a fake employee profile (dev only): bottom bar below md, rail md–lg, drawer at lg+. Nav clicks change the preview page instead of navigating.',
}
</script>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import StaffLayout from '@/views/staff/StaffLayout.vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'

const router = useRouter()
const auth = useAuthStore()
const params = new URLSearchParams(location.search)

const roleOptions = [
  { value: 'staff', label: 'Staff' },
  { value: 'course', label: 'Course' },
  { value: 'register', label: 'Register' },
  { value: 'admin', label: 'Manager + admin' },
]
const clockOptions = [
  { value: 'on', label: 'On' },
  { value: 'break', label: 'Break' },
  { value: 'off', label: 'Off' },
  { value: 'error', label: 'Failed' },
]

const role = ref(roleOptions.some(o => o.value === params.get('role')) ? params.get('role') : 'register')
const page = ref(params.get('page') || '/staff/schedule')
const clockState = ref(clockOptions.some(o => o.value === params.get('clock')) ? params.get('clock') : 'on')

const PROFILES = {
  staff:    { position: 'GROUNDS_CREW', canUseRegister: false, canTrackCourse: false, isRegisterManager: false, role: 'GUEST' },
  course:   { position: 'PLAYER_ASSISTANT', canUseRegister: false, canTrackCourse: true, isRegisterManager: false, role: 'GUEST' },
  register: { position: 'PRO_SHOP_ATTENDANT', canUseRegister: true, canTrackCourse: true, isRegisterManager: false, role: 'GUEST' },
  admin:    { position: 'GENERAL_MANAGER', canUseRegister: true, canTrackCourse: true, isRegisterManager: true, role: 'ADMIN' },
}

// Dev-only: a fake signed-in employee for the preview; the real profile comes back when the gallery unmounts
const savedProfile = auth.profile
watch(role, r => {
  const p = PROFILES[r]
  auth.profile = {
    id: 'preview', email: 'preview@example.com', role: p.role,
    canUseRegister: p.canUseRegister, canTrackCourse: p.canTrackCourse, isRegisterManager: p.isRegisterManager,
    employee: { id: 'preview-employee', firstName: 'Jordan', lastName: 'Smith', position: p.position, active: true },
  }
}, { immediate: true })
onBeforeUnmount(() => { auth.profile = savedProfile })

// Register mode from the route meta (the router's staff routes), else /staff/register
const registerMode = computed(() => router.resolve(page.value).meta?.registerMode ?? page.value === '/staff/register')

const clockData = computed(() => {
  const now = Date.now()
  const iso = ms => new Date(ms).toISOString()
  if (clockState.value === 'error') return {}
  if (clockState.value === 'off') return { status: 'off', openEntry: null, serverTime: iso(now) }
  const clockIn = now - (3 * 60 + 12) * 60000
  const breaks = clockState.value === 'break'
    ? [{ startedAt: iso(now - 8 * 60000), endedAt: null }]
    : [{ startedAt: iso(now - 120 * 60000), endedAt: iso(now - 100 * 60000) }]
  return { status: clockState.value, openEntry: { clockIn: iso(clockIn - (clockState.value === 'on' ? 20 * 60000 : 0)), clockOut: null, breaks }, serverTime: iso(now) }
})
</script>
