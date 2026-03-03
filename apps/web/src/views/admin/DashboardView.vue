<template>
  <div>
    <div v-if="loading" class="text-gray-400 text-sm">Loading dashboard…</div>
    <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

    <template v-else>
      <!-- Stat cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <div class="text-gray-400 text-xs font-body uppercase tracking-wider mb-1">Today's Bookings</div>
          <div class="text-3xl font-display font-bold text-bark">{{ data.today.bookings }}</div>
          <div class="text-gray-400 text-xs mt-1">{{ data.today.players }} players</div>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <div class="text-gray-400 text-xs font-body uppercase tracking-wider mb-1">7-Day Revenue</div>
          <div class="text-3xl font-display font-bold text-bark">${{ (data.week.revenueCents / 100).toFixed(0) }}</div>
          <div class="text-gray-400 text-xs mt-1">{{ data.week.confirmedBookings }} confirmed</div>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <div class="text-gray-400 text-xs font-body uppercase tracking-wider mb-1">Pending Bookings</div>
          <div class="text-3xl font-display font-bold text-clay">{{ data.pendingBookings }}</div>
          <div class="text-gray-400 text-xs mt-1">awaiting payment</div>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <div class="text-gray-400 text-xs font-body uppercase tracking-wider mb-1">Total Users</div>
          <div class="text-3xl font-display font-bold text-bark">{{ data.totalUsers }}</div>
          <div class="text-gray-400 text-xs mt-1">registered accounts</div>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-6">
        <!-- Recent bookings -->
        <div class="bg-white rounded-xl border border-gray-200">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 class="font-display font-bold text-bark text-sm">Recent Bookings</h2>
            <RouterLink to="/admin/bookings" class="text-xs text-lake hover:text-pine font-body">View all →</RouterLink>
          </div>
          <div class="divide-y divide-gray-50">
            <div v-for="b in data.recentBookings" :key="b.id" class="px-5 py-3 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="font-body text-sm text-bark truncate">{{ b.User?.name || b.guestName || 'Guest' }}</div>
                <div class="text-gray-400 text-xs">{{ b.TeeTimeSlot?.date }} at {{ b.TeeTimeSlot?.startTime }} · {{ b.players }} player{{ b.players !== 1 ? 's' : '' }}</div>
              </div>
              <span :class="statusClass(b.status)" class="text-xs px-2 py-0.5 rounded-full font-body flex-shrink-0">
                {{ b.status }}
              </span>
            </div>
            <div v-if="!data.recentBookings.length" class="px-5 py-6 text-gray-400 text-sm text-center">No bookings yet</div>
          </div>
        </div>

        <!-- Upcoming events -->
        <div class="bg-white rounded-xl border border-gray-200">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 class="font-display font-bold text-bark text-sm">Upcoming Tournaments</h2>
            <RouterLink to="/admin/tournaments" class="text-xs text-lake hover:text-pine font-body">Manage →</RouterLink>
          </div>
          <div class="divide-y divide-gray-50">
            <div v-for="e in data.upcomingEvents" :key="e.id" class="px-5 py-3 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="font-body text-sm text-bark truncate">{{ e.name }}</div>
                <div class="text-gray-400 text-xs">{{ formatDate(e.eventDate) }}</div>
              </div>
              <span v-if="e.featured" class="text-xs px-2 py-0.5 rounded-full bg-amber/20 text-amber font-body">Featured</span>
            </div>
            <div v-if="!data.upcomingEvents.length" class="px-5 py-6 text-gray-400 text-sm text-center">No upcoming events</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const loading = ref(true)
const error   = ref(null)
const data    = ref(null)

async function load() {
  loading.value = true
  error.value   = null
  try {
    const res = await fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    })
    if (!res.ok) throw new Error((await res.json()).error || res.statusText)
    data.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function statusClass(status) {
  return {
    PENDING:   'bg-yellow-100 text-yellow-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
    REFUNDED:  'bg-red-100 text-red-600',
  }[status] || 'bg-gray-100 text-gray-500'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(load)
</script>
