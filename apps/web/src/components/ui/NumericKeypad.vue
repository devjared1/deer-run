<template>
  <div
    ref="root"
    role="group"
    :aria-label="label || 'Keypad'"
    :aria-describedby="hint ? hintId : undefined"
    :tabindex="disabled ? -1 : 0"
    class="w-full max-w-[22rem] font-body rounded-shape-lg focus-visible:outline-offset-4"
    @keydown="onKeydown"
  >
    <!-- Display row -->
    <div class="mb-3 rounded-shape-md bg-surface-container-highest px-4 py-3">
      <div v-if="label" class="text-label-l text-on-surface-variant">{{ label }}</div>
      <div
        class="min-h-10 text-headline-m font-display tabular-nums text-on-surface truncate"
        aria-live="polite"
      >
        <span v-if="!modelValue && placeholder" class="text-on-surface-variant">{{ placeholder }}</span>
        <template v-else-if="masked">
          <span class="tracking-[.3em]" aria-hidden="true">{{ '•'.repeat(modelValue.length) }}</span>
          <span class="sr-only">{{ modelValue.length }} {{ modelValue.length === 1 ? 'digit' : 'digits' }} entered</span>
        </template>
        <template v-else>{{ format ? format(modelValue) : modelValue }}</template>
      </div>
      <p v-if="hint" :id="hintId" :class="['text-body-s', error ? 'text-error' : 'text-on-surface-variant']">{{ hint }}</p>
    </div>

    <!-- Keys don't take focus (mousedown.prevent): the group keeps it, so the physical keyboard keeps working and
         the register PC doesn't pop its touch keyboard -->
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="k in keys"
        :key="k.id"
        type="button"
        tabindex="-1"
        :aria-label="k.aria"
        :disabled="disabled || !k.id.trim()"
        :class="[
          'state-layer flex items-center justify-center h-16 rounded-shape-lg select-none transition-colors duration-short-2',
          k.kind === 'digit' ? 'text-headline-s tabular-nums' : 'text-title-m',
          !k.id.trim() ? 'invisible' : '',
          disabled ? 'bg-on-surface/[.12] text-on-surface/[.38] cursor-not-allowed' : k.kind === 'digit' ? 'bg-surface-container-lowest border border-outline-variant text-on-surface cursor-pointer' : 'bg-secondary-container text-on-secondary-container cursor-pointer',
        ]"
        @mousedown.prevent
        @click="press(k.id)"
      >
        <IconBackspace v-if="k.id === 'back'" class="w-7 h-7" aria-hidden="true" />
        <template v-else>{{ k.text }}</template>
      </button>
    </div>

    <AppButton
      v-if="submitLabel"
      class="mt-3"
      size="xl"
      block
      :variant="submitVariant"
      :disabled="disabled || !modelValue"
      :loading="loading"
      tabindex="-1"
      @mousedown.prevent
      @click="submit"
    >
      {{ submitLabel }}
    </AppButton>
  </div>
</template>

<script>
let uid = 0
</script>

<script setup>
// Big 3×4 touch keypad (64px keys) that types into a v-model string, for PINs, cash tendered and drawer counts.
// Focus it (or set `autofocus`) and the physical keyboard works too: digits, Backspace, Delete/Escape (clear),
// "." when leftKey is ".", Enter (submit).
//   <NumericKeypad v-model="pin" label="Manager PIN" masked :max-length="6" submit-label="Approve" @submit="approve" />
//   <NumericKeypad v-model="cents" label="Cash tendered" left-key="00" :format="v => formatCents(Number(v))" />
// Props: modelValue (string of what was typed), label, leftKey 'clear' | '00' | '.' | 'none', maxLength, masked (dots,
// for PINs), format (fn: value → display text), placeholder, hint (text under the display), error (hint in error
// color), submitLabel (adds a submit button; Enter submits either way), submitVariant (AppButton variant, default
// filled), loading, disabled, autofocus.
// Emits update:modelValue and submit(value) (only when not empty). Exposes focus().
import { computed, onMounted, ref } from 'vue'
import AppButton from './AppButton.vue'
import IconBackspace from '~icons/material-symbols/backspace-outline-rounded'

const props = defineProps({
  modelValue:    { type: String, default: '' },
  label:         { type: String, default: '' },
  leftKey:       { type: String, default: 'clear', validator: v => ['clear', '00', '.', 'none'].includes(v) },
  maxLength:     { type: Number, default: null },
  masked:        { type: Boolean, default: false },
  format:        { type: Function, default: null },
  placeholder:   { type: String, default: '' },
  hint:          { type: String, default: '' },
  error:         { type: Boolean, default: false },
  submitLabel:   { type: String, default: '' },
  submitVariant: { type: String, default: 'filled' },
  loading:       { type: Boolean, default: false },
  disabled:      { type: Boolean, default: false },
  autofocus:     { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'submit'])
const root = ref(null)
const hintId = `keypad-${++uid}-hint`

const LEFT = {
  clear: { id: 'clear', text: 'Clear', aria: 'Clear', kind: 'action' },
  '00': { id: '00', text: '00', aria: undefined, kind: 'digit' }, // named by its visible "00" (label in name)
  '.': { id: '.', text: '.', aria: 'Decimal point', kind: 'digit' },
  none: { id: ' ', text: '', aria: undefined, kind: 'action' },
}
const keys = computed(() => [
  ...'123456789'.split('').map(d => ({ id: d, text: d, kind: 'digit' })),
  LEFT[props.leftKey],
  { id: '0', text: '0', kind: 'digit' },
  { id: 'back', aria: 'Backspace', kind: 'action' },
])

function set(v) {
  if (v !== props.modelValue) emit('update:modelValue', v)
}

function press(id) {
  if (props.disabled) return
  const v = props.modelValue
  if (id === 'back') return set(v.slice(0, -1))
  if (id === 'clear') return set('')
  if (id === '.' && v.includes('.')) return
  const next = (id === '.' && !v ? '0' : '') + v + id
  set(props.maxLength ? next.slice(0, props.maxLength) : next)
}

function submit() {
  if (!props.disabled && !props.loading && props.modelValue) emit('submit', props.modelValue)
}

function onKeydown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  let id = null
  if (/^\d$/.test(e.key)) id = e.key
  else if (e.key === '.' && props.leftKey === '.') id = '.'
  else if (e.key === 'Backspace') id = 'back'
  else if (e.key === 'Delete' || e.key === 'Escape') id = 'clear'
  else if (e.key === 'Enter') { e.preventDefault(); submit(); return }
  if (id === null) return
  if (id === 'clear' && e.key === 'Escape') {
    if (!props.modelValue) return // nothing to clear: let Escape close a dialog
    e.stopPropagation()
  }
  e.preventDefault()
  press(id)
}

const focus = () => root.value?.focus()
onMounted(() => { if (props.autofocus) focus() })
defineExpose({ focus })
</script>
