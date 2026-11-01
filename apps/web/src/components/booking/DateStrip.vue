<template>
  <ul
    ref="row"
    aria-label="Dates"
    class="flex gap-2 overflow-x-auto overscroll-x-contain snap-x pb-2 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden font-body"
    @keydown="onKeydown"
  >
    <li v-for="(d, i) in days" :key="d.ymd" class="snap-start flex-shrink-0">
      <button
        type="button"
        :tabindex="i === tabIndexAt ? 0 : -1"
        :aria-pressed="String(d.ymd === modelValue)"
        :aria-disabled="d.disabled ? 'true' : undefined"
        :aria-label="d.aria"
        :class="[
          'state-layer w-[4.5rem] min-h-24 py-2 rounded-shape-md flex flex-col items-center justify-center gap-0.5',
          'transition-colors duration-short-4 ease-standard',
          d.disabled ? 'bg-surface-container text-on-surface/[.38] cursor-not-allowed'
          : d.ymd === modelValue ? 'bg-primary text-on-primary cursor-pointer'
            : 'bg-surface-container-lowest text-on-surface border border-outline-variant cursor-pointer',
        ]"
        @click="pick(d)"
      >
        <span class="text-label-m" aria-hidden="true">{{ d.weekday }}</span>
        <span class="text-title-l tabular-nums leading-none" aria-hidden="true">{{ d.day }}</span>
        <span class="text-label-s" aria-hidden="true">{{ d.month }}</span>
        <span
          v-if="d.hint"
          :class="['text-label-s mt-0.5', d.ymd === modelValue ? 'text-on-primary' : d.disabled ? '' : 'text-on-surface-variant']"
          aria-hidden="true"
        >{{ d.hint }}</span>
      </button>
    </li>
  </ul>
</template>

<script setup>
// Horizontal day strip for the booking Date step on phones: one 72×96dp tile per bookable day (weekday, day,
// month, availability hint). One tab stop; arrows / Home / End move focus, Enter or Space picks the day.
import { addDays, formatLocalDate, localDate } from '@/lib/timeclock'
import { computed, nextTick, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: null },
  min:        { type: String, required: true },
  max:        { type: String, required: true },
  dayInfo:    { type: Function, required: true },
})
const emit = defineEmits(['select'])
const row = ref(null)
const today = localDate()

const days = computed(() => {
  const list = []
  for (let d = props.min; d <= props.max; d = addDays(d, 1)) {
    const info = props.dayInfo(d)
    const long = formatLocalDate(d, { weekday: 'long', month: 'long', day: 'numeric' })
    list.push({
      ymd: d,
      weekday: d === today ? 'Today' : formatLocalDate(d, { weekday: 'short' }),
      day: Number(d.slice(8)),
      month: formatLocalDate(d, { month: 'short' }),
      hint: info.hint,
      disabled: !!info.disabled,
      aria: [d === today ? `Today, ${long}` : d === addDays(today, 1) ? `Tomorrow, ${long}` : long, info.aria].filter(Boolean).join(', '),
    })
  }
  return list
})

const focusAt = ref(-1)
const tabIndexAt = computed(() => {
  if (focusAt.value >= 0) return focusAt.value
  const sel = days.value.findIndex(d => d.ymd === props.modelValue)
  return sel >= 0 ? sel : Math.max(0, days.value.findIndex(d => !d.disabled))
})

function pick(d) {
  if (d.disabled) return
  emit('select', d.ymd)
}

function onKeydown(e) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  const edge = { Home: 0, End: days.value.length - 1 }[e.key]
  if (step === undefined && edge === undefined) return
  e.preventDefault()
  const next = edge ?? Math.min(days.value.length - 1, Math.max(0, tabIndexAt.value + step))
  focusAt.value = next
  nextTick(() => {
    const el = row.value?.children[next]?.querySelector('button')
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

// Start with the chosen day in view
onMounted(() => {
  const i = days.value.findIndex(d => d.ymd === props.modelValue)
  if (i > 2) row.value?.children[i]?.scrollIntoView({ block: 'nearest', inline: 'center' })
})
</script>
