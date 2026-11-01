<template>
  <div class="space-y-10">
    <div>
      <h3 class="text-title-m text-on-surface mb-3">TextField</h3>
      <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField v-model="t.empty" label="Empty" />
        <TextField v-model="t.filled" label="Filled" autocomplete="name" />
        <TextField v-model="t.helper" label="Email" type="email" autocomplete="email" helper="We'll send the receipt here" required />
        <TextField v-model="t.error" label="Phone" type="tel" autocomplete="tel" error="Enter a 10-digit phone number" />
        <TextField v-model="t.placeholder" label="Placeholder" placeholder="e.g. Jordan Smith" />
        <TextField v-model="t.prefix" label="Weight" suffix="lb" inputmode="decimal" />
        <TextField v-model="t.icons" label="Search" :leading-icon="IconSearch" :trailing-icon="IconMail" />
        <TextField v-model="t.date" label="Date" type="date" />
        <TextField model-value="Read only value" label="Read only" readonly />
        <TextField model-value="Can't change this" label="Disabled" disabled helper="Helper text when disabled" />
        <TextField label="Disabled, empty" disabled />
        <TextField ref="focusMe" v-model="t.focus" label="Focus me" helper="Click the button to focus() and select()" />
      </div>
      <AppButton class="mt-3" variant="text" @click="focusMe.select()">focus() + select()</AppButton>
    </div>

    <div>
      <h3 class="text-title-m text-on-surface mb-3">SelectField</h3>
      <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField v-model="s.empty" label="Position" :options="positions" />
        <SelectField v-model="s.placeholder" label="With placeholder" placeholder="Pick a position" :options="positions" required />
        <SelectField v-model="s.filled" label="Filled" :options="positions" helper="Numbers stay numbers" />
        <SelectField v-model="s.error" label="Register" :options="positions" error="Choose a register" />
        <SelectField v-model="s.filled" label="Disabled" :options="positions" disabled />
        <SelectField v-model="s.icon" label="Leading icon" :leading-icon="IconPerson" :options="positions" />
      </div>
    </div>

    <div>
      <h3 class="text-title-m text-on-surface mb-3">TextArea</h3>
      <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <TextArea v-model="a.plain" label="Notes" helper="Fixed 3 rows, scrolls" />
        <TextArea v-model="a.grow" label="Auto-grow with counter" auto-grow :rows="1" :maxlength="200" counter />
        <TextArea v-model="a.error" label="Reason" error="Tell the employee why" required />
        <TextArea model-value="Disabled text" label="Disabled" disabled />
      </div>
    </div>

    <div>
      <h3 class="text-title-m text-on-surface mb-3">MoneyField</h3>
      <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField v-model="m.empty" label="Amount" />
        <MoneyField v-model="m.filled" label="Price" helper="Try 12, 12.5 or $1,234.56" />
        <MoneyField v-model="m.range" label="Float (min $50, max $500)" :min="5000" :max="50000" helper="Blur to see the range check" />
        <MoneyField v-model="m.filled" label="Disabled" disabled />
      </div>
      <p class="mt-2 text-body-m text-on-surface-variant">v-model in cents: {{ JSON.stringify(m) }}</p>
    </div>

    <div class="grid gap-8 md:grid-cols-3">
      <div>
        <h3 class="text-title-m text-on-surface mb-1">Checkbox</h3>
        <Checkbox v-model="c.a" label="Unchecked" />
        <Checkbox v-model="c.b" label="Checked" helper="With helper text" />
        <Checkbox v-model="c.c" label="Indeterminate" :indeterminate="!c.c" />
        <Checkbox v-model="c.d" label="Error" error helper="You must agree to continue" />
        <Checkbox :model-value="true" label="Disabled, checked" disabled />
        <Checkbox :model-value="false" label="Disabled" disabled />
        <div class="mt-2">
          <Checkbox v-for="d in ['Mon', 'Tue', 'Wed']" :key="d" v-model="c.days" :value="d" :label="d" />
          <p class="text-body-s text-on-surface-variant px-3">Array v-model: {{ c.days.join(', ') || 'none' }}</p>
        </div>
      </div>

      <div>
        <h3 class="text-title-m text-on-surface mb-1">Switch</h3>
        <Switch v-model="w.a" label="Ask for a tip" helper="Shown on the card reader" />
        <Switch v-model="w.b" label="Own cart" />
        <Switch :model-value="true" label="Disabled, on" disabled />
        <Switch :model-value="false" label="Disabled, off" disabled />
        <div class="flex items-center gap-3">
          <Switch v-model="w.c" aria-label="No visible label" />
          <span class="text-body-m text-on-surface-variant">No visible label (aria-label)</span>
        </div>
      </div>

      <div class="space-y-6">
        <RadioGroup v-model="r.a" label="Refund to" :options="refundOptions" helper="Refunds go back the way they were paid" />
        <RadioGroup v-model="r.b" label="Holes (inline)" inline :options="[{ value: 9, label: '9 holes' }, { value: 18, label: '18 holes' }]" />
        <RadioGroup v-model="r.c" label="Error" :options="refundOptions.slice(0, 2)" error="Pick one" required />
        <RadioGroup v-model="r.a" label="Disabled" :options="refundOptions.slice(0, 2)" disabled />
      </div>
    </div>
  </div>
</template>

<script>
export default { galleryTitle: 'Form fields' }
</script>

<script setup>
import { reactive, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import MoneyField from '@/components/ui/MoneyField.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'
import SelectField from '@/components/ui/SelectField.vue'
import Switch from '@/components/ui/Switch.vue'
import TextArea from '@/components/ui/TextArea.vue'
import TextField from '@/components/ui/TextField.vue'
import IconSearch from '~icons/material-symbols/search-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconPerson from '~icons/material-symbols/person-rounded'

const focusMe = ref(null)
const t = reactive({ empty: '', filled: 'Jordan Smith', helper: '', error: '555-01', placeholder: '', prefix: '185', icons: '', date: '2026-11-01', focus: 'Select me' })
const positions = [
  { value: 1, label: 'Pro shop' },
  { value: 2, label: 'Grill' },
  { value: 3, label: 'Grounds crew' },
  { value: 4, label: 'Starter (inactive)', disabled: true },
]
const s = reactive({ empty: null, placeholder: null, filled: 2, error: null, icon: 1 })
const a = reactive({ plain: '', grow: 'Type more lines and this grows with them.', error: '' })
const m = reactive({ empty: null, filled: 4500, range: 2000 })
const c = reactive({ a: false, b: true, c: false, d: false, days: ['Tue'] })
const w = reactive({ a: false, b: true, c: false })
const refundOptions = [
  { value: 'CARD', label: 'Card', description: 'Back to the card used' },
  { value: 'CASH', label: 'Cash', description: 'Needs an open drawer' },
  { value: 'ACCOUNT', label: 'House account', disabled: true, description: 'Not available for this sale' },
]
const r = reactive({ a: 'CARD', b: 18, c: null })
</script>
