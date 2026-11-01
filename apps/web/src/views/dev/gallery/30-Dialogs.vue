<template>
  <div class="space-y-8">

    <div>
      <h3 class="text-title-m mb-3">AppDialog</h3>
      <div class="flex flex-wrap gap-3">
        <AppButton variant="tonal" @click="openDialog('sm')">Small</AppButton>
        <AppButton variant="tonal" @click="openDialog('md')">Medium</AppButton>
        <AppButton variant="tonal" @click="openDialog('lg')">Large, long content</AppButton>
        <AppButton variant="tonal" @click="iconDialog = true">With icon</AppButton>
        <AppButton variant="outlined" @click="formDialog = true">Persistent form (full screen on phones)</AppButton>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">ConfirmDialog (useConfirm)</h3>
      <div class="flex flex-wrap gap-3">
        <AppButton variant="tonal" @click="ask(false)">Confirm</AppButton>
        <AppButton variant="danger" :icon="IconDelete" @click="ask(true)">Destructive confirm</AppButton>
        <AppButton variant="outlined" @click="askTwice">Two in a row (queue)</AppButton>
      </div>
      <p class="mt-2 text-body-m text-on-surface-variant">Last answer: {{ lastAnswer }}</p>
    </div>

    <div>
      <h3 class="text-title-m mb-3">BottomSheet</h3>
      <div class="flex flex-wrap gap-3">
        <AppButton variant="tonal" :icon="IconFilter" @click="sheet = true">Filters (dialog on md+)</AppButton>
        <AppButton variant="tonal" @click="sheetAlways = true">Always a sheet, long content</AppButton>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">ResultDialog</h3>
      <div class="flex flex-wrap gap-3">
        <AppButton variant="gold" :icon="IconPayments" @click="saleResult = true">Sale complete</AppButton>
        <AppButton variant="tonal" @click="refundResult = true">Refund issued</AppButton>
      </div>
    </div>

    <div>
      <h3 class="text-title-m mb-3">RowActionsMenu</h3>
      <div class="rounded-shape-md border border-outline-variant overflow-x-auto">
        <table class="w-full text-body-m">
          <tbody>
            <tr v-for="p in people" :key="p.name" class="border-b border-outline-variant last:border-0">
              <td class="pl-1 w-12">
                <RowActionsMenu :label="`Actions for ${p.name} (menu opens to the right)`" :items="rowItems(p)" align="start" size="sm" />
              </td>
              <td class="px-4 py-2">{{ p.name }}</td>
              <td class="px-4 py-2 text-on-surface-variant">{{ p.active ? 'Active' : 'Inactive' }}</td>
              <td class="pr-1 w-12 text-right">
                <RowActionsMenu :label="`Actions for ${p.name}`" :items="rowItems(p)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppDialog v-model:open="sizeDialog" :size="size" :title="`Dialog (${size})`">
      <p>Esc, a backdrop tap or a button closes it. Focus is trapped inside and returns to the button afterwards.</p>
      <template v-if="size === 'lg'">
        <p v-for="n in 30" :key="n" class="mt-3">Line {{ n }}: the body scrolls while the title and actions stay put.</p>
      </template>
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton @click="close">OK</AppButton>
      </template>
    </AppDialog>

    <AppDialog v-model:open="iconDialog" :icon="IconPrint" title="Print the receipt?" size="sm">
      <p>A dialog with an icon centers its header.</p>
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Not now</AppButton>
        <AppButton @click="close">Print</AppButton>
      </template>
    </AppDialog>

    <AppDialog
      v-model:open="formDialog"
      title="Edit employee"
      persistent
      fullscreen-on-mobile
      confirm-label="Save"
      initial-focus="#gallery-first-name"
      @confirm="saveForm"
    >
      <p class="mb-4">Persistent: Esc and backdrop taps do nothing, so typed input isn't lost.</p>
      <div class="space-y-4">
        <label class="block">
          <span class="text-label-l text-on-surface">First name</span>
          <input id="gallery-first-name" v-model="form.first" class="mt-1 w-full h-12 px-3 rounded-shape-xs border border-outline bg-transparent text-body-l text-on-surface">
        </label>
        <label class="block">
          <span class="text-label-l text-on-surface">Last name</span>
          <input v-model="form.last" class="mt-1 w-full h-12 px-3 rounded-shape-xs border border-outline bg-transparent text-body-l text-on-surface">
        </label>
        <p v-for="n in 12" :key="n">Filler {{ n }} to show the scrolling body.</p>
      </div>
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Cancel</AppButton>
        <AppButton @click="saveForm">Save</AppButton>
      </template>
    </AppDialog>

    <BottomSheet v-model:open="sheet" title="Filters">
      <div class="space-y-1">
        <label v-for="f in ['Paid', 'Checked in', 'On course', 'Finished']" :key="f" class="flex items-center gap-3 min-h-12">
          <input type="checkbox" class="w-5 h-5 accent-primary">
          <span class="text-body-l text-on-surface">{{ f }}</span>
        </label>
      </div>
      <template #actions="{ close }">
        <AppButton variant="text" @click="close">Clear</AppButton>
        <AppButton @click="close">Apply</AppButton>
      </template>
    </BottomSheet>

    <BottomSheet v-model:open="sheetAlways" title="Update position" :dialog-on-desktop="false">
      <p v-for="n in 40" :key="n" class="py-2">Hole {{ n % 18 + 1 }}</p>
    </BottomSheet>

    <ResultDialog
      v-model:open="saleResult"
      title="Sale #1042 complete"
      amount-label="Change due"
      :amount="1250"
      @print="snackbar.show('Printing receipt…')"
      @done="snackbar.show('Ready for the next sale')"
    >
      <p>Total $37.50 · Cash $50.00</p>
      <p>Receipt emailed to jane@example.com</p>
      <template #extra>
        <AppButton variant="outlined" size="lg" block @click="snackbar.show('Receipt emailed')">Email receipt</AppButton>
      </template>
    </ResultDialog>

    <ResultDialog
      v-model:open="refundResult"
      title="Refund issued"
      amount-label="Back to the card ending 4242"
      :amount="4500"
      :icon="IconUndo"
      @print="snackbar.show('Printing refund slip…')"
    >
      <p>Sale #1038 · 2 items</p>
    </ResultDialog>
  </div>
