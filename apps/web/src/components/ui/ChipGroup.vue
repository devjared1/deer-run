<template>
  <div
    ref="root"
    :role="type === 'choice' ? 'radiogroup' : 'group'"
    :aria-label="label || undefined"
    :class="[
      'flex gap-2',
      scroll ? 'flex-nowrap overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1' : 'flex-wrap',
      size === 'lg' ? 'py-1' : 'py-2',
    ]"
    @keydown="onKeydown"
  >
    <FilterChip
      v-for="(o, i) in options"
      :key="String(o.value)"
      :kind="type"
      :size="size"
      :label="o.label"
      :icon="o.icon"
      :selected="isSelected(o)"
      :disabled="disabled || !!o.disabled"
      :tabindex="type === 'choice' && i !== tabIndexAt ? -1 : 0"
      @click="toggle(o)"
    />
  </div>
</template>

<script setup>
// A row of chips. type "filter" (default): any number selected, v-model is an array, each chip is aria-pressed.
// type "choice": exactly one selected, v-model is the value, a radiogroup with arrow-key navigation.
//   <ChipGroup v-model="categoryId" type="choice" scroll size="lg" label="Category" :options="categories" />
// Props: modelValue, options [{ value, label, icon?, disabled? }], type, scroll (one horizontally scrolling row,
// no wrap: phones and the register category row), size md | lg (48px, POS), label (accessible name), disabled,
// allowEmpty (choice: tapping the selected chip clears it to null).
import { computed, nextTick, ref } from 'vue'
import FilterChip from './FilterChip.vue'

const props = defineProps({
  modelValue: { type: [String, Number, Boolean, Array], default: null },
  options:    { type: Array, default: () => [] },
  type:       { type: String, default: 'filter', validator: v => ['filter', 'choice'].includes(v) },
  scroll:     { type: Boolean, default: false },
  size:       { type: String, default: 'md', validator: v => ['md', 'lg'].includes(v) },
  label:      { type: String, default: '' },
  disabled:   { type: Boolean, default: false },
  allowEmpty: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null)

const isDisabled = o => props.disabled || !!o.disabled
const isSelected = o => (props.type === 'filter' ? (props.modelValue || []).includes(o.value) : props.modelValue === o.value)

const tabIndexAt = computed(() => {
  const sel = props.options.findIndex(o => isSelected(o) && !isDisabled(o))
  return sel >= 0 ? sel : props.options.findIndex(o => !isDisabled(o))
})

function toggle(o) {
  if (props.type === 'choice') {
    emit('update:modelValue', props.allowEmpty && isSelected(o) ? null : o.value)
    return
  }
  const list = props.modelValue || []
  emit('update:modelValue', list.includes(o.value) ? list.filter(v => v !== o.value) : [...list, o.value])
}

function onKeydown(e) {
  if (props.type !== 'choice') return
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  if (!step) return
  e.preventDefault()
  const enabled = props.options.map((o, i) => i).filter(i => !isDisabled(props.options[i]))
  if (!enabled.length) return
  const next = enabled[(enabled.indexOf(tabIndexAt.value) + step + enabled.length) % enabled.length]
  emit('update:modelValue', props.options[next].value)
  nextTick(() => {
    const el = root.value?.children[next]
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}
</script>
