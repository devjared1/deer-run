<template>
  <div class="page-enter">
    <!-- Hero with course photo background -->
    <PageHero
      label="Welcome to Deer Run"
      title-html="Where the Bankhead<br><em>Meets the Fairway</em>"
      subtitle="18 championship holes at the entrance to the Bankhead National Forest. Open to the public daily since 1980."
      bg-image="/images/course-hero.jpg"
    >
      <div class="mt-8 flex flex-col sm:flex-row gap-3 items-start">
        <RouterLink to="/book" class="btn-amber">Book a Tee Time →</RouterLink>
        <RouterLink to="/scorecard" class="btn-outline">View the Course</RouterLink>
      </div>
    </PageHero>

    <!-- Feature cards -->
    <section class="topo py-16">
      <div class="max-w-7xl mx-auto px-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div v-for="f in features" :key="f.title" class="card rounded-lg p-7">
            <div class="text-3xl mb-4">{{ f.icon }}</div>
            <SectionLabel :text="f.label" class="mb-3" />
            <h3 style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#1E3D2F;margin-bottom:8px;">{{ f.title }}</h3>
            <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.55);line-height:1.7;">{{ f.body }}</p>
            <RouterLink :to="f.link" class="inline-flex items-center gap-1 mt-4" style="font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1E3D2F;text-decoration:none;">
              {{ f.cta }} →
            </RouterLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats strip -->
    <section class="hero-bg py-16">
      <div class="relative z-10 max-w-7xl mx-auto px-5">
        <SectionLabel text="The Numbers" dark center class="mb-10" />
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div v-for="s in stats" :key="s.label">
            <div style="font-family:'Playfair Display',serif;font-size:52px;font-weight:900;color:#F2EBD9;line-height:1;">{{ s.val }}</div>
            <div style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(196,135,58,.7);margin-top:6px;">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Course photo gallery -->
    <section class="overflow-hidden">
      <div
        class="grid"
        style="grid-template-columns: 5fr 3fr 3fr; grid-template-rows: 300px 300px;"
      >
        <!-- Large featured photo — spans 2 rows -->
        <div class="row-span-2 overflow-hidden relative group">
          <img
            :src="gallery[0].src"
            :alt="gallery[0].alt"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        <!-- Top-right photos -->
        <div class="overflow-hidden relative group">
          <img
            :src="gallery[1].src"
            :alt="gallery[1].alt"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        <div class="overflow-hidden relative group">
          <img
            :src="gallery[2].src"
            :alt="gallery[2].alt"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        <!-- Bottom-right photos -->
        <div class="overflow-hidden relative group">
          <img
            :src="gallery[3].src"
            :alt="gallery[3].alt"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        <div class="overflow-hidden relative group">
          <img
            :src="gallery[4].src"
            :alt="gallery[4].alt"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </div>
    </section>

    <!-- Quick info strip -->
    <section class="topo py-14">
      <div class="max-w-7xl mx-auto px-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div v-for="info in quickInfo" :key="info.label" class="card rounded-lg p-6 flex items-start gap-4">
            <div class="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style="background:rgba(30,61,47,.1);">
              <span class="text-xl">{{ info.icon }}</span>
            </div>
            <div>
              <div style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(61,43,26,.4);margin-bottom:3px;">{{ info.label }}</div>
              <div style="font-family:'Lato',sans-serif;font-size:14px;font-weight:700;color:#1E3D2F;">{{ info.value }}</div>
              <div style="font-family:'Lato',sans-serif;font-size:12px;color:rgba(61,43,26,.45);margin-top:2px;">{{ info.sub }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="topo pb-20 pt-4">
      <div class="max-w-7xl mx-auto px-5 text-center">
        <SectionLabel text="Ready to Play?" center class="mb-5" />
        <h2 style="font-family:'Playfair Display',serif;font-size:clamp(28px,4vw,46px);font-weight:900;color:#1E3D2F;margin-bottom:14px;">
          Book Your Next Round Today
        </h2>
        <p style="font-family:'Lato',sans-serif;font-size:15px;color:rgba(61,43,26,.5);margin-bottom:28px;max-width:480px;margin-left:auto;margin-right:auto;line-height:1.7;">
          Tee times available online 24/7. Public and member rates starting at $45 with cart included.
        </p>
        <RouterLink to="/book" class="btn-amber mr-3">Book Online</RouterLink>
        <RouterLink to="/rates" class="btn-outline-pine">View Rates</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import PageHero     from '@/components/layout/PageHero.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'

const features = [
  {
    icon: '⛳',
    label: 'The Course',
    title: '18 Holes of Earl Stone Design',
    body:  'Sculpted into the rolling terrain of Lawrence County, Deer Run rewards thoughtful play with dramatic elevation changes, water carries, and bent-grass greens.',
    link:  '/scorecard',
    cta:   'View Scorecard',
  },
  {
    icon: '🏌️',
    label: 'Tee Times',
    title: 'Online Booking — 24/7',
    body:  'Reserve your round in minutes from any device. Public golfers book up to 7 days in advance. Members enjoy 14-day access and priority morning slots.',
    link:  '/book',
    cta:   'Book Now',
  },
  {
    icon: '🏆',
    label: 'Tournaments',
    title: 'Year-Round Events',
    body:  'From the Spring Opener Scramble to the Lawrence County Charity Open, our tournament calendar gives every golfer something to look forward to.',
    link:  '/tournaments',
    cta:   'See Schedule',
  },
]

const stats = [
  { val: '18',    label: 'Holes' },
  { val: '72',    label: 'Par' },
  { val: '6,745', label: 'Total Yards' },
  { val: '1980',  label: 'Est.' },
]

const gallery = [
  { src: '/images/course-1.jpg', alt: 'Deer Run Golf Course fairway' },
  { src: '/images/course-2.jpg', alt: 'Deer Run Golf Course hole' },
  { src: '/images/course-3.jpg', alt: 'Deer Run Golf Course green' },
  { src: '/images/course-4.jpg', alt: 'Deer Run Golf Course landscape' },
  { src: '/images/course-5.jpg', alt: 'Deer Run Golf Course scenery' },
]

const quickInfo = [
  {
    icon: '📍',
    label: 'Location',
    value: '1175 County Road 100, Moulton AL',
    sub:   'At the entrance to Bankhead National Forest',
  },
  {
    icon: '⏰',
    label: 'Hours',
    value: 'Open Daily · First tee 7:30 AM',
    sub:   'Closed Christmas Eve & Christmas Day',
  },
  {
    icon: '📞',
    label: 'Pro Shop',
    value: '(256) 974-7384',
    sub:   'Call to book or inquire about memberships',
  },
]
</script>