</template>

<script>
export default { galleryTitle: 'Dialogs & menus' }
</script>

<script setup>
import { reactive, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ResultDialog from '@/components/ui/ResultDialog.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import { useConfirm } from '@/composables/useConfirm.js'
import { useSnackbar } from '@/composables/useSnackbar.js'
import IconDelete from '~icons/material-symbols/delete-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconFilter from '~icons/material-symbols/filter-list-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconPrint from '~icons/material-symbols/print-rounded'
import IconUndo from '~icons/material-symbols/undo-rounded'
import IconCopy from '~icons/material-symbols/content-copy-rounded'
import IconPersonOff from '~icons/material-symbols/person-off-rounded'

const confirm = useConfirm()
const snackbar = useSnackbar()

const size = ref('md')
const sizeDialog = ref(false)
function openDialog(s) {
  size.value = s
  sizeDialog.value = true
}
const iconDialog = ref(false)
const formDialog = ref(false)
const form = reactive({ first: 'Jane', last: 'Doe' })
function saveForm() {
  formDialog.value = false
  snackbar.show(`Saved ${form.first} ${form.last}`)
}

const lastAnswer = ref('—')
async function ask(destructive) {
  const ok = await confirm(destructive
    ? { title: 'Delete this shift?', message: 'Jane Doe, Sat 7:00 AM – 3:00 PM. This can’t be undone.', confirmLabel: 'Delete', destructive: true }
    : { title: 'Email the schedule?', message: 'Each active employee gets their own shifts for this week.', confirmLabel: 'Send' })
  lastAnswer.value = ok ? 'confirmed' : 'cancelled'
}
async function askTwice() {
  const first = confirm('First question: continue?')
  const second = confirm({ title: 'Second question', message: 'Shown after the first one closes.' })
  lastAnswer.value = `${await first ? 'yes' : 'no'}, then ${await second ? 'yes' : 'no'}`
}

const sheet = ref(false)
const sheetAlways = ref(false)
const saleResult = ref(false)
const refundResult = ref(false)

const people = reactive([
  { name: 'Jane Doe', active: true },
  { name: 'Sam Carter', active: false },
])
function rowItems(p) {
  return [
    { label: 'Edit', icon: IconEdit, onClick: () => snackbar.show(`Edit ${p.name}`) },
    { label: 'Duplicate', icon: IconCopy, onClick: () => snackbar.show(`Duplicated ${p.name}`) },
    { label: 'Reset PIN', disabled: !p.active, onClick: () => snackbar.show('PIN reset') },
    {
      label: p.active ? 'Deactivate' : 'Reactivate',
      icon: IconPersonOff,
      danger: p.active,
      onClick: async () => {
        if (p.active && !(await confirm({ title: `Deactivate ${p.name}?`, message: 'They can no longer clock in.', confirmLabel: 'Deactivate', destructive: true }))) return
        p.active = !p.active
        snackbar.show({ message: `${p.name} ${p.active ? 'reactivated' : 'deactivated'}`, actionLabel: 'Undo', onAction: () => { p.active = !p.active } })
      },
    },
  ]
}
</script>
