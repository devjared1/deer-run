<template>
  <section aria-labelledby="kiosk-pick-title" class="flex flex-col min-h-0 flex-1">
    <div class="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
      <div class="flex-1 min-w-0">
        <h2 id="kiosk-pick-title" class="font-display text-headline-l text-on-surface">Tap your name</h2>
        <p class="mt-1 text-body-l text-on-surface-variant">Then enter your time clock PIN.</p>
      </div>
      <TextField
        :model-value="search"
        label="Find your name"
        type="search"
        autocomplete="off"
        autocapitalize="words"
        spellcheck="false"
        enterkeyhint="search"
        :leading-icon="IconSearch"
        class="w-full md:w-80"
        @update:model-value="v => emit('update:search', v)"
      >
        <template v-if="search" #trailing>
          <IconButton :icon="IconClose" label="Clear search" @click="emit('update:search', '')" />
        </template>
      </TextField>
    </div>

    <p class="sr-only" aria-live="polite">{{ shown.length }} {{ shown.length === 1 ? 'name' : 'names' }}</p>

    <ul
      v-if="shown.length"
      class="mt-5 grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-3 overflow-y-auto overscroll-contain pb-6 -mx-1 px-1"
      aria-label="Employees"
    >
      <li v-for="e in shown" :key="e.id">
        <button
          type="button"
          class="state-layer w-full min-h-24 flex items-center gap-4 rounded-shape-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-left shadow-elevation-1 active:shadow-none"
          @click="emit('pick', e)"
        >
          <span
            :class="['flex-none flex items-center justify-center w-14 h-14 rounded-full text-title-l', avatarClass(e.status)]"
            aria-hidden="true"
          >{{ initials(e) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-title-l text-on-surface break-words">{{ fullName(e) }}</span>
            <span class="block text-body-m text-on-surface-variant truncate">{{ positionLabel(e.position) }}</span>
            <span v-if="e.status !== 'off'" class="mt-1 inline-flex items-center gap-1 text-label-l text-on-surface">
              <component
                :is="e.status === 'on' ? IconTimer : IconCoffee"
                :class="['w-4 h-4', e.status === 'on' ? 'text-success' : 'text-warning']"
                aria-hidden="true"
              />
              {{ STATUS[e.status].label }}
            </span>
          </span>
        </button>
      </li>
    </ul>

    <EmptyState
      v-else
      class="mt-8"
      :icon="IconPersonSearch"
      :title="search ? `No one named “${search.trim()}”` : 'No employees yet'"
      :message="search ? 'Check the spelling, or ask a manager to add you in Admin → Employees.' : 'An admin adds employees in Admin → Employees.'"
      :action-label="search ? 'Clear search' : ''"
      @action="emit('update:search', '')"
    />
  </section>
</template>

<script setup>
// Time clock kiosk, step 1: every active employee as a big name tile (initials, position, on the clock / on break),
// with a search box. Emits pick(employee) and update:search.
import { computed } from 'vue'
import TextField from '@/components/ui/TextField.vue'
import IconButton from '@/components/ui/IconButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { positionLabel } from '@/data/employeePositions'
import { STATUS, fullName, initials, matchesName } from './kioskDisplay'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconClose from '~icons/material-symbols/close-rounded'
import IconTimer from '~icons/material-symbols/timer-rounded'
import IconCoffee from '~icons/material-symbols/coffee-rounded'
import IconPersonSearch from '~icons/material-symbols/person-search-rounded'

const props = defineProps({
  employees: { type: Array, default: () => [] },
  search:    { type: String, default: '' },
})
const emit = defineEmits(['pick', 'update:search'])

const shown = computed(() => props.employees.filter(e => matchesName(e, props.search)))

function avatarClass(status) {
  if (status === 'on') return 'bg-success-container text-on-success-container'
  if (status === 'break') return 'bg-warning-container text-on-warning-container'
  return 'bg-secondary-container text-on-secondary-container'
}
</script>
