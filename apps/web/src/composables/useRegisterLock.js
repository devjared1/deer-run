// The register PC's lock screen state, shared by the staff shell (Switch cashier, the idle timer, the lock screen) and
// the register (no scanning while locked). Saved in localStorage so reloading the page doesn't unlock it.
//   const { locked, lock, unlock } = useRegisterLock()
import { ref } from 'vue'

const KEY = 'deerrun.registerLocked'

// The register locks itself after this long without a tap or key press
export const REGISTER_IDLE_LOCK_MINUTES = 10

function stored() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const locked = ref(stored())

function save(value) {
  locked.value = value
  try {
    if (value) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch { /* private mode: locked for this page only */ }
}

export function useRegisterLock() {
  return { locked, lock: () => save(true), unlock: () => save(false) }
}
