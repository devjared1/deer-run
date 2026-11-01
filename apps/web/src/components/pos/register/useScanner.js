// Document-level barcode scanner buffer for the register. A USB scanner "types" the code very fast (keys under
// ~30ms apart) and ends with Enter, so a burst like that is a scan wherever focus is, as long as nobody is typing in
// a field. The search field handles scans itself while it has focus (its own Enter), so this only covers the rest:
// focus on a button, the page body, or the "Sale complete" dialog.
//
//   useScanner(code => lookup(code), { canScan: () => !anyDialogOpen.value || saleCompleteOpen.value })
//
// canScan() is asked on the Enter that ends a burst; when it says no, the keys go through untouched. A recognised scan
// stops the Enter (capture phase), so it doesn't also click the focused button (e.g. Done / New sale).
import { onBeforeUnmount, onMounted } from 'vue'

const MAX_GAP_MS = 30     // between the characters of one scan
const ENTER_GAP_MS = 100  // last character → Enter (some scanners pause a little before the suffix)
const MIN_LENGTH = 3

function isTyping(el) {
  if (!el || el === document.body) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  if (el.tagName !== 'INPUT') return false
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type)
}

export function useScanner(onScan, { canScan = () => true } = {}) {
  let buffer = ''
  let last = 0

  function onKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (isTyping(document.activeElement)) {
      buffer = ''
      return
    }
    const gap = e.timeStamp - last
    if (e.key === 'Enter') {
      const code = buffer
      buffer = ''
      if (code.length >= MIN_LENGTH && gap <= ENTER_GAP_MS && canScan()) {
        e.preventDefault()
        e.stopPropagation()
        onScan(code)
      }
      return
    }
    if (e.key.length !== 1) return // Shift, Tab, arrows…
    buffer = gap <= MAX_GAP_MS ? buffer + e.key : e.key
    last = e.timeStamp
  }

  onMounted(() => window.addEventListener('keydown', onKeydown, true))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
}
