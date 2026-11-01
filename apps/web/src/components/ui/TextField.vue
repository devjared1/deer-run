<template>
  <div :class="['font-body', attrs.class]" :style="attrs.style">
    <div
      ref="box"
      :class="[
        'group relative flex items-center min-h-14 rounded-shape-xs gap-4',
        leadingIcon ? 'pl-3' : 'pl-4',
        trailingIcon || invalid || $slots.trailing ? 'pr-3' : 'pr-4',
        disabled ? 'cursor-not-allowed' : 'cursor-text',
      ]"
      @mousedown="onBoxMousedown"
    >
      <component
        :is="leadingIcon"
        v-if="leadingIcon"
        :class="['w-6 h-6 pointer-events-none', disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant']"
        aria-hidden="true"
      />
      <span v-if="prefix" v-show="floated" :class="['text-body-l pointer-events-none', disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant']">{{ prefix }}</span>

      <slot name="control" v-bind="slotProps()">
        <input v-bind="controlAttrs()" class="h-14" :value="modelValue ?? ''" @input="onInput">
      </slot>

      <span v-if="suffix" v-show="floated" :class="['text-body-l pointer-events-none', disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant']">{{ suffix }}</span>
      <slot name="trailing" />
      <component
        :is="trailingIcon || IconError"
        v-if="trailingIcon || (invalid && !$slots.trailing)"
        :class="['w-6 h-6 pointer-events-none', disabled ? 'text-on-surface/[.38]' : invalid ? 'text-error' : 'text-on-surface-variant']"
        aria-hidden="true"
      />

      <!-- The outline: a fieldset whose hidden legend cuts the notch the floated label sits in -->
      <fieldset
        aria-hidden="true"
        :class="[
          'pointer-events-none absolute inset-x-0 bottom-0 -top-[5px] m-0 px-3 py-0 rounded-shape-xs text-left',
          'transition-colors duration-short-4 ease-standard',
          outlineClass,
        ]"
      >
        <legend
          v-if="label"
          :class="[
            'invisible float-none block w-auto h-[11px] p-0 overflow-hidden whitespace-nowrap text-body-s',
            floated ? 'max-w-full' : 'max-w-[0.01px]',
          ]"
        >
          <span class="inline-block px-1">{{ label }}<template v-if="required"> *</template></span>
        </legend>
      </fieldset>

      <label
        v-if="label"
        :for="inputId"
        :class="[
          'pointer-events-none absolute max-w-[calc(100%-2rem)] truncate transition-all duration-short-4 ease-standard',
          floated ? '-top-2 left-4 text-body-s' : 'top-4 text-body-l',
          !floated && leadingIcon ? 'left-[52px]' : '',
          !floated && !leadingIcon ? 'left-4' : '',
          labelColor,
        ]"
      >{{ label }}<span v-if="required" aria-hidden="true"> *</span></label>
    </div>

    <div v-if="supportText || counter" class="flex gap-4 px-4 pt-1 text-body-s">
      <p
        v-if="supportText"
        :id="supportId"
        :class="invalid && typeof error === 'string' && error ? 'text-error' : disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant'"
      >{{ supportText }}</p>
      <span v-if="counter" :class="['ml-auto tabular-nums', disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant']">{{ counter }}</span>
    </div>
  </div>
</template>

<script>
let uid = 0
</script>

