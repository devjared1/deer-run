<template>
  <div class="page-enter">
    <PageHero
      label="Reserve Your Round"
      title-html="Book a <em>Tee Time</em>"
      subtitle="Select your date, choose a time, and complete payment securely online."
    />

    <section class="topo py-12">
      <div class="max-w-3xl mx-auto px-5">
        <BookingWizard />
      </div>
    </section>
  </div>
</template>

<script setup>
import PageHero     from '@/components/layout/PageHero.vue'
import BookingWizard from '@/components/booking/BookingWizard.vue'
</script>
