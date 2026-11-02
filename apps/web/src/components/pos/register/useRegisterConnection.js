// The register's connection and card reader status. Polls GET /api/staff/register/reader every 30 s (every 5 s while
// the connection is lost) and on the browser's online/offline events, so it notices when the internet drops even when
// the PC still has Wi-Fi (navigator.onLine only knows about the network adapter).
//   const { connectionLost, readerStatus, checking, checkNow, reportNetworkError } = useRegisterConnection(registerId, { onRestored })
// connectionLost: true once a check (or a sale request, through reportNetworkError) couldn't reach the server.
// readerStatus: 'online' | 'offline' | null (unknown), kept from the last answer while the connection is lost.
// onRestored: called once when the connection comes back (refresh the catalog and drawer).
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { apiFetch, isNetworkError } from '@/lib/api'

const POLL_MS = 30_000
const LOST_POLL_MS = 5_000

export function useRegisterConnection(registerId, { onRestored } = {}) {
  const connectionLost = ref(false)
  const readerStatus = ref(null)
  const checking = ref(false)
  let timer = null
  let seq = 0

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(checkNow, connectionLost.value ? LOST_POLL_MS : POLL_MS)
  }

  function markLost() {
    connectionLost.value = true
    schedule()
  }

  function markRestored() {
    if (!connectionLost.value) return
    connectionLost.value = false
    onRestored?.()
  }

  async function checkNow() {
    clearTimeout(timer)
    const id = registerId.value
    if (!id) {
      readerStatus.value = null
      return
    }
    const mine = ++seq
    checking.value = true
    try {
      const res = await apiFetch(`/api/staff/register/reader?registerId=${encodeURIComponent(id)}`)
      if (mine !== seq) return
      readerStatus.value = res.readerStatus ?? null
      markRestored()
    } catch (e) {
      if (mine !== seq) return
      // Any answer from the server (401, 404, 500) means the connection works; only "no answer" is lost
      if (isNetworkError(e)) connectionLost.value = true
      else markRestored()
    } finally {
      if (mine === seq) {
        checking.value = false
        schedule()
      }
    }
  }

  // A sale or other request from the register failed without an answer: show the banner now, not at the next poll
  function reportNetworkError(e) {
    if (isNetworkError(e)) markLost()
  }

  const onOffline = () => markLost()
  const onOnline = () => checkNow()
  // Background tabs throttle timers; check as soon as the register is in front again
  const onVisible = () => { if (document.visibilityState === 'visible') checkNow() }

  watch(registerId, () => { readerStatus.value = null; checkNow() })

  onMounted(() => {
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    if (!navigator.onLine) connectionLost.value = true
    checkNow()
  })

  onUnmounted(() => {
    clearTimeout(timer)
    seq++
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  })

  return { connectionLost, readerStatus, checking, checkNow, reportNetworkError }
}
