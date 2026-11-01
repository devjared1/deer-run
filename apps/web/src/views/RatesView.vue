<template>
  <div class="page-enter">
    <PageHero
      label="Green Fees"
      title-html="Rates &amp; <em>Services</em>"
      description="Simple weekday and weekend rates for 9 or 18 holes. Ride or walk."
      photo="course-3"
      height="650px"
    />

    <section class="topo py-14">
      <div class="max-w-7xl mx-auto px-5">

        <!-- Rate cards (live prices from /api/rates; the defaults show until they load) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-6">
          <div
            v-for="r in rateCards"
            :key="r.title"
            class="card rounded-lg overflow-hidden"
          >
            <div class="p-7">
              <div style="font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#6B5A48;margin-bottom:6px;">{{ r.subtitle }}</div>
              <h3 style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#1E3D2F;margin-bottom:14px;">{{ r.title }}</h3>
              <div class="grid grid-cols-2 gap-4">
                <div v-for="p in r.prices" :key="p.label">
                  <div style="font-family:'Playfair Display',serif;font-size:44px;font-weight:900;color:#1E3D2F;line-height:1;">{{ dollars(p.cents) }}</div>
                  <div style="font-family:'Lato',sans-serif;font-size:13px;color:#6B5A48;margin-top:4px;">{{ p.label }}</div>
                </div>
              </div>
              <div style="font-family:'Lato',sans-serif;font-size:13px;color:#6B5A48;margin-top:14px;">Greens fee per player</div>
              <RouterLink to="/book" class="btn-amber w-full justify-center mt-6">Book a Tee Time</RouterLink>
            </div>
          </div>
        </div>

        <div class="max-w-4xl mx-auto mb-14 card-pine rounded-lg px-7 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#F2EBD9;">Cart Fee</div>
            <div style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(242,235,217,.75);">Per rider, added to the greens fee. Walking is welcome.</div>
          </div>
          <div style="font-family:'Playfair Display',serif;font-size:36px;font-weight:900;color:#F2EBD9;line-height:1;">{{ dollars(rates.CART) }}</div>
        </div>

        <ul class="max-w-4xl mx-auto mb-14 grid sm:grid-cols-2 gap-x-6 gap-y-2">
          <li
            v-for="item in rateIncludes"
            :key="item"
            class="flex items-center gap-2.5 text-sm"
            style="font-family:'Lato',sans-serif;color:#52392A;"
          >
            <svg class="w-4 h-4 flex-shrink-0" style="color:#1E3D2F;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 13l4 4L19 7"/>
            </svg>
            {{ item }}
          </li>
        </ul>

        <!-- Additional fees table -->
        <div class="max-w-3xl mx-auto mb-14">
          <SectionLabel text="Additional Services" center class="mb-6" />
          <div class="card rounded-lg overflow-hidden">
            <table class="w-full">
              <tbody>
                <tr
                  v-for="(fee, i) in additionalFees"
                  :key="fee.item"
                  class="border-b last:border-0"
                  :class="i % 2 === 1 ? 'sc-row' : ''"
                  style="border-color:rgba(61,43,26,.07);"
                >
                  <td class="py-3.5 px-5" style="font-family:'Lato',sans-serif;font-size:14px;font-weight:700;color:#1E3D2F;">{{ fee.item }}</td>
                  <td class="py-3.5 px-4 text-right" style="font-family:'Playfair Display',serif;font-size:18px;font-weight:900;color:#1E3D2F;white-space:nowrap;">{{ fee.price }}</td>
                  <td class="py-3.5 px-5 hidden md:table-cell" style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.45);">{{ fee.note }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Policies -->
        <div class="max-w-3xl mx-auto mb-14">
          <SectionLabel text="Course Policies" center class="mb-6" />
          <div class="card-pine rounded-lg p-8">
            <ul class="space-y-3">
              <li
                v-for="p in policies"
                :key="p"
                class="flex items-start gap-3"
                style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(242,235,217,.6);line-height:1.6;"
              >
                <span style="color:#C4873A;font-weight:900;flex-shrink:0;margin-top:1px;">—</span>
                {{ p }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Group CTA -->
        <div class="max-w-3xl mx-auto text-center">
          <SectionLabel text="Group Outings" center class="mb-5" />
          <h2 style="font-family:'Playfair Display',serif;font-size:32px;font-weight:900;color:#1E3D2F;margin-bottom:10px;">Planning a Group Outing?</h2>
          <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.5);margin-bottom:22px;line-height:1.7;">Corporate events, fundraisers, and groups of 16+ receive customized pricing. Contact the Pro Shop for a quote.</p>
          <RouterLink to="/contact" class="btn-amber">Contact the Pro Shop</RouterLink>
        </div>

      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHero     from '@/components/layout/PageHero.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import { rateIncludes, additionalFees, policies } from '@/data/rates'
import { DEFAULT_RATES } from '@/lib/rates'

const rates = ref({ ...DEFAULT_RATES })

const rateCards = computed(() => [
  {
    title: 'Weekday', subtitle: 'Monday – Friday',
    prices: [{ label: '9 holes', cents: rates.value.WEEKDAY_9 }, { label: '18 holes', cents: rates.value.WEEKDAY_18 }],
  },
  {
    title: 'Weekend & Holiday', subtitle: 'Saturday, Sunday & holidays',
    prices: [{ label: '9 holes', cents: rates.value.WEEKEND_9 }, { label: '18 holes', cents: rates.value.WEEKEND_18 }],
  },
])

function dollars(cents) {
  return cents % 100 ? `$${(cents / 100).toFixed(2)}` : `$${cents / 100}`
}

onMounted(async () => {
  try {
    const res = await fetch('/api/rates')
    if (res.ok) rates.value = { ...rates.value, ...(await res.json()).rates }
  } catch { /* keep the defaults */ }
})
</script>
