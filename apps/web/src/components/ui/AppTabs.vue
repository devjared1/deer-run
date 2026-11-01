<template>
  <!-- as="div" so class/attrs passed to AppTabs have an element to land on -->
  <TabGroup as="div" :selected-index="selectedIndex" @change="select">
    <div class="relative border-b border-outline-variant">
      <TabList
        ref="listRef"
        :aria-label="label || undefined"
        class="relative flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Tab v-for="tab in tabs" :key="tab.key" v-slot="{ selected }" as="template">
          <button
            type="button"
            :class="[
              'state-layer flex-1 min-w-max flex items-center justify-center px-4 font-body text-title-s whitespace-nowrap [outline-offset:-3px]',
              variant === 'primary' && hasIcons ? 'h-16' : 'h-12',
              selected ? (variant === 'primary' ? 'text-primary' : 'text-on-surface') : 'text-on-surface-variant',
            ]"
          >
            <span
              data-tab-content
              :class="['relative flex items-center', variant === 'primary' && hasIcons ? 'flex-col gap-1' : 'gap-2']"
            >
              <component :is="tab.icon" v-if="tab.icon" class="w-6 h-6" aria-hidden="true" />
              <span>{{ tab.label }}</span>
              <span
                v-if="tab.badge != null && tab.badge !== ''"
                :class="[
                  'min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-label-s leading-4 text-center',
                  variant === 'primary' && hasIcons ? 'absolute -top-1 left-1/2 ml-2' : '',
                ]"
              >{{ tab.badge }}</span>
            </span>
          </button>
        </Tab>
        <span
          aria-hidden="true"
          :class="[
            'absolute bottom-0 left-0 bg-primary pointer-events-none transition-[transform,width] duration-medium-2 ease-emphasized',
            variant === 'primary' ? 'h-[3px] rounded-t-full' : 'h-0.5',
          ]"
          :style="{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)` }"
        />
      </TabList>
    </div>
    <TabPanels v-if="hasPanels">
      <TabPanel v-for="tab in tabs" :key="tab.key" :class="panelClass" :unmount="unmount">
        <slot :name="tab.key" :tab="tab">
          <slot :tab="tab" />
        </slot>
      </TabPanel>
    </TabPanels>
  </TabGroup>
</template>

<script setup>
// MD3 tabs (Headless UI TabGroup: role=tablist/tab/tabpanel, arrow keys, Home/End).
//   <AppTabs v-model="tab" :tabs="[{ key: 'sales', label: 'Sales', icon: IconReceipt, badge: 3 }, …]">
//     <template #sales>…</template>        (a named slot per tab key, or the default slot with { tab })
//   </AppTabs>
// variant: primary (3dp indicator under the label, icons stacked above) | secondary (2dp full-width indicator).
// With no slots it renders only the tab row (tabs used as a filter). The row scrolls sideways on narrow screens.
// Props: label (aria-label for the tablist), panelClass, unmount (false keeps hidden panels mounted).
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useSlots, watch } from 'vue'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  tabs:       { type: Array, required: true },
  variant:    { type: String, default: 'primary', validator: v => ['primary', 'secondary'].includes(v) },
  label:      { type: String, default: '' },
  panelClass: { type: String, default: 'pt-4' },
  unmount:    { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue', 'change'])
const slots = useSlots()

const selectedIndex = computed(() => Math.max(0, props.tabs.findIndex(t => t.key === props.modelValue)))
const hasIcons = computed(() => props.tabs.some(t => t.icon))
const hasPanels = computed(() => !!slots.default || props.tabs.some(t => slots[t.key]))

function select(index) {
  const key = props.tabs[index]?.key
  if (key === props.modelValue) return
  emit('update:modelValue', key)
  emit('change', key)
}

// The active indicator slides between tabs: measured from the selected tab (primary: its label only)
const listRef = ref(null)
const indicator = reactive({ left: 0, width: 0 })

function measure() {
  const list = listRef.value?.$el
  const tab = list?.querySelectorAll('[role="tab"]')[selectedIndex.value]
  if (!tab) return
  const content = tab.querySelector('[data-tab-content]')
  const primary = props.variant === 'primary'
  indicator.left = tab.offsetLeft + (primary ? content.offsetLeft : 0)
  indicator.width = primary ? content.offsetWidth : tab.offsetWidth
  // Keep the selected tab in view in a scrolled row (horizontally only: never scroll the page)
  if (tab.offsetLeft < list.scrollLeft) list.scrollLeft = tab.offsetLeft
  else if (tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
    list.scrollLeft = tab.offsetLeft + tab.offsetWidth - list.clientWidth
  }
}

let observer
onMounted(() => {
  nextTick(measure)
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    observer.observe(listRef.value.$el)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => [selectedIndex.value, props.tabs, props.variant], () => nextTick(measure), { deep: true })
</script>
