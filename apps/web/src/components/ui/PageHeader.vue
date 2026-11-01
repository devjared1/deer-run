<template>
  <header class="mb-6 font-body">
    <nav v-if="breadcrumbs?.length" aria-label="Breadcrumb" class="mb-2">
      <ol class="flex flex-wrap items-center gap-x-1 gap-y-1 text-body-m text-on-surface-variant">
        <li v-for="(crumb, i) in breadcrumbs" :key="i" class="flex items-center gap-1">
          <IconChevron v-if="i" class="w-4 h-4" aria-hidden="true" />
          <span v-if="i === breadcrumbs.length - 1 || !crumb.to" :aria-current="i === breadcrumbs.length - 1 ? 'page' : undefined" class="text-on-surface">
            {{ crumb.label }}
          </span>
          <RouterLink v-else :to="crumb.to" class="touch-target rounded-shape-xs text-primary underline-offset-2 hover:underline">
            {{ crumb.label }}
          </RouterLink>
        </li>
      </ol>
    </nav>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex items-start gap-2 min-w-0">
        <IconButton v-if="back" :icon="IconBack" :label="backLabel" :to="back" class="-ml-3 -mt-1" />
        <div class="min-w-0">
          <component
            :is="`h${level}`"
            :class="['font-display text-primary break-words', level === 1 ? 'text-headline-m' : 'text-headline-s']"
          >
            <slot name="title">{{ title }}</slot>
          </component>
          <p v-if="subtitle || $slots.subtitle" class="mt-1 text-body-l text-on-surface-variant">
            <slot name="subtitle">{{ subtitle }}</slot>
          </p>
        </div>
      </div>

      <div v-if="$slots.actions || $slots.secondary" class="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
        <slot name="secondary" />
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup>
// Page header: breadcrumbs, back button, title, subtitle and page actions (one place on every page).
//   <PageHeader title="House accounts" subtitle="Member charge accounts" :breadcrumbs="[{ label: 'Pro Shop', to: '/admin/sales' }, { label: 'House accounts' }]">
//     <template #actions><AppButton :icon="IconAdd">Open account</AppButton></template>
//     <template #secondary><IconButton :icon="IconDownload" label="Export CSV" /></template>
//   </PageHeader>
// level: 1 (h1, default) | 2. back: a route for the 48dp arrow-back button (backLabel names it, default "Back").
// Breadcrumbs: [{ label, to? }]; the last one is the current page (aria-current="page", not a link).
// Slots: title, subtitle, actions (primary action, rightmost), secondary (secondary actions, before it).
// Actions stack under the title on phones.
import { RouterLink } from 'vue-router'
import IconButton from './IconButton.vue'
import IconBack from '~icons/material-symbols/arrow-back-rounded'
import IconChevron from '~icons/material-symbols/chevron-right-rounded'

defineProps({
  title:       { type: String, default: '' },
  subtitle:    { type: String, default: '' },
  level:       { type: Number, default: 1, validator: v => [1, 2].includes(v) },
  breadcrumbs: { type: Array, default: null },
  back:        { type: [String, Object], default: null },
  backLabel:   { type: String, default: 'Back' },
})
</script>
