<template>
  <div class="flex items-center gap-4 min-h-12 font-body">
    <label
      v-if="label || $slots.default || helper"
      :for="switchId"
      :class="['flex-1 min-w-0 py-2 select-none', disabled ? 'cursor-not-allowed' : 'cursor-pointer']"
    >
      <span :class="['block text-body-l', disabled ? 'text-on-surface/[.38]' : 'text-on-surface']"><slot>{{ label }}</slot></span>
      <span v-if="helper" :id="helperId" :class="['block text-body-m', disabled ? 'text-on-surface/[.38]' : 'text-on-surface-variant']">{{ helper }}</span>
    </label>

    <button
      :id="switchId"
      type="button"
      role="switch"
      :aria-checked="String(modelValue)"
      :aria-label="label || $slots.default ? undefined : ariaLabel"
      :aria-describedby="helper ? helperId : undefined"
      :disabled="disabled"
      :class="[
        'group touch-target relative flex-none w-[52px] h-8 rounded-full transition-colors duration-short-4 ease-standard',
        trackClass,
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      ]"
      @click="emit('update:modelValue', !modelValue)"
    >
      <!-- 40px state layer around the thumb (hover 8%, focus/press 10%) -->
      <span
        :class="[
          'pointer-events-none absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full',
          'transition-[left] duration-short-4 ease-standard',
          modelValue ? 'left-4' : '-left-1.5',
        ]"
      >
        <span
          v-if="!disabled"
          :class="[
            'absolute inset-0 rounded-full opacity-0 transition-opacity duration-short-2',
            'group-hover:opacity-[.08] group-focus-visible:opacity-[.1] group-active:opacity-[.1]',
            modelValue ? 'bg-primary' : 'bg-on-surface',
          ]"
        />
        <span
          :class="[
            'relative flex items-center justify-center rounded-full transition-all duration-short-4 ease-standard',
            modelValue ? 'w-6 h-6 group-active:w-7 group-active:h-7' : 'w-4 h-4 group-active:w-7 group-active:h-7',
            thumbClass,
          ]"
        >
          <IconCheck v-if="modelValue && icons" class="w-4 h-4" aria-hidden="true" />
        </span>
      </span>
    </button>
  </div>
</template>

<script>
let uid = 0
</script>

<script setup>
// MD3 switch: 52×32 track in a 48px target, thumb with a check icon when on. The label (prop or default slot)
// sits at the start of the row and toggles it too; the switch sits at the end.
//   <Switch v-model="settings.tippingEnabled" label="Ask for a tip" helper="Shown on the card reader" />
// Props: modelValue (Boolean), label, helper, disabled, icons (check icon on the thumb, default true), id,
// ariaLabel (the accessible name when there's no visible label).
import { computed } from 'vue'
import IconCheck from '~icons/material-symbols/check-rounded'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label:      { type: String, default: '' },
  helper:     { type: String, default: '' },
  disabled:   { type: Boolean, default: false },
  icons:      { type: Boolean, default: true },
  id:         { type: String, default: '' },
  ariaLabel:  { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const n = ++uid
const switchId = computed(() => props.id || `switch-${n}`)
const helperId = `switch-${n}-helper`

const trackClass = computed(() => {
  if (props.disabled) return props.modelValue ? 'bg-on-surface/[.12]' : 'bg-surface-container-highest/[.12] border-2 border-on-surface/[.12]'
  return props.modelValue ? 'bg-primary' : 'bg-surface-container-highest border-2 border-outline'
})
const thumbClass = computed(() => {
  if (props.disabled) return props.modelValue ? 'bg-surface text-on-surface/[.38]' : 'bg-on-surface/[.38]'
  return props.modelValue ? 'bg-on-primary text-on-primary-container' : 'bg-outline group-hover:bg-on-surface-variant'
})
</script>
