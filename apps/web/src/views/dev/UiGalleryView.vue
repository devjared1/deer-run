<template>
  <div class="min-h-screen bg-surface text-on-surface">
    <header class="sticky top-0 z-app-bar bg-surface-container border-b border-outline-variant">
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <BrandLogo variant="mark" :size="40" eager />
        <h1 class="font-display text-headline-s text-primary">Component gallery</h1>
        <label class="ml-auto flex items-center gap-2 text-body-m text-on-surface-variant">
          <input v-model="highContrast" type="checkbox" class="w-5 h-5 accent-primary">
          High contrast
        </label>
      </div>
      <nav class="max-w-6xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto" aria-label="Gallery sections">
        <a
          v-for="s in sections"
          :key="s.id"
          :href="`#${s.id}`"
          class="state-layer rounded-full px-3 py-1.5 text-label-l text-on-surface-variant whitespace-nowrap"
        >{{ s.title }}</a>
      </nav>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-8 space-y-12" :data-contrast="highContrast ? 'high' : undefined">
      <section v-for="s in sections" :id="s.id" :key="s.id" class="scroll-mt-32">
        <h2 class="font-display text-headline-m text-primary mb-1">{{ s.title }}</h2>
        <p v-if="s.note" class="text-body-m text-on-surface-variant mb-4">{{ s.note }}</p>
        <component :is="s.component" />
      </section>
    </main>
  </div>
</template>

<script setup>
// /dev/ui: every shared component in every state, for design review in one place (no Storybook).
// Each section is a file in ./gallery; add new components to the matching section.
import { ref } from 'vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'

const highContrast = ref(false)

// Every gallery/*.vue file becomes a section, sorted by file name ("10-Foundations.vue" → "Foundations")
const files = import.meta.glob('./gallery/*.vue', { eager: true })
const sections = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod]) => {
    const name = path.split('/').pop().replace(/\.vue$/, '').replace(/^\d+-/, '')
    return {
      id: name.toLowerCase(),
      title: mod.default.galleryTitle ?? name.replace(/([a-z])([A-Z])/g, '$1 $2'),
      note: mod.default.galleryNote,
      component: mod.default,
    }
  })
</script>
