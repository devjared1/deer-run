<template>
  <Card
    :to="`/tournaments/${encodeURIComponent(event.id)}`"
    :variant="event.past ? 'filled' : 'elevated'"
    padding="md"
    class="h-full"
  >
    <template #media>
      <div class="relative aspect-[16/9] overflow-hidden bg-surface-container-highest">
        <ResponsivePicture
          :name="event.photo"
          alt=""
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          :img-class="['absolute inset-0 w-full h-full object-cover', event.past ? 'grayscale' : '']"
        />
        <EventDateBlock
          class="absolute left-3 top-3"
          :month="event.month"
          :day="event.day"
          :year="event.year"
          :label="event.dateLabel"
          :muted="event.past"
        />
      </div>
    </template>

    <div class="flex flex-col h-full gap-3">
      <div class="flex flex-wrap gap-2">
        <StatusChip v-if="event.past" size="sm" label="Ended" tone="neutral" icon="flag" />
        <StatusChip v-if="event.memberOnly" size="sm" label="Members only" tone="primary" icon="member" />
        <StatusChip v-if="event.featured && !event.past" size="sm" label="Featured" tone="info" :icon="IconStar" />
        <StatusChip v-if="event.format" size="sm" :label="event.format" tone="neutral" icon="golf" />
      </div>

      <h3 class="font-display text-headline-s text-on-surface">{{ event.name }}</h3>
      <p v-if="event.description" class="text-body-m text-on-surface-variant line-clamp-3">{{ event.description }}</p>

      <ul class="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-body-m text-on-surface-variant">
        <li v-if="event.timeLabel" class="inline-flex items-center gap-1.5">
          <IconSchedule class="w-5 h-5" aria-hidden="true" />
          <span><span class="sr-only">Starts </span>{{ event.timeLabel }}</span>
        </li>
        <li class="inline-flex items-center gap-1.5">
          <IconGroup class="w-5 h-5" aria-hidden="true" />
          {{ event.spotsLabel }}
        </li>
        <li v-if="event.entryLabel" class="inline-flex items-center gap-1.5">
          <IconPayments class="w-5 h-5" aria-hidden="true" />
          {{ event.entryLabel }} entry
        </li>
      </ul>

      <span class="inline-flex items-center gap-1 text-label-l text-primary">
        {{ event.past ? 'View details' : event.memberOnly ? 'Details & member sign-up' : 'Details & registration' }}
        <IconArrowForward class="w-[18px] h-[18px]" aria-hidden="true" />
      </span>
    </div>
  </Card>
</template>

<script setup>
// One tournament on the Tournaments page: a decorative course photo with the date block, chips, name, description
// and the time / field / entry line. The whole card links to the event page (/tournaments/:id).
//   <EventCard :event="normalizeEvent(row)" />   (eventDisplay.js)
import Card from '@/components/ui/Card.vue'
import ResponsivePicture from '@/components/ui/ResponsivePicture.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import EventDateBlock from './EventDateBlock.vue'
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded'
import IconGroup from '~icons/material-symbols/group-rounded'
import IconPayments from '~icons/material-symbols/payments-rounded'
import IconSchedule from '~icons/material-symbols/schedule-rounded'
import IconStar from '~icons/material-symbols/star-rounded'

defineProps({
  event: { type: Object, required: true },
})
</script>
