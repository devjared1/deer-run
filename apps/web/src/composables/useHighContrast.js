import { ref, watch } from 'vue'

// High-contrast mode for pages used outdoors (On Course, Tee Sheet): darker text and outlines and heavier weights,
// via data-contrast="high" on the page container (tokens.css). One setting for the device, remembered in
// localStorage; shared by every page that uses it.
//   const { highContrast, toggleHighContrast } = useHighContrast()
//   <div :data-contrast="highContrast ? 'high' : undefined"> … <Switch v-model="highContrast" label="High contrast" />
const KEY = 'deer-run:high-contrast'

function read() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

const highContrast = ref(read())
watch(highContrast, (on) => {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* private mode: not remembered */ }
})

export function useHighContrast() {
  return { highContrast, toggleHighContrast: () => { highContrast.value = !highContrast.value } }
}
