<template>
  <div class="page-enter">
    <PageHero
      label="My Account"
      title-html="Your <em>Bookings</em>"
    />

    <section class="topo py-12">
      <div class="max-w-4xl mx-auto px-5">

        <!-- User info strip -->
        <div class="card rounded-lg p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#1E3D2F;">
              {{ authStore.profile?.name || authStore.profile?.email || 'Member' }}
            </div>
            <div style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.45);margin-top:2px;">
              {{ roleLabel }} · {{ authStore.profile?.email }}
            </div>
          </div>
          <button @click="logout" class="btn-outline-pine" style="padding:8px 18px;font-size:12px;">Sign Out</button>
        </div>

        <!-- Upcoming bookings -->
        <div class="mb-12">
          <SectionLabel text="Upcoming Tee Times" class="mb-5" />

          <div v-if="loading" class="text-center py-10" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.4);">Loading…</div>

          <div v-else-if="upcomingBookings.length === 0" class="card rounded-lg p-8 text-center">
            <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.45);margin-bottom:16px;">No upcoming tee times.</p>
            <RouterLink to="/book" class="btn-amber inline-flex">Book a Tee Time</RouterLink>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="b in upcomingBookings"
              :key="b.id"
              class="card rounded-lg p-6 flex items-center justify-between flex-wrap gap-4"
            >
              <div class="flex items-center gap-5">
                <div class="flex-shrink-0 w-14 text-center rounded" style="background:#1E3D2F;padding:6px 4px;">
                  <div style="font-family:'Lato',sans-serif;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(196,135,58,.8);">{{ formatMonth(b.teeTimeSlot.date) }}</div>
                  <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:900;color:#F2EBD9;line-height:1;">{{ formatDay(b.teeTimeSlot.date) }}</div>
                </div>
                <div>
                  <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#1E3D2F;">{{ formatTime(b.teeTimeSlot.startTime) }}</div>
                  <div style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);margin-top:2px;">
                    {{ b.players }} player{{ b.players > 1 ? 's' : '' }} · ${{ (b.totalCents / 100).toFixed(0) }} · Cart included
                  </div>
                  <span
                    class="inline-block mt-1 px-2 py-0.5 rounded tier-badge"
                    :style="b.status === 'CONFIRMED'
                      ? 'background:rgba(30,61,47,.1);color:#1E3D2F;'
                      : 'background:rgba(196,135,58,.15);color:#A06E28;'"
                  >{{ b.status }}</span>
                </div>
              </div>
              <button
                v-if="canCancel(b)"
                @click="cancelBooking(b.id)"
                :disabled="cancelling === b.id"
                class="btn-outline-pine"
                style="padding:8px 16px;font-size:12px;border-color:rgba(140,74,47,.3);color:#8C4A2F;"
              >
                {{ cancelling === b.id ? 'Cancelling…' : 'Cancel' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Past bookings -->
        <div v-if="!loading && pastBookings.length > 0">
          <SectionLabel text="Past Tee Times" class="mb-5" />
          <div class="space-y-3">
            <div
              v-for="b in pastBookings"
              :key="b.id"
              class="card rounded-lg p-5 flex items-center gap-5 opacity-60"
            >
              <div class="flex-shrink-0 w-12 text-center rounded" style="background:rgba(61,43,26,.1);padding:4px;">
                <div style="font-family:'Lato',sans-serif;font-size:9px;font-weight:900;text-transform:uppercase;color:rgba(61,43,26,.5);">{{ formatMonth(b.teeTimeSlot.date) }}</div>
                <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:#3D2B1A;line-height:1;">{{ formatDay(b.teeTimeSlot.date) }}</div>
              </div>
              <div>
                <div style="font-family:'Lato',sans-serif;font-size:14px;font-weight:700;color:#3D2B1A;">{{ formatTime(b.teeTimeSlot.startTime) }}</div>
                <div style="font-family:'Lato',sans-serif;font-size:12px;color:rgba(61,43,26,.45);">
                  {{ b.players }} player{{ b.players > 1 ? 's' : '' }} · {{ b.status }}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter }    from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PageHero         from '@/components/layout/PageHero.vue'
import SectionLabel     from '@/components/ui/SectionLabel.vue'

const router    = useRouter()
const authStore = useAuthStore()

const bookings   = ref([])
const loading    = ref(true)
const cancelling = ref(null)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const roleLabel = computed(() =>
  authStore.profile?.role === 'ADMIN' ? 'Admin' : 'Member'
)

const now = new Date()
now.setHours(0, 0, 0, 0)

const upcomingBookings = computed(() =>
  bookings.value.filter((b) => {
    const d = new Date(b.teeTimeSlot.date)
    return d >= now && !['CANCELLED', 'REFUNDED'].includes(b.status)
  })
)

const pastBookings = computed(() =>
  bookings.value.filter((b) => {
    const d = new Date(b.teeTimeSlot.date)
    return d < now || ['CANCELLED', 'REFUNDED'].includes(b.status)
  })
)

function canCancel(b) {
  const slotDate = new Date(b.teeTimeSlot.date)
  const msUntil  = slotDate.getTime() - Date.now()
  return ['PENDING', 'CONFIRMED'].includes(b.status) && msUntil > 24 * 60 * 60 * 1000
}

function formatMonth(date) { return MONTHS[new Date(date).getUTCMonth()] }
function formatDay(date)   { return new Date(date).getUTCDate() }
function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

async function cancelBooking(id) {
  cancelling.value = id
  try {
    const res = await fetch(`/api/bookings/${id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (res.ok) {
      const idx = bookings.value.findIndex((b) => b.id === id)
      if (idx !== -1) bookings.value[idx].status = 'CANCELLED'
    }
  } finally {
    cancelling.value = null
  }
}

async function logout() {
  await authStore.logout()
  router.push('/')
}

onMounted(async () => {
  try {
    const res = await fetch('/api/bookings/my', {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (res.ok) bookings.value = await res.json()
  } finally {
    loading.value = false
  }
})
</script>
