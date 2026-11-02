<template>
  <div class="bg-surface">
    <PageHero label="Waitlist" title-html="Tee time <em>waitlist</em>" />
    <div class="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <Card variant="outlined" padding="lg">
        <Skeleton v-if="loading" variant="text" :lines="2" label="Updating the waitlist" />
        <EmptyState
          v-else-if="error"
          :icon="IconLinkOff"
          title="We couldn't open this link"
          :message="error"
          action-label="Book a tee time"
          to="/book"
        />
        <EmptyState
          v-else
          :icon="IconCheck"
          title="You're off the waitlist"
          :message="`We won't email you about ${day} any more.`"
          action-label="Book a tee time"
          to="/book"
        />
      </Card>
    </div>
  </div>
</template>

<script setup>
// /waitlist/:id?t=<token> — "Not interested any more?" from the waitlist email: takes the golfer off the list for that day
// (DELETE /api/waitlist/:id). Opening the link is the confirmation; nothing else is asked.
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatLocalDate } from '@/lib/timeclock'
import PageHero from '@/components/layout/PageHero.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import IconCheck from '~icons/material-symbols/check-circle-rounded'
import IconLinkOff from '~icons/material-symbols/link-off-rounded'

const route = useRoute()
const loading = ref(true)
const error   = ref(null)
const day     = ref('that day')

onMounted(async () => {
  try {
    const res = await fetch(`/api/waitlist/${encodeURIComponent(route.params.id)}?t=${encodeURIComponent(route.query.t ?? '')}`, { method: 'DELETE' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Something went wrong.')
    day.value = formatLocalDate(body.date, { weekday: 'long', month: 'long', day: 'numeric' })
  } catch (e) {
    error.value = `${e.message} The link may be incomplete.`
  } finally {
    loading.value = false
  }
})
</script>
