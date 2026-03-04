<template>
  <div class="page-enter">
    <PageHero
      label="Tournament Calendar"
      title-html="Events &amp; <em>Tournaments</em>"
      subtitle="From weekly member events to signature charity tournaments. Something for every level of golfer."
      bg-image="/images/course-1.jpg"
    />

    <section class="topo py-12">
      <div class="max-w-5xl mx-auto px-5">

        <div class="mb-8">
          <EventFilterBar v-model="filter" />
        </div>

        <div v-if="loading" class="text-center py-16" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.4);">
          Loading events…
        </div>

        <div v-else-if="error" class="card rounded-lg p-8 text-center">
          <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.5);margin-bottom:12px;">{{ error }}</p>
          <a href="tel:2569747384" class="btn-primary inline-flex" style="padding:10px 20px;font-size:12px;">(256) 974-7384</a>
        </div>

        <div v-else-if="filteredEvents.length === 0" class="card rounded-lg p-10 text-center">
          <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.4);">No events match this filter.</p>
        </div>

        <div v-else class="space-y-4">
          <EventCard v-for="e in filteredEvents" :key="e.id" :event="e" />
        </div>

        <!-- Sponsor CTA -->
        <div class="mt-16 text-center">
          <SectionLabel text="Host an Event" center class="mb-5" />
          <h2 style="font-family:'Playfair Display',serif;font-size:30px;font-weight:900;color:#1E3D2F;margin-bottom:10px;">
            Interested in Sponsoring a Tournament?
          </h2>
          <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.5);margin-bottom:22px;max-width:460px;margin-left:auto;margin-right:auto;line-height:1.7;">
            Corporate sponsorships and custom event packages are available. Contact us to discuss opportunities.
          </p>
          <RouterLink to="/contact" class="btn-amber">Get in Touch</RouterLink>
        </div>

      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PageHero     from '@/components/layout/PageHero.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import EventFilterBar from '@/components/tournament/EventFilterBar.vue'
import EventCard      from '@/components/tournament/EventCard.vue'

const filter  = ref('All')
const loading = ref(true)
const error   = ref('')
const events  = ref([])

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function transform(e) {
  const d = new Date(e.eventDate)
  return {
    id:         e.id,
    name:       e.name,
    desc:       e.description,
    format:     e.format,
    memberOnly: e.memberOnly,
    featured:   e.featured,
    past:       e.past,
    time:       e.startTime,
    month:      MONTHS[d.getUTCMonth()],
    day:        String(d.getUTCDate()),
    year:       String(d.getUTCFullYear()),
    entry:      e.entry ? (e.entry / 100).toFixed(0) : null,
    spots:      e.spotsTotal ? `${e.spotsTotal} spots` : 'Open field',
  }
}

const filteredEvents = computed(() => {
  const all = events.value.map(transform)
  if (filter.value === 'Upcoming')    return all.filter((e) => !e.past)
  if (filter.value === 'Past')        return all.filter((e) => e.past)
  if (filter.value === 'Member Only') return all.filter((e) => e.memberOnly)
  return all
})

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/events`)
    if (!res.ok) throw new Error('Failed to load events')
    events.value = await res.json()
  } catch {
    error.value = 'Unable to load events. Please call (256) 974-7384.'
  } finally {
    loading.value = false
  }
})
</script>
