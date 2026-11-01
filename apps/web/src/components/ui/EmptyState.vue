<template>
  <div :class="['flex flex-col items-center text-center', compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12']">
    <span
      :class="[
        'inline-flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant',
        compact ? 'w-10 h-10' : 'w-16 h-16 mb-1',
      ]"
      aria-hidden="true"
    >
      <component :is="icon" :class="compact ? 'w-6 h-6' : 'w-8 h-8'" />
    </span>
    <h3 v-if="title" :class="compact ? 'text-title-s text-on-surface' : 'text-title-m text-on-surface'">{{ title }}</h3>
    <p v-if="message || $slots.default" :class="['max-w-sm text-on-surface-variant', compact ? 'text-body-m' : 'text-body-l']">
      <slot>{{ message }}</slot>
    </p>
    <div v-if="$slots.action || actionLabel" :class="compact ? 'mt-1' : 'mt-3'">
      <slot name="action">
        <AppButton :variant="compact ? 'text' : 'tonal'" :to="to" :icon="actionIcon" @click="to ? undefined : emit('action')">
          {{ actionLabel }}
        </AppButton>
      </slot>
    </div>
  </div>
</template>

<script setup>
// "Nothing here yet": icon, title, message and an optional action.
//
//   <EmptyState :icon="IconEvent" title="No tournaments yet" message="Create one to list it on the site."
//               action-label="New tournament" @action="create" />
//
// Props: icon (component, default inbox), title, message (or the default slot), actionLabel + actionIcon (renders a
// button that emits `action`, or a RouterLink when `to` is set), compact (for table bodies, cards and side panels).
// Slots: default (message), action (replaces the built-in button).
import AppButton from './AppButton.vue'
import IconInbox from '~icons/material-symbols/inbox-rounded'

defineProps({
  icon:        { type: [Object, Function], default: () => IconInbox },
  title:       { type: String, default: '' },
  message:     { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  actionIcon:  { type: [Object, Function], default: null },
  to:          { type: [String, Object], default: null },
  compact:     { type: Boolean, default: false },
})
const emit = defineEmits(['action'])
</script>
