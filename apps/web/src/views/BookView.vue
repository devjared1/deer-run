<template>
  <div class="bg-surface">
    <PageHero
      label="Reserve your round"
      title-html="Book a <em>Tee Time</em>"
      description="Pick a day, choose a time for your group and pay securely online."
      photo="course-5-wide"
      height="180px"
    />

    <section class="py-6 md:py-10">
      <div class="max-w-3xl mx-auto px-4 sm:px-6">
        <BookingWizard />
      </div>
    </section>
  </div>
</template>

<script setup>
import BookingWizard from '@/components/booking/BookingWizard.vue'
import PageHero from '@/components/layout/PageHero.vue'
</script>
