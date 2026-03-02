<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="f in filters"
      :key="f"
      @click="$emit('update:modelValue', f)"
      :class="[
        'px-4 py-2 font-bold text-sm uppercase tracking-wider transition-all rounded-sm',
        modelValue === f ? '' : 'btn-outline-pine'
      ]"
      :style="modelValue === f ? 'background:#1E3D2F;color:#F2EBD9;font-family:\'Lato\',sans-serif;font-weight:700;letter-spacing:.07em;border:none;cursor:pointer;' : ''"
    >
      {{ f }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
})
defineEmits(['update:modelValue'])

const filters = ['All', 'Upcoming', 'Past', 'Member Only']
</script>
