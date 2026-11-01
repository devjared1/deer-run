// The tee set the visitor is looking at (an index into data/teeSets.js), shared by the scorecard and the hole pages
// and remembered in this browser (a convenience only: it falls back to the default tee).
import { ref, watch } from 'vue'
import { defaultTeeIndex, teeSets } from '@/data/teeSets'

const KEY = 'deerrun.tee'

function load() {
  try {
    const i = teeSets.findIndex(t => t.name === localStorage.getItem(KEY))
    return i >= 0 ? i : defaultTeeIndex
  } catch {
    return defaultTeeIndex
  }
}

const teeIndex = ref(load())
watch(teeIndex, (i) => {
  try { localStorage.setItem(KEY, teeSets[i].name) } catch { /* storage blocked */ }
})

export function useSelectedTee() {
  return teeIndex
}
