// Focus return for modal overlays built on Headless UI Dialog (AppDialog, BottomSheet).
//
// Headless UI's own restore runs while the page behind is still inert, so focus falls to <body> when a dialog closes.
// This remembers what had focus when `open()` turned true and, once the overlay is gone, focuses it again, but only
// if focus was lost (a parent that focuses something itself, like the register's scan field, wins).
//
//   const restoreFocus = useFocusReturn(() => props.open)
//   <TransitionRoot … @after-leave="restoreFocus(); emit('after-leave')">
// It also restores when the component unmounts while open (`:open="true"` dialogs that a parent v-if removes).
import { onBeforeUnmount, watch } from 'vue'

export function useFocusReturn(open) {
  let returnTo = null

  watch(open, (isOpen) => {
    if (!isOpen) return
    const active = document.activeElement
    returnTo = active && active !== document.body ? active : null
  }, { immediate: true, flush: 'sync' })

  function restoreFocus() {
    const el = returnTo
    returnTo = null
    if (!el) return
    let tries = 0
    const attempt = () => {
      const active = document.activeElement
      if (active && active !== document.body) return
      if (!el.isConnected) return
      // The page behind may still be inert for a moment after the overlay unmounts
      if (el.closest('[inert]') && ++tries < 5) { setTimeout(attempt, 50); return }
      el.focus({ preventScroll: true })
    }
    setTimeout(attempt, 0)
  }

  onBeforeUnmount(() => { if (open()) restoreFocus() })
  return restoreFocus
}
