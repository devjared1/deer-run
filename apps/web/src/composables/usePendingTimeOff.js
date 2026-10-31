import { ref } from 'vue'
import { apiFetch } from '@/lib/api'

// Shared across the admin layout (sidebar badge) and the Time Off page, which refreshes it after a decision
const pending = ref(0)

export function usePendingTimeOff() {
  async function refresh() {
    try {
      pending.value = (await apiFetch('/api/admin/time-off/count')).pending
    } catch {
      // The badge is a convenience; leave the last value if the count can't load
    }
  }
  return { pending, refresh }
}
