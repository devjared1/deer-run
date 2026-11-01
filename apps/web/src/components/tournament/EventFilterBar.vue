<template>
  <div class="flex flex-wrap items-center gap-x-2">
    <ChipGroup
      :model-value="modelValue"
      :options="options"
      size="lg"
      scroll
      label="Filter events"
      class="flex-1 min-w-0"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <AppButton v-if="modelValue.length" variant="text" :icon="IconFilterOff" @click="emit('update:modelValue', [])">
      Clear filters
    </AppButton>
  </div>
</template>

<script setup>
// Filter chips for the Tournaments page (48dp filter chips, aria-pressed, one scrolling row on phones).
// v-model is the array of selected values; `options` come from eventFilterOptions() (eventDisplay.js), and
// filterEvents() applies the selection.
//   <EventFilterBar v-model="filters" :options="eventFilterOptions(events)" />
import AppButton from '@/components/ui/AppButton.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import IconFilterOff from '~icons/material-symbols/filter-alt-off-rounded'

defineProps({
  modelValue: { type: Array, required: true },
  options:    { type: Array, required: true },
})
const emit = defineEmits(['update:modelValue'])
</script>
