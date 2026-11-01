<template>
  <SegmentedButton
    :model-value="modelValue"
    :options="options"
    :label="label"
    :block="block"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup>
// Tee set picker: a single-select SegmentedButton (role="radiogroup", arrow keys move the selection) with the tee's
// colored marker on each segment. v-model is the index into teeSets.
//   <TeeSetSelector v-model="teeIndex" :tee-sets="teeSets" block />
import { computed, h } from 'vue'
import SegmentedButton from '@/components/ui/SegmentedButton.vue'
import TeeSwatch from './TeeSwatch.vue'

const props = defineProps({
  teeSets:    { type: Array, required: true },
  modelValue: { type: Number, required: true },
  label:      { type: String, default: 'Tees' },
  block:      { type: Boolean, default: false },
})
defineEmits(['update:modelValue'])

// SegmentedButton renders option.icon as a component with the icon size classes; this one draws the tee's dot
const options = computed(() => props.teeSets.map((tee, i) => ({
  value: i,
  label: tee.name,
  icon: (_, { attrs }) => h('span', { ...attrs, class: [attrs.class, 'inline-flex items-center justify-center'] }, [h(TeeSwatch, { tee, class: 'w-3 h-3' })]),
})))
</script>
