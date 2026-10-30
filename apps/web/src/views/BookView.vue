<template>
  <div class="page-enter" style="background-color:#f7f3e8">
    <PageHero
      label="Reserve Your Round"
      title-html="Book a <em>Tee Time</em>"
      description="Select your date, choose a time, and complete payment securely online."
      bg-image="/images/course-5-copy.jpg"
      height="550px"
      :classes="['flex', 'items-center']"
    />

    <section class="py-2">
      <div class="max-w-3xl mx-auto px-2">
        <BookingWizard />
      </div>
    </section>
  </div>
</template>

<script setup>
import PageHero     from '@/components/layout/PageHero.vue'
import BookingWizard from '@/components/booking/BookingWizard.vue'
</script>
