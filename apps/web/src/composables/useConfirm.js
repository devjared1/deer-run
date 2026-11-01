// Promise-based confirmation dialog. One <ConfirmDialog /> host (mounted once in App.vue) shows the requests one at
// a time, in order:
//
//   const confirm = useConfirm()
//   if (await confirm({ title: 'Delete shift?', message: "This can't be undone.", confirmLabel: 'Delete', destructive: true })) …
//   if (await confirm('Discard your changes?')) …   // a string is the message
//
// Options: title, message, confirmLabel ('Confirm'), cancelLabel ('Cancel'), destructive (error-colored confirm button,
// Cancel gets the initial focus), icon (component). Resolves true on confirm, false on Cancel / Esc / backdrop.
import { reactive, ref } from 'vue'

// Pending requests: the host renders queue[0] and shifts it after its exit animation
export const confirmQueue = reactive([])

// Only one host renders, so a second <ConfirmDialog /> (e.g. the gallery's own) doesn't show every request twice
export const confirmHost = ref(null)

export function useConfirm() {
  return function confirm(options) {
    const opts = typeof options === 'string' ? { message: options } : { ...options }
    return new Promise(resolve => {
      confirmQueue.push({
        title: opts.title ?? '',
        message: opts.message ?? '',
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        destructive: !!opts.destructive,
        icon: opts.icon ?? null,
        resolve,
      })
    })
  }
}
