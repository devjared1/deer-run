<template>
  <div class="bg-surface">
    <article class="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20" aria-labelledby="a11y-title">
      <p class="text-label-l uppercase tracking-[.2em] text-gold-text mb-2">Website</p>
      <h1 id="a11y-title" class="font-display text-headline-l md:text-display-s text-on-surface">Accessibility statement</h1>
      <p class="mt-3 text-body-m text-on-surface-variant">
        Last updated <time :datetime="STATEMENT_DATE">{{ statementDateLabel }}</time>
      </p>

      <div class="mt-10 space-y-10 text-body-l text-on-surface">
        <section aria-labelledby="a11y-commitment">
          <h2 id="a11y-commitment" class="a11y-h2">Our commitment</h2>
          <p>
            {{ site.courseName }} wants everyone to be able to use this website: to check rates, book a tee time, sign up
            for an event or get in touch. We aim to meet the
            <a href="https://www.w3.org/TR/WCAG21/" target="_blank" rel="noopener" class="a11y-link">Web Content Accessibility Guidelines (WCAG) 2.1, level AA<span class="sr-only"> (opens in a new tab)</span></a>,
            and we test against them as we build. We haven’t had the site independently audited, so we don’t claim full
            conformance, but we treat any barrier you find as a problem to fix.
          </p>
        </section>

        <section aria-labelledby="a11y-done">
          <h2 id="a11y-done" class="a11y-h2">What we’ve done</h2>
          <p class="mb-4">The site is being redesigned with accessibility built in. So far that includes:</p>
          <ul class="space-y-3">
            <li v-for="item in done" :key="item.title" class="flex items-start gap-3">
              <span class="w-10 h-10 flex-shrink-0 inline-flex items-center justify-center rounded-full bg-primary-container text-on-primary-container" aria-hidden="true">
                <component :is="item.icon" class="w-5 h-5" />
              </span>
              <span>
                <strong class="block text-title-m">{{ item.title }}</strong>
                <span class="text-body-m text-on-surface-variant">{{ item.text }}</span>
              </span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="a11y-limits">
          <h2 id="a11y-limits" class="a11y-h2">Known limitations</h2>
          <p class="mb-4">We know about these and are working on them:</p>
          <ul class="list-disc pl-6 space-y-2 marker:text-on-surface-variant">
            <li>Some pages, including parts of the booking flow and the member account pages, haven’t been moved to the new design yet and may have smaller issues such as focus order or labels.</li>
            <li>Course photos have short descriptions; they don’t describe every hole in detail yet. The scorecard has the hole information as text.</li>
            <li>Monthly house account statements emailed as PDF files aren’t tagged for screen readers. The same statement is available as a web page under My Account.</li>
            <li>Card payments use a form provided by our payment processor, Stripe, and maps link to Google Maps and Apple Maps. We don’t control the accessibility of those services.</li>
          </ul>
        </section>

        <section aria-labelledby="a11y-contact">
          <h2 id="a11y-contact" class="a11y-h2">Report a problem or get help</h2>
          <p>
            If something on the site doesn’t work for you, or you need information in a different format, please tell us.
            Let us know the page and what happened, and we’ll do our best to help, including booking your tee time or
            answering your question over the phone.
          </p>
          <ul class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <li>
              <a :href="`tel:${site.phone.tel}`" class="a11y-contact state-layer">
                <IconCall class="w-6 h-6 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span class="block text-label-l text-on-surface-variant">Call the Pro Shop</span>
                  <span class="text-title-m text-on-surface">{{ site.phone.display }}</span>
                </span>
              </a>
            </li>
            <li>
              <a :href="`mailto:${site.email}?subject=${encodeURIComponent('Website accessibility')}`" class="a11y-contact state-layer">
                <IconMail class="w-6 h-6 flex-shrink-0 text-primary" aria-hidden="true" />
                <span class="min-w-0">
                  <span class="block text-label-l text-on-surface-variant">Email</span>
                  <span class="text-title-m text-on-surface break-all">{{ site.email }}</span>
                </span>
              </a>
            </li>
          </ul>
          <p class="mt-4">
            You can also use the <RouterLink to="/contact" class="a11y-link">contact form</RouterLink>.
          </p>
        </section>

        <section aria-labelledby="a11y-scope">
          <h2 id="a11y-scope" class="a11y-h2">About this statement</h2>
          <p>
            This statement covers the public website at deerrun.golf. It was written on
            {{ statementDateLabel }} and is reviewed as the redesign continues. It isn’t about physical access at the
            course; for questions about the clubhouse, carts or the course itself, please call the Pro Shop.
          </p>
        </section>
      </div>
    </article>
  </div>
</template>

<script setup>
import * as site from '@/data/site.js'
import { formatLocalDate } from '@/lib/timeclock.js'
import IconCall from '~icons/material-symbols/call-rounded'
import IconContrast from '~icons/material-symbols/contrast-rounded'
import IconKeyboard from '~icons/material-symbols/keyboard-rounded'
import IconMail from '~icons/material-symbols/mail-rounded'
import IconRecordVoiceOver from '~icons/material-symbols/record-voice-over-rounded'
import IconTouchApp from '~icons/material-symbols/touch-app-rounded'
import IconPause from '~icons/material-symbols/pause-circle-rounded'

const STATEMENT_DATE = '2026-11-01'
const statementDateLabel = formatLocalDate(STATEMENT_DATE, { month: 'long', day: 'numeric', year: 'numeric' })

const done = [
  { icon: IconKeyboard, title: 'Keyboard access', text: 'Every link, button and form works with a keyboard, with a visible focus outline and a “Skip to main content” link at the top of each page.' },
  { icon: IconContrast, title: 'Color contrast', text: 'Text colors are chosen to meet the AA contrast ratio against their backgrounds, and color is never the only way information is shown.' },
  { icon: IconRecordVoiceOver, title: 'Screen reader labels', text: 'Form fields have labels tied to them, icons that carry meaning have text alternatives, and errors are announced next to the field they belong to.' },
  { icon: IconPause, title: 'Reduced motion', text: 'If your device is set to reduce motion, the site turns its animations off.' },
  { icon: IconTouchApp, title: 'Touch targets', text: 'Buttons and links are sized for fingers (at least 48 by 48 pixels where we can), and pages work on phones from 360 pixels wide.' },
]
</script>

<style scoped>
.a11y-h2 {
  @apply font-display text-headline-s text-on-surface mb-3;
}
.a11y-link {
  @apply text-primary font-bold underline underline-offset-2;
}
.a11y-contact {
  @apply flex items-center gap-3 min-h-[64px] px-4 py-3 rounded-shape-md border border-outline-variant bg-surface-container-low no-underline;
}
</style>
