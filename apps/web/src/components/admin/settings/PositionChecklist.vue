<template>
  <fieldset class="min-w-0 font-body">
    <legend class="text-title-s text-on-surface">{{ label }}</legend>
    <p v-if="help" class="mt-1 text-body-m text-on-surface-variant">{{ help }}</p>
    <div class="mt-2 max-h-72 overflow-y-auto rounded-shape-xs border border-outline-variant py-1">
      <div v-for="dept in departments" :key="dept">
        <p class="px-4 pt-2 text-label-m text-on-surface-variant">{{ dept }}</p>
        <div class="px-1">
          <Checkbox
            v-for="p in positionsIn(dept)"
            :key="p.value"
            :model-value="modelValue"
            :value="p.value"
            :label="p.label"
            class="w-full"
            @update:model-value="emit('update:modelValue', $event)"
          />
        </div>
      </div>
    </div>
  </fieldset>
</template>

<script setup>
// A list of every employee position as checkboxes, grouped by department (Settings: register, manager and on-course
// access). v-model is an array of EmployeePosition values.
//   <PositionChecklist v-model="form.registerPositions" label="Can use the register" help="…" />
import Checkbox from '@/components/ui/Checkbox.vue'
import { employeePositions, departments } from '@/data/employeePositions'

defineProps({
  modelValue: { type: Array, required: true },
  label:      { type: String, required: true },
  help:       { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const positionsIn = dept => employeePositions.filter(p => p.department === dept)
</script>
