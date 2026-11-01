<template>
  <div class="space-y-6">
    <div v-for="size in ['md', 'lg', 'xl']" :key="size" class="flex flex-wrap items-center gap-3">
      <span class="w-10 text-label-m text-on-surface-variant">{{ size }}</span>
      <AppButton v-for="v in variants" :key="v" :variant="v" :size="size">{{ v }}</AppButton>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <AppButton :icon="IconAdd">Leading icon</AppButton>
      <AppButton variant="outlined" :trailing-icon="IconArrow">Trailing icon</AppButton>
      <AppButton variant="gold" loading>Loading</AppButton>
      <AppButton disabled>Disabled</AppButton>
      <AppButton variant="outlined" disabled>Disabled</AppButton>
      <AppButton variant="text" to="/">Link (RouterLink)</AppButton>
    </div>
    <AppButton variant="gold" size="xl" block :icon="IconPayments">Charge $42.00</AppButton>
    <div class="flex flex-wrap items-center gap-2">
      <IconButton :icon="IconMenu" label="Menu" />
      <IconButton :icon="IconAdd" label="Add" variant="filled" />
      <IconButton :icon="IconEdit" label="Edit" variant="tonal" />
      <IconButton :icon="IconDelete" label="Delete" variant="outlined" />
      <IconButton :icon="IconStar" label="Favorite" toggle :selected="fav" variant="tonal" @click="fav = !fav" />
      <IconButton :icon="IconEdit" label="Edit (small)" size="sm" tooltip />
      <IconButton :icon="IconEdit" label="Edit (large)" size="lg" />
      <IconButton :icon="IconDelete" label="Delete (disabled)" disabled />
    </div>
  </div>
</template>

<script>
export default { galleryTitle: 'Buttons' }
</script>

<script setup>
import { ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import IconButton from '@/components/ui/IconButton.vue'
import IconAdd from '~icons/material-symbols/add-rounded'
import IconArrow from '~icons/material-symbols/arrow-forward-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconMenu from '~icons/material-symbols/menu-rounded'
import IconEdit from '~icons/material-symbols/edit-rounded'
import IconDelete from '~icons/material-symbols/delete-rounded'
import IconStar from '~icons/material-symbols/star-rounded'

const variants = ['filled', 'gold', 'tonal', 'outlined', 'text', 'danger']
const fav = ref(false)
</script>
