// Global snackbar. One <AppSnackbar /> host (mounted once in App.vue) shows the messages one at a time:
//
//   const snackbar = useSnackbar()
//   snackbar.show('Saved')
//   snackbar.show({ message: 'Shift deleted', actionLabel: 'Undo', onAction: restore })
//   snackbar.show({ message: 'Could not save', tone: 'error' })
//
// Options: message, actionLabel + onAction, icon (component), tone 'default' | 'error' (announced assertively),
// duration in ms (default 4000; at least 6000 with an action; 0 keeps it until closed).
// show() returns { dismiss }; snackbar.dismiss() closes the current one, snackbar.clear() drops the queue too.
import { reactive, ref } from 'vue'

export const snackbarQueue = reactive([])

// Only one host renders (a second <AppSnackbar /> stays empty)
export const snackbarHost = ref(null)

let nextId = 1

function normalize(options) {
  const opts = typeof options === 'string' ? { message: options } : { ...options }
  const hasAction = !!(opts.actionLabel && opts.onAction)
  let duration = opts.duration ?? (hasAction ? 6000 : 4000)
  if (hasAction && duration > 0) duration = Math.max(duration, 6000)
  return {
    id: nextId++,
    message: opts.message ?? '',
    actionLabel: hasAction ? opts.actionLabel : '',
    onAction: hasAction ? opts.onAction : null,
    icon: opts.icon ?? null,
    tone: opts.tone === 'error' ? 'error' : 'default',
    duration,
  }
}

export function dismissSnackbar(id) {
  const i = id == null ? 0 : snackbarQueue.findIndex(s => s.id === id)
  if (i >= 0 && snackbarQueue.length) snackbarQueue.splice(i, 1)
}

const api = {
  show(options) {
    const item = normalize(options)
    snackbarQueue.push(item)
    return { dismiss: () => dismissSnackbar(item.id) }
  },
  dismiss: () => dismissSnackbar(),
  clear: () => snackbarQueue.splice(0),
}

export function useSnackbar() {
  return api
}
