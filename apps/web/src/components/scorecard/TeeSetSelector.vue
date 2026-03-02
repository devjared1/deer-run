<template>
  <div class="card rounded-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4">
    <div>
      <label class="field-label mb-1">Active Tee Set</label>
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#1E3D2F;">
        Viewing: {{ teeSets[modelValue].name }}
      </div>
    </div>
    <div class="flex flex-wrap gap-2 sm:ml-auto">
      <button
        v-for="(ts, i) in teeSets"
        :key="i"
        @click="$emit('update:modelValue', i)"
        class="px-4 py-2 font-bold text-sm uppercase tracking-wider transition-all rounded-sm"
        :style="modelValue === i
          ? `background:${ts.color};color:#F2EBD9;font-family:'Lato',sans-serif;font-weight:700;letter-spacing:.07em;border:none;cursor:pointer;`
          : ''"
        :class="modelValue !== i ? 'btn-outline-pine' : ''"
      >
        {{ ts.name }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  teeSets:    { type: Array, required: true },
  modelValue: { type: Number, required: true },
})
defineEmits(['update:modelValue'])
</script>
