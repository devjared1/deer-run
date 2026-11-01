<template>
  <div
    class="page-enter"
    style="background-color:#f7f3e8"
  >
    <PageHero
      label="Reserve Your Round"
      title-html="Book a <em>Tee Time</em>"
      description="Select your date, choose a time, and complete payment securely online."
      photo="course-5-wide"
      height="200px"
    />

    <section class="py-6 md:py-10">
      <div class="max-w-3xl mx-auto px-4 sm:px-6">
        <BookingWizard />
      </div>
    </section>
  </div>
</template>

<script setup>
import BookingWizard from '@/components/booking/BookingWizard.vue';
import PageHero from '@/components/layout/PageHero.vue';
</script>