<script setup>
// MD3 outlined text field: 56px tall, 4px corners, a floating label tied to the input, helper or error text.
//   <TextField v-model="email" label="Email" type="email" autocomplete="email" helper="We'll send the receipt here" />
// Props: label, helper, error (string shows the message in place of helper; true just marks it invalid), prefix /
// suffix (text, shown once the label floats), leadingIcon / trailingIcon (decorative components), required,
// disabled, readonly, id, counter (text at the right of the supporting row), floatLabel (always float).
// Every other attribute (type, name, autocomplete, inputmode, placeholder, min/max, maxlength, role, aria-*, @focus,
// @keydown…) goes to the <input>; class and style stay on the root.
// Slots: #trailing (interactive content at the end, e.g. a clear IconButton); #control="{ bind, id, floated, invalid }"
// replaces the <input> (SelectField and TextArea use it: `<select v-bind="bind">`).
// Exposes focus() and select().
import { computed, mergeProps, ref, useAttrs } from 'vue'
import IconError from '~icons/material-symbols/error-rounded'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue:   { type: [String, Number], default: '' },
  label:        { type: String, default: '' },
  helper:       { type: String, default: '' },
  error:        { type: [String, Boolean], default: '' },
  prefix:       { type: String, default: '' },
  suffix:       { type: String, default: '' },
  leadingIcon:  { type: [Object, Function], default: null },
  trailingIcon: { type: [Object, Function], default: null },
  required:     { type: Boolean, default: false },
  disabled:     { type: Boolean, default: false },
  readonly:     { type: Boolean, default: false },
  id:           { type: String, default: '' },
  counter:      { type: String, default: '' },
  floatLabel:   { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()

const n = ++uid
const inputId = computed(() => props.id || `text-field-${n}`)
const supportId = `text-field-${n}-support`
const box = ref(null)
const focused = ref(false)

const invalid = computed(() => !!props.error)
const supportText = computed(() => (typeof props.error === 'string' && props.error) || props.helper)
const hasValue = computed(() => props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined)
// Date/time inputs always show their native mask, so their label always floats
const ALWAYS_FLOAT = ['date', 'time', 'datetime-local', 'month', 'week']
// attrs aren't reactive: `type` and `placeholder` are read when this first computes (they don't change in practice);
// controlAttrs() below reads attrs at render time so aria-* updates reach the input.
const floated = computed(() => props.floatLabel || focused.value || hasValue.value || !!attrs.placeholder || ALWAYS_FLOAT.includes(attrs.type))

const outlineClass = computed(() => {
  if (props.disabled) return 'border border-on-surface/[.12]'
  if (invalid.value) return focused.value ? 'border-2 border-error' : 'border border-error group-hover:border-on-error-container'
  if (focused.value && !props.readonly) return 'border-2 border-primary'
  return 'border border-outline group-hover:border-on-surface'
})
const labelColor = computed(() => {
  if (props.disabled) return 'text-on-surface/[.38]'
  if (invalid.value) return 'text-error'
  if (focused.value && !props.readonly) return 'text-primary'
  return 'text-on-surface-variant'
})

const controlClass = computed(() => [
  'flex-1 min-w-0 self-stretch bg-transparent text-body-l focus:outline-none focus-visible:outline-none',
  'placeholder:text-on-surface-variant disabled:cursor-not-allowed',
  props.disabled ? 'text-on-surface/[.38]' : 'text-on-surface',
  invalid.value ? 'caret-error' : 'caret-primary',
])

function controlAttrs() {
  const { class: _c, style: _s, ...rest } = attrs
  return mergeProps(rest, {
    id: inputId.value,
    class: controlClass.value,
    disabled: props.disabled || undefined,
    readonly: props.readonly || undefined,
    required: props.required || undefined,
    'aria-invalid': invalid.value ? 'true' : undefined,
    'aria-describedby': supportText.value ? supportId : rest['aria-describedby'],
    onFocus: () => { focused.value = true },
    onBlur: () => { focused.value = false },
  })
}
function slotProps() {
  return { bind: controlAttrs(), id: inputId.value, floated: floated.value, invalid: invalid.value }
}

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

const control = () => box.value?.querySelector('input, select, textarea')

// A tap anywhere in the box (icons, prefix, padding) focuses the control, except on interactive content
function onBoxMousedown(e) {
  if (props.disabled || e.target.closest('input, select, textarea, button, a')) return
  e.preventDefault()
  control()?.focus()
}

defineExpose({
  focus: () => control()?.focus(),
  select: () => { const el = control(); el?.focus(); el?.select?.() },
})
</script>
